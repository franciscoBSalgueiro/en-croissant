use super::annotations::{Annotation, Annotations};
use crate::error::Error;
use aix_chess_compression::{CompressionLevel, Encode, Encoder};
use chrono::NaiveDate;
use duckdb::types::{TimeUnit, Value};
use duckdb::{appender_params_from_iter, Appender};
use pgn_reader::{Nag, RawComment, RawTag, Reader, SanPlus, Skip, Visitor};
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
    fen: Option<String>,

    white: Option<String>,
    black: Option<String>,
    white_rating: Option<i16>,
    black_rating: Option<i16>,
    white_title: Option<String>,
    black_title: Option<String>,

    result: Option<String>,
    time_control: Option<String>,
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

    pub fn count(&self) -> u32 {
        self.count
    }

    pub fn read_batch<R: std::io::Read>(&mut self, reader: &mut Reader<R>) -> Result<usize, Error> {
        let mut count = 0;
        for game in reader.read_games(self).take(10_000) {
            game??;
            count += 1;
        }
        Ok(count)
    }
}

pub struct StoredGame {
    pub headers: Headers,
    pub movedata: Vec<u8>,
    pub ply_count: u16,
    pub annotations: Option<Vec<u8>>,
}

impl StoredGame {
    pub fn timestamp(&self) -> Option<i64> {
        build_utc_timestamp(
            self.headers
                .utc_date
                .as_deref()
                .or(self.headers.date.as_deref()),
            self.headers
                .utc_time
                .as_deref()
                .or(self.headers.time.as_deref()),
        )
    }

    pub fn database_values(self) -> Vec<Value> {
        let timestamp = self
            .timestamp()
            .map(|ts| Value::Timestamp(TimeUnit::Microsecond, ts));
        let h = self.headers;
        vec![
            h.event.into(),
            h.site.into(),
            h.round.into(),
            h.fen.into(),
            h.white.into(),
            h.black.into(),
            h.white_rating.into(),
            h.black_rating.into(),
            h.white_title.into(),
            h.black_title.into(),
            h.result.into(),
            h.time_control.into(),
            self.ply_count.into(),
            timestamp.unwrap_or(Value::Null),
            Value::Blob(self.movedata),
            self.annotations.into(),
        ]
    }
}

pub fn parse_single_game(pgn: &str) -> Result<StoredGame, String> {
    Reader::new(pgn.as_bytes())
        .read_game(&mut SingleGameProcessor)
        .map_err(|err| format!("failed to parse PGN: {err}"))?
        .ok_or_else(|| "no game found in PGN".to_owned())?
}

struct SingleGameProcessor;

impl Visitor for SingleGameProcessor {
    type Tags = Headers;
    type Movetext = GameInProcessing<'static>;
    type Output = Result<StoredGame, String>;

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        ControlFlow::Continue(Headers::default())
    }

    fn begin_movetext(&mut self, tags: Self::Tags) -> ControlFlow<Self::Output, Self::Movetext> {
        match GameInProcessing::new(tags, CompressionLevel::Low) {
            Ok(game) => ControlFlow::Continue(game),
            Err(error) => ControlFlow::Break(Err(error)),
        }
    }

    fn san(
        &mut self,
        movetext: &mut Self::Movetext,
        san_plus: SanPlus,
    ) -> ControlFlow<Self::Output> {
        if let Err(err) = movetext.play_san(&san_plus) {
            let error_msg = format!("{err} in game with headers {:?}", movetext.headers);

            return ControlFlow::Break(Err(error_msg));
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

    fn outcome(
        &mut self,
        movetext: &mut Self::Movetext,
        outcome: shakmaty::Outcome,
    ) -> ControlFlow<Self::Output> {
        let result = outcome.to_string();
        movetext.headers.result = Some(result);
        ControlFlow::Continue(())
    }

    fn nag(&mut self, movetext: &mut Self::Movetext, nag: Nag) -> ControlFlow<Self::Output> {
        movetext
            .annotations
            .push(movetext.event, Annotation::Nag(nag.0));
        ControlFlow::Continue(())
    }

    fn partial_comment(
        &mut self,
        movetext: &mut Self::Movetext,
        comment: RawComment<'_>,
    ) -> ControlFlow<Self::Output> {
        movetext
            .pending_comment
            .push_str(&String::from_utf8_lossy(comment.as_bytes()));
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
        Ok(movetext.finish())
    }
}

pub struct GameInProcessing<'a> {
    headers: Headers,
    encoder: Encoder<'a>,
    annotations: Annotations,
    event: usize,
    pending_comment: String,
    pos: Chess,
    ply: u16,
    /// Saved state for each variation, including the branch point for siblings.
    /// When entering a variation, we push the current position onto the stack
    /// and restore the position to before the last mainline move.
    position_stack: Vec<VariationState>,
    /// The position before the last move was played, needed to branch variations.
    pos_before_last_move: Option<Chess>,
    /// The ply before the last move, for restoring ply in variations.
    ply_before_last_move: u16,
    /// Whether this encoder supports variations (only Low compression).
    supports_variations: bool,
}

struct VariationState {
    pos: Chess,
    ply: u16,
    pos_before_last_move: Option<Chess>,
    ply_before_last_move: u16,
}

impl GameInProcessing<'_> {
    fn new(headers: Headers, level: CompressionLevel) -> Result<Self, String> {
        let initial_fen = headers.fen.clone();
        let pos = match initial_fen.as_deref() {
            Some(fen) => chess_from_fen(fen)
                .map_err(|e| format!("invalid initial FEN '{fen}' in PGN tags: {e}"))?,
            None => Chess::new(),
        };

        Ok(GameInProcessing {
            headers,
            encoder: Encoder::new_with_initial_fen(level, initial_fen.as_deref())
                .map_err(|e| format!("failed to initialize encoder with initial FEN: {e}"))?,
            annotations: Annotations::default(),
            event: 0,
            pending_comment: String::new(),
            pos: pos.clone(),
            ply: 0,
            position_stack: vec![],
            pos_before_last_move: None,
            ply_before_last_move: 0,
            supports_variations: level == CompressionLevel::Low,
        })
    }

    fn finish(mut self) -> StoredGame {
        self.close_variations();
        StoredGame {
            annotations: self.annotations.encode(),
            headers: self.headers,
            movedata: self.encoder.finish().into_bytes(),
            ply_count: self.ply,
        }
    }

    fn play_san(&mut self, san_plus: &SanPlus) -> Result<(), String> {
        let chess_move = san_plus
            .san
            .to_move(&self.pos)
            .map_err(|_| format!("invalid move '{}' at ply {}", san_plus.san, self.ply + 1))?;

        self.pos_before_last_move = Some(self.pos.clone());
        self.ply_before_last_move = self.ply;
        self.pos.play_unchecked(chess_move);
        self.encoder
            .encode_move(chess_move)
            .map_err(|err| format!("failed to encode move: {err}"))?;
        self.ply += 1;
        self.event += 1;

        Ok(())
    }

    fn begin_variation(&mut self) -> bool {
        if !self.supports_variations {
            return false;
        }

        self.encoder.encode_start_variation();
        self.event += 1;
        self.position_stack.push(VariationState {
            pos: self.pos.clone(),
            ply: self.ply,
            pos_before_last_move: self.pos_before_last_move.clone(),
            ply_before_last_move: self.ply_before_last_move,
        });

        if let Some(ref saved_pos) = self.pos_before_last_move {
            self.pos = saved_pos.clone();
            self.ply = self.ply_before_last_move;
        }

        true
    }

    fn end_variation(&mut self) {
        if let Some(saved) = self.position_stack.pop() {
            self.encoder.encode_end_variation();
            self.event += 1;
            self.pos = saved.pos;
            self.ply = saved.ply;
            self.pos_before_last_move = saved.pos_before_last_move;
            self.ply_before_last_move = saved.ply_before_last_move;
        }
    }

    fn close_variations(&mut self) {
        // Import may stop on an invalid move inside a variation. Keep the
        // retained prefix decodable by closing every variation before storing it.
        while !self.position_stack.is_empty() {
            self.end_variation();
        }
    }
}

impl<'a> Visitor for PgnProcessor<'a> {
    type Tags = Headers;
    type Movetext = GameInProcessing<'a>;
    type Output = Result<(), Error>;

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        ControlFlow::Continue(Headers::default())
    }

    fn begin_movetext(&mut self, tags: Self::Tags) -> ControlFlow<Self::Output, Self::Movetext> {
        match GameInProcessing::new(tags, self.level) {
            Ok(game) => ControlFlow::Continue(game),
            Err(error) => ControlFlow::Break(Err(invalid_pgn(error))),
        }
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

                let mut swap =
                    match GameInProcessing::new(Headers::default(), CompressionLevel::Low) {
                        Ok(game) => game,
                        Err(error) => return ControlFlow::Break(Err(invalid_pgn(error))),
                    };

                std::mem::swap(&mut swap, movetext);
                return ControlFlow::Break(self.end_game_inner(swap));
            } else {
                return ControlFlow::Break(Err(invalid_pgn(error_msg)));
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

    fn outcome(
        &mut self,
        movetext: &mut Self::Movetext,
        outcome: shakmaty::Outcome,
    ) -> ControlFlow<Self::Output> {
        let result = outcome.to_string();
        movetext.headers.result = Some(result);
        ControlFlow::Continue(())
    }

    fn nag(&mut self, movetext: &mut Self::Movetext, nag: Nag) -> ControlFlow<Self::Output> {
        movetext
            .annotations
            .push(movetext.event, Annotation::Nag(nag.0));
        ControlFlow::Continue(())
    }

    fn partial_comment(
        &mut self,
        movetext: &mut Self::Movetext,
        comment: RawComment<'_>,
    ) -> ControlFlow<Self::Output> {
        movetext
            .pending_comment
            .push_str(&String::from_utf8_lossy(comment.as_bytes()));
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
        b"TimeControl" => tags.time_control = Some(value.decode_utf8_lossy().into_owned()),
        b"Site" => tags.site = Some(value.decode_utf8_lossy().into_owned()),
        b"WhiteTitle" => tags.white_title = Some(value.decode_utf8_lossy().into_owned()),
        b"BlackTitle" => tags.black_title = Some(value.decode_utf8_lossy().into_owned()),
        b"Event" => tags.event = Some(value.decode_utf8_lossy().into_owned()),
        b"Date" => tags.date = Some(value.decode_utf8_lossy().into_owned()),
        b"Time" => tags.time = Some(value.decode_utf8_lossy().into_owned()),
        b"UTCDate" => tags.utc_date = Some(value.decode_utf8_lossy().into_owned()),
        b"UTCTime" => tags.utc_time = Some(value.decode_utf8_lossy().into_owned()),
        b"FEN" => tags.fen = Some(value.decode_utf8_lossy().into_owned()),
        _ => {}
    };
}

fn apply_comment(movetext: &mut GameInProcessing<'_>, comment: RawComment<'_>) {
    let mut text = std::mem::take(&mut movetext.pending_comment);
    text.push_str(&String::from_utf8_lossy(comment.as_bytes()));
    movetext
        .annotations
        .push(movetext.event, Annotation::Comment(text));
}

impl<'a> PgnProcessor<'a> {
    fn end_game_inner(
        &mut self,
        movetext: <Self as Visitor>::Movetext,
    ) -> <Self as Visitor>::Output {
        let game = movetext.finish();
        if let (Some(cutoff), Some(timestamp)) = (self.timestamp, game.timestamp()) {
            if timestamp <= i64::from(cutoff) * 1_000_000 {
                return Ok(());
            }
        }
        self.appender
            .append_row(appender_params_from_iter(game.database_values()))?;

        self.count += 1;
        if self.count % 10000 == 0 {
            println!("{} done", self.count);
        }
        Ok(())
    }
}

fn invalid_pgn(message: String) -> Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, message).into()
}

pub(super) fn chess_from_fen(fen: &str) -> Result<Chess, String> {
    let parsed = ShakmatyFen::from_ascii(fen.as_bytes()).map_err(|e| e.to_string())?;
    let setup = parsed.as_setup();
    let castling_mode = CastlingMode::detect(setup);
    Chess::from_setup(setup.clone(), castling_mode).map_err(|_| "invalid FEN setup".to_owned())
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
