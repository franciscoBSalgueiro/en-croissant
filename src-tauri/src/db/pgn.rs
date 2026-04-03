use aix_chess_compression::{CompressionLevel, Encode, Encoder};
use chrono::NaiveDate;
use duckdb::types::{TimeUnit, Value};
use duckdb::{params, Appender};
use lazy_regex::regex_captures;
use pgn_reader::{RawComment, RawTag, Reader, SanPlus, Skip, Visitor};
use shakmaty::san::San;
use shakmaty::{fen::Fen as ShakmatyFen, CastlingMode, Chess, FromSetup, Position};
use std::ops::ControlFlow;

pub struct PgnProcessor<'a> {
    appender: Appender<'a>,
    count: u32,
    level: CompressionLevel,
    continue_on_invalid_move: bool,
    timestamp: Option<i32>,
}

#[derive(Default, Debug)]
pub struct Headers {
    event: Option<String>,
    site: Option<String>,
    round: Option<String>,
    setup: bool,
    fen: Option<String>,

    white: Option<String>,
    black: Option<String>,
    white_rating: Option<i16>,
    black_rating: Option<i16>,
    white_title: Option<String>,
    black_title: Option<String>,

    result: Option<String>,
    // time_control: Option<(u16, u8)>,
    date: Option<String>,
    utc_date: Option<String>,
    time: Option<String>,
    utc_time: Option<String>,
}

impl<'a> PgnProcessor<'a> {
    pub fn new(
        appender: Appender<'a>,
        level: CompressionLevel,
        continue_on_invalid_move: bool,
        timestamp: Option<i32>,
    ) -> PgnProcessor<'a> {
        PgnProcessor {
            appender,
            count: 0,
            level,
            continue_on_invalid_move,
            timestamp,
        }
    }

    pub fn flush(&mut self) -> Result<(), duckdb::Error> {
        self.appender.flush()
    }
}

pub fn encode_single_game_moves(
    pgn: &str,
    level: CompressionLevel,
    continue_on_invalid_move: bool,
) -> Result<Vec<u8>, String> {
    let mut reader = Reader::new(pgn.as_bytes());
    let mut proc = SingleGameProcessor::new(level, continue_on_invalid_move);
    let game = reader
        .read_game(&mut proc)
        .map_err(|err| format!("failed to parse PGN: {err}"))?;

    if let Some(err) = proc.error {
        return Err(err);
    }

    game.ok_or_else(|| "no game found in PGN".to_owned())
}

struct SingleGameProcessor {
    level: CompressionLevel,
    continue_on_invalid_move: bool,
    error: Option<String>,
}

impl SingleGameProcessor {
    fn new(level: CompressionLevel, continue_on_invalid_move: bool) -> Self {
        Self {
            level,
            continue_on_invalid_move,
            error: None,
        }
    }
}

impl Visitor for SingleGameProcessor {
    type Tags = Headers;
    type Movetext = GameInProcessing<'static>;
    type Output = Vec<u8>;

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        ControlFlow::Continue(Headers::default())
    }

    fn begin_movetext(&mut self, tags: Self::Tags) -> ControlFlow<Self::Output, Self::Movetext> {
        ControlFlow::Continue(GameInProcessing::new(tags, self.level))
    }

    fn san(
        &mut self,
        movetext: &mut Self::Movetext,
        san_plus: SanPlus,
    ) -> ControlFlow<Self::Output> {
        if let Err(err) = movetext.play_san(&san_plus) {
            let error_msg = format!("{err} in game with headers {:?}", movetext.headers);

            if self.continue_on_invalid_move {
                eprintln!("{error_msg}");
                self.error = Some(error_msg);
                return ControlFlow::Break(Vec::new());
            }

            self.error = Some(error_msg);
            return ControlFlow::Break(Vec::new());
        }

        ControlFlow::Continue(())
    }

    fn begin_variation(
        &mut self,
        movetext: &mut Self::Movetext,
    ) -> ControlFlow<Self::Output, Skip> {
        if movetext.begin_variation() {
            ControlFlow::Continue(Skip(false))
        } else {
            ControlFlow::Continue(Skip(true))
        }
    }

    fn end_variation(&mut self, movetext: &mut Self::Movetext) -> ControlFlow<Self::Output> {
        movetext.end_variation();
        ControlFlow::Continue(())
    }

    fn tag(
        &mut self,
        tags: &mut Self::Tags,
        key: &[u8],
        value: RawTag<'_>,
    ) -> ControlFlow<Self::Output> {
        apply_tag(tags, key, value);
        ControlFlow::Continue(())
    }

    fn comment(
        &mut self,
        movetext: &mut Self::Movetext,
        comment: RawComment<'_>,
    ) -> ControlFlow<Self::Output> {
        apply_comment(movetext, comment);
        ControlFlow::Continue(())
    }

    fn end_game(&mut self, movetext: Self::Movetext) -> Self::Output {
        movetext.encoder.finish().into_bytes()
    }
}

pub struct GameInProcessing<'a> {
    headers: Headers,
    encoder: Encoder<'a>,
    evals: Vec<(u16, i16)>,
    clocks_white: Vec<(u16, u16)>,
    clocks_black: Vec<(u16, u16)>,
    pos: Chess,
    ply: u16,
    /// Stack of (saved_position, saved_ply) for variation support.
    /// When entering a variation, we push the current position onto the stack
    /// and restore the position to before the last mainline move.
    position_stack: Vec<(Chess, u16)>,
    /// The position before the last move was played, needed to branch variations.
    pos_before_last_move: Option<Chess>,
    /// The ply before the last move, for restoring ply in variations.
    ply_before_last_move: u16,
    /// Whether this encoder supports variations (only Low compression).
    supports_variations: bool,
}

impl GameInProcessing<'_> {
    fn new(headers: Headers, level: CompressionLevel) -> Self {
        let initial_fen = headers.fen.clone();
        let pos = match initial_fen.as_deref() {
            Some(fen) => chess_from_fen(fen)
                .unwrap_or_else(|e| panic!("invalid initial FEN in PGN tags: {e}")),
            None => Chess::new(),
        };

        GameInProcessing {
            headers,
            encoder: Encoder::new_with_initial_fen(level, initial_fen.as_deref())
                .unwrap_or_else(|e| panic!("failed to initialize encoder with initial FEN: {e}")),
            evals: vec![],
            clocks_white: vec![],
            clocks_black: vec![],
            pos: pos.clone(),
            ply: 0,
            position_stack: vec![],
            pos_before_last_move: None,
            ply_before_last_move: 0,
            supports_variations: level == CompressionLevel::Low,
        }
    }

    fn finalize_evals(&self) -> Option<String> {
        if self.evals.is_empty() {
            return None;
        }

        let mut index = 1;
        let mut evals = vec![];
        for &(ply, eval) in &self.evals {
            if index != ply {
                let n = ply - index;
                let last = evals.last().cloned().unwrap_or(0);
                evals.append(&mut vec![last; n.into()]);
            }

            evals.push(eval);
            index = ply + 1;
        }

        Some(format!("{:?}", evals))
    }

    fn finalize_clocks(&self, white: bool) -> Option<String> {
        let clocks = if white {
            &self.clocks_white
        } else {
            &self.clocks_black
        };

        if clocks.is_empty() {
            return None;
        }

        let mut index = 1;
        let mut clocks_out = vec![];
        for &(ply, clock) in clocks {
            if index != ply {
                let n = (ply - index) / 2;
                let last = clocks_out.last().cloned().unwrap_or(0);
                clocks_out.append(&mut vec![last; n.into()]);
            }

            clocks_out.push(clock);
            index = ply + 2;
        }

        Some(format!("{:?}", clocks_out))
    }

    fn play_san(&mut self, san_plus: &SanPlus) -> Result<(), String> {
        let san = san_plus
            .san
            .to_string()
            .parse::<San>()
            .map_err(|err| format!("invalid SAN '{}': {err}", san_plus.san))?;
        let chess_move = san
            .to_move(&self.pos)
            .map_err(|_| format!("invalid move '{}' at ply {}", san_plus.san, self.ply + 1))?;

        self.pos_before_last_move = Some(self.pos.clone());
        self.ply_before_last_move = self.ply;
        self.pos.play_unchecked(chess_move);
        self.encoder
            .encode_move(chess_move)
            .map_err(|err| format!("failed to encode move: {err}"))?;
        self.ply += 1;

        Ok(())
    }

    fn begin_variation(&mut self) -> bool {
        if !self.supports_variations {
            return false;
        }

        self.encoder.encode_start_variation();
        self.position_stack.push((self.pos.clone(), self.ply));

        if let Some(ref saved_pos) = self.pos_before_last_move {
            self.pos = saved_pos.clone();
            self.ply = self.ply_before_last_move;
        }

        true
    }

    fn end_variation(&mut self) {
        self.encoder.encode_end_variation();

        if let Some((saved_pos, saved_ply)) = self.position_stack.pop() {
            self.pos = saved_pos;
            self.ply = saved_ply;
        }
    }
}

impl<'a> Visitor for PgnProcessor<'a> {
    type Tags = Headers;
    type Movetext = GameInProcessing<'a>;
    type Output = ();

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        ControlFlow::Continue(Headers::default())
    }

    fn begin_movetext(&mut self, tags: Self::Tags) -> ControlFlow<Self::Output, Self::Movetext> {
        ControlFlow::Continue(GameInProcessing::new(tags, self.level))
    }

    fn san(
        &mut self,
        movetext: &mut Self::Movetext,
        san_plus: SanPlus,
    ) -> ControlFlow<Self::Output> {
        if let Err(err) = movetext.play_san(&san_plus) {
            let error_msg = format!("{err} in game with headers {:?}", movetext.headers);
            if self.continue_on_invalid_move {
                eprintln!("{error_msg}");

                let mut swap = GameInProcessing::new(Headers::default(), CompressionLevel::Low);

                std::mem::swap(&mut swap, movetext);
                self.end_game_inner(swap);

                return ControlFlow::Break(());
            } else {
                panic!(
                    "{error_msg}\nCheck the PGN file or if you want to use --continue-on-invalid-move."
                );
            }
        }

        ControlFlow::Continue(())
    }

    fn begin_variation(
        &mut self,
        movetext: &mut Self::Movetext,
    ) -> ControlFlow<Self::Output, Skip> {
        if movetext.begin_variation() {
            ControlFlow::Continue(Skip(false))
        } else {
            ControlFlow::Continue(Skip(true))
        }
    }

    fn end_variation(&mut self, movetext: &mut Self::Movetext) -> ControlFlow<Self::Output> {
        movetext.end_variation();

        ControlFlow::Continue(())
    }

    fn end_game(&mut self, movetext: Self::Movetext) -> Self::Output {
        self.end_game_inner(movetext)
    }

    fn tag(
        &mut self,
        tags: &mut Self::Tags,
        key: &[u8],
        value: pgn_reader::RawTag<'_>,
    ) -> ControlFlow<Self::Output> {
        apply_tag(tags, key, value);

        ControlFlow::Continue(())
    }

    fn comment(
        &mut self,
        movetext: &mut Self::Movetext,
        comment: pgn_reader::RawComment<'_>,
    ) -> ControlFlow<Self::Output> {
        apply_comment(movetext, comment);

        ControlFlow::Continue(())
    }
}

fn apply_tag(tags: &mut Headers, key: &[u8], value: RawTag<'_>) {
    match key {
        b"White" => tags.white = Some(value.decode_utf8_lossy().into_owned()),
        b"Black" => tags.black = Some(value.decode_utf8_lossy().into_owned()),
        b"Round" => tags.round = Some(value.decode_utf8_lossy().into_owned()),
        b"WhiteElo" => tags.white_rating = value.decode_utf8_lossy().parse().ok(),
        b"BlackElo" => tags.black_rating = value.decode_utf8_lossy().parse().ok(),
        b"Result" => tags.result = Some(value.decode_utf8_lossy().into_owned()),
        // b"TimeControl" => tags.time_control = parse_time_control(&value.decode_utf8_lossy()),
        b"Site" => {
            tags.site = value
                .decode_utf8_lossy()
                .split("/")
                .last()
                .map(|s| s.to_owned())
        }
        b"WhiteTitle" => tags.white_title = Some(value.decode_utf8_lossy().into_owned()),
        b"BlackTitle" => tags.black_title = Some(value.decode_utf8_lossy().into_owned()),
        b"Event" => tags.event = extract_tournament_from_event(&value.decode_utf8_lossy()),
        b"Date" => tags.utc_date = Some(value.decode_utf8_lossy().into_owned()),
        b"Time" => tags.utc_time = Some(value.decode_utf8_lossy().into_owned()),
        b"UTCDate" => tags.utc_date = Some(value.decode_utf8_lossy().into_owned()),
        b"UTCTime" => tags.utc_time = Some(value.decode_utf8_lossy().into_owned()),
        b"SetUp" => tags.setup = value.decode_utf8_lossy() == "1",
        b"FEN" => tags.fen = Some(value.decode_utf8_lossy().into_owned()),
        _ => {}
    };
}

fn apply_comment(movetext: &mut GameInProcessing<'_>, comment: RawComment<'_>) {
    let cmt = std::str::from_utf8(comment.as_bytes()).unwrap_or("");

    if let Some(eval_cp) = extract_eval_cp_from_comment(cmt) {
        movetext.evals.push((movetext.ply, eval_cp));
    }

    if let Some(clock_seconds) = extract_clock_seconds_from_comment(cmt) {
        if movetext.ply % 2 == 1 {
            movetext.clocks_white.push((movetext.ply, clock_seconds));
        } else {
            movetext.clocks_black.push((movetext.ply, clock_seconds));
        }
    }
}

impl<'a> PgnProcessor<'a> {
    fn end_game_inner(
        &mut self,
        movetext: <Self as Visitor>::Movetext,
    ) -> <Self as Visitor>::Output {
        let clocks_w = movetext.finalize_clocks(true);
        let clocks_b = movetext.finalize_clocks(false);
        let evals = movetext.finalize_evals();
        let moves = movetext.encoder.finish();
        let bytes = moves.into_bytes();
        let headers = movetext.headers;

        let game_ts = build_utc_timestamp(
            headers.utc_date.as_deref().or(headers.date.as_deref()),
            headers.utc_time.as_deref().or(headers.time.as_deref()),
        );
        if let Some(ts) = self.timestamp {
            if let Some(game_ts) = game_ts {
                if game_ts < ts as i64 {
                    return;
                }
            }
        }

        let db_ts = game_ts.map(|ts| Value::Timestamp(TimeUnit::Microsecond, ts));

        self.appender
            .append_row(params![
                headers.event,
                headers.site,
                headers.round,
                headers.fen,
                headers.white,
                headers.black,
                headers.white_rating,
                headers.black_rating,
                headers.white_title,
                headers.black_title,
                headers.result,
                movetext.ply,
                db_ts,
                bytes
            ])
            .unwrap();

        self.count += 1;
        if self.count % 10000 == 0 {
            println!("{} done", self.count);
        }
    }
}

fn chess_from_fen(fen: &str) -> Result<Chess, String> {
    let parsed = ShakmatyFen::from_ascii(fen.as_bytes()).map_err(|e| e.to_string())?;
    let setup = parsed.as_setup();
    let castling_mode = CastlingMode::detect(setup);
    Chess::from_setup(setup.clone(), castling_mode).map_err(|_| "invalid FEN setup".to_owned())
}

fn extract_eval_cp_from_comment(comment: &str) -> Option<i16> {
    regex_captures!(r"\[%eval (-?\d+\.\d+|#-?\d+)\]", comment)
        .and_then(|(_whole, eval)| eval_capture_to_cp(eval))
}

fn eval_capture_to_cp(eval: &str) -> Option<i16> {
    if &eval[0..1] == "#" {
        eval[1..].parse().ok().map(|mate: i16| {
            if mate > 0 {
                i16::MAX - mate + 1
            } else {
                i16::MIN - mate - 1
            }
        })
    } else {
        eval.parse().ok().map(|p: f64| (p * 100.0).round() as i16)
    }
}

fn extract_clock_seconds_from_comment(comment: &str) -> Option<u16> {
    regex_captures!(r"\[%clk ([0-9]+):([0-9]{2}):([0-9]{2})\]", comment).map(|(_whole, h, m, s)| {
        h.parse::<u16>().unwrap() * 3600
            + m.parse::<u16>().unwrap() * 60
            + s.parse::<u16>().unwrap()
    })
}

fn parse_time_control(s: &str) -> Option<(u16, u8)> {
    if s == "-" {
        return None;
    }

    let parts: Vec<&str> = s.split("+").collect();
    Some((parts[0].parse().unwrap(), parts[1].parse().unwrap()))
}

fn extract_tournament_from_event(s: &str) -> Option<String> {
    regex_captures!(r"lichess\.org/tournament/(\w+)", s)
        .map(|(_whole, tournament)| tournament.to_owned())
}

fn build_utc_timestamp(date: Option<&str>, time: Option<&str>) -> Option<i64> {
    let dt = parse_pgn_datetime(date?, time)?;
    let micros = dt.and_utc().timestamp_micros();

    Some(micros)
}

fn parse_pgn_datetime(date: &str, time: Option<&str>) -> Option<chrono::NaiveDateTime> {
    let (year, month, day) = split_three(date, '.')?;
    let year = parse_component(year, None)? as i32;
    let month = parse_component(month, Some(1))?;
    let day = parse_component(day, Some(1))?;
    let date = NaiveDate::from_ymd_opt(year, month, day)?;

    let (hour, minute, second) = match time {
        Some(time) => {
            let (hour, minute, second) = split_three(time, ':')?;
            (
                parse_component(hour, Some(0))?,
                parse_component(minute, Some(0))?,
                parse_component(second, Some(0))?,
            )
        }
        None => (0, 0, 0),
    };

    date.and_hms_opt(hour, minute, second)
}

fn split_three(input: &str, delimiter: char) -> Option<(&str, &str, &str)> {
    let (first, remainder) = input.split_once(delimiter)?;
    let (second, third) = remainder.split_once(delimiter)?;
    if third.contains(delimiter) {
        return None;
    }

    Some((first, second, third))
}

fn parse_component(component: &str, unknown_default: Option<u32>) -> Option<u32> {
    if component.is_empty() || component.chars().all(|ch| ch == '?') {
        return unknown_default;
    }

    component
        .chars()
        .all(|ch| ch.is_ascii_digit())
        .then(|| component.parse().ok())?
}
