use shakmaty::{
    fen::Fen, ByColor, Chess, FromSetup, Position, PositionError, Board
};
use pgn_reader::{Nag, RawComment, RawHeader, SanPlus, Skip, Visitor};
use chrono::{NaiveDate, NaiveTime};
use crate::error::{Error, Result};

pub type MaterialCount = ByColor<u8>;

pub fn get_material_count(board: &Board) -> MaterialCount {
    board.material().map(|material| {
        material.pawn
            + material.knight * 3
            + material.bishop * 3
            + material.rook * 5
            + material.queen * 9
    })
}

#[derive(Debug, PartialEq, Eq)]
pub enum GameTreeNode {
    Move(SanPlus),
    Comment(String),
    Nag(Nag),
    Variation(GameTree)
}

#[derive(Debug, PartialEq, Eq, Default)]
pub struct GameTree(Vec<GameTreeNode>);

impl GameTree {
    const START_VARIATION: u8 = 254;
    const END_VARIATION: u8 = 253;
    const COMMENT: u8 = 252;
    const NAG: u8 = 251; 


    pub fn new() -> Self {
        GameTree::default()
    }

    pub fn push(&mut self, node: GameTreeNode) {
        self.0.push(node);
    }
 
    pub fn encode(&self, bytes: &mut Vec<u8>, position: Option<Chess>) {
        let mut cur_position = position.unwrap_or_default();
        let mut prev_position = cur_position.clone();
        
        for item in &self.0 {
            match item {
                GameTreeNode::Move(m) => {
                    if let Ok(m) = m.san.to_move(&cur_position) {
                        if let Some(pos) = cur_position.legal_moves().iter().position(|x| x.eq(&m)) {
                            bytes.push(pos as u8);
                        }
                        prev_position = cur_position.clone();
                        cur_position.play_unchecked(&m);
                    }
                },
                GameTreeNode::Nag(nag) => {
                    bytes.push(Self::NAG);
                    bytes.push(nag.0);
                },
                GameTreeNode::Comment(comment) => {
                    bytes.push(Self::COMMENT);
                    bytes.extend((comment.len() as u64).to_be_bytes());
                    bytes.extend(comment.as_bytes());
                },
                GameTreeNode::Variation(branch) => {
                    bytes.push(Self::START_VARIATION);
                    branch.encode(bytes, Some(prev_position.clone()));
                    bytes.push(Self::END_VARIATION);
                }
            }
        }
    }

    fn from_bytes_impl(mut bytes: &[u8], position: Chess) -> Result<(Vec<GameTreeNode>, &[u8])> {
        let mut prev_position: Chess = position.clone();
        let mut cur_position: Chess = position;
        let mut tree: Vec<GameTreeNode> = Vec::new();

        loop {
            match bytes.first().copied() {
                Some(Self::NAG) => {
                    tree.push(GameTreeNode::Nag(Nag(bytes[1])));
                    bytes = &bytes[2..];
                },
                Some(Self::COMMENT) => {
                    let length = u64::from_be_bytes(bytes[1..].first_chunk::<8>().ok_or(Error::InvalidBinaryData)?.to_owned()) as usize;
                    tree.push(GameTreeNode::Comment(String::from_utf8(bytes[9..9+length].to_owned())?));
                    bytes = &bytes[9+length..];
                },
                Some(Self::END_VARIATION) => {
                    bytes = &bytes[1..];
                    break;
                },
                Some(Self::START_VARIATION) => {
                    let (branch, rest) = Self::from_bytes_impl(&bytes[1..], prev_position.clone())?;
                    tree.push(GameTreeNode::Variation(GameTree(branch)));
                    bytes = rest;
                },
                Some(byte) => {
                    if let Some(m) = cur_position.legal_moves().get(byte as usize) {
                        prev_position = cur_position.clone();
                        let san = SanPlus::from_move_and_play_unchecked(&mut cur_position, m);
                        tree.push(GameTreeNode::Move(san));
                        bytes = &bytes[1..];
                    } else {
                        panic!("Invalid move");
                    }
                },
                None => {
                    break;
                }
            } 

        }

        Ok((tree, bytes))
    }

    pub fn from_bytes(bytes: &[u8], position: Option<Chess>) -> Result<Self> {
        Ok(Self(Self::from_bytes_impl(bytes, position.unwrap_or_default())?.0))
    }

    pub fn pretty_print(&self, writer: &mut std::fmt::Formatter<'_>, position: Option<Chess>) -> Result<()> {
        let mut cur_position = position.unwrap_or_default();
        let mut prev_position = cur_position.clone();

        let mut is_beginning = true;
        
        for item in &self.0 {
            match item {
                GameTreeNode::Move(m) => {
                    let i = cur_position.fullmoves().get();
                    
                    if is_beginning {
                        is_beginning = false;
                        
                        if cur_position.turn().is_white() {
                            write!(writer, "{}.{}", i, m)?;
                        } else {
                            write!(writer, "{}...{}", i, m)?;
                        }
                    } else if cur_position.turn().is_white() {
                        write!(writer, " {}.{}", i, m)?;
                    } else {
                        write!(writer, " {}", m)?;
                    }

                    prev_position = cur_position.clone();
                    cur_position.play_unchecked(&m.san.to_move(&cur_position)?);
                },
                GameTreeNode::Nag(nag) => {
                    write!(writer, " {}", nag)?;

                },
                GameTreeNode::Comment(comment) => {
                    write!(writer, " {{{}}} ", comment)?;
                },
                GameTreeNode::Variation(branch) => {
                    writer.write_str(" ( ")?;
                    branch.pretty_print(writer,  Some(prev_position.clone()))?;
                    writer.write_str(" ) ")?;
                    is_beginning = true;
                }
            };
        }
        
        Ok(())
    }
}

impl std::fmt::Display for GameTree {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.pretty_print(f, None) {
            Ok(()) => Ok(()),
            Err(Error::FormatError(err)) => Err(err),
            Err(_) => {
                write!(f, "Invalid game tree")?;
                Ok(())
            }
        }
    }
}


#[derive(Default, Debug)]
pub struct TempGame {
    pub event_name: Option<String>,
    pub site_name: Option<String>,
    pub date: Option<String>,
    pub time: Option<String>,
    pub round: Option<String>,
    pub white_name: Option<String>,
    pub white_elo: Option<i32>,
    pub black_name: Option<String>,
    pub black_elo: Option<i32>,
    pub result: Option<String>,
    pub time_control: Option<String>,
    pub eco: Option<String>,
    pub fen: Option<String>,
    pub moves: Vec<u8>,
    pub position: Chess,
    pub material_count: ByColor<u8>,
    pub tree: GameTree,
}

pub struct Importer {
    game: TempGame,
    variants: Vec<GameTree>,
    timestamp: Option<i64>,
    skip: bool,
}


impl Importer {
    pub fn new(timestamp: Option<i64>) -> Self {
        Importer {
            game: TempGame::default(),
            variants: Vec::new(),
            timestamp,
            skip: false,
        }
    }

    #[inline]
    #[must_use]
    fn active_branch(&mut self) -> &mut GameTree {
        self.variants.last_mut().unwrap_or(&mut self.game.tree)
    }
}

impl Visitor for Importer {
    type Result = Option<TempGame>;

    fn begin_game(&mut self) {
        self.skip = false;
    }

    fn header(&mut self, key: &[u8], value: RawHeader<'_>) {
        if key == b"White" {
            self.game.white_name = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Black" {
            self.game.black_name = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"WhiteElo" {
            self.game.white_elo = btoi::btoi(value.as_bytes()).ok();
        } else if key == b"BlackElo" {
            self.game.black_elo = btoi::btoi(value.as_bytes()).ok();
        } else if key == b"TimeControl" {
            self.game.time_control = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"ECO" {
            self.game.eco = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Round" {
            self.game.round = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Date" || key == b"UTCDate" {
            self.game.date = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"UTCTime" {
            self.game.time = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"Site" {
            self.game.site_name = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"Event" {
            self.game.event_name = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"Result" {
            self.game.result = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"FEN" {
            if value.as_bytes() == b"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" {
                self.game.fen = None;
            } else {
                let fen = Fen::from_ascii(value.as_bytes());
                if let Ok(fen) = fen {
                    self.game.fen = Some(value.decode_utf8_lossy().into_owned());
                    if let Ok(setup) =
                        Chess::from_setup(fen.into_setup(), shakmaty::CastlingMode::Standard)
                            .or_else(PositionError::ignore_too_much_material)
                    {
                        self.game.position = setup;
                    } else {
                        self.skip = true;
                    }
                } else {
                    self.skip = true;
                }
            }
        }
    }

    fn end_headers(&mut self) -> Skip {
        // Skip games with timestamp before
        let cur_timestamp = self.game.date.as_ref().and_then(|date| {
            let date = NaiveDate::parse_from_str(date, "%Y.%m.%d").ok()?;
            let time = self
                .game
                .time
                .as_ref()
                .and_then(|time| NaiveTime::parse_from_str(time, "%H:%M:%S").ok())?;
            Some(date.and_time(time).and_utc().timestamp())
        });

        if let (Some(cur_timestamp), Some(timestamp)) = (cur_timestamp, self.timestamp) {
            if cur_timestamp <= timestamp {
                self.skip = true;
            }
        }

        // Skip games without ELO
        // self.skip |= self.current.white_elo.is_none() || self.current.black_elo.is_none();
        Skip(self.skip)
    }

    fn san(&mut self, san: SanPlus) {
        self.active_branch().push(GameTreeNode::Move(san));
    }

    fn comment(&mut self, comment: RawComment<'_>) {
        if let Ok(comment) = String::from_utf8(comment.as_bytes().to_owned()) {
            self.active_branch().push(GameTreeNode::Comment(comment));
        }
    }

    fn nag(&mut self, nag: Nag) {
        self.active_branch().push(GameTreeNode::Nag(nag));
    }

    fn begin_variation(&mut self) -> Skip {
        self.variants.push(GameTree::new());
        Skip(false)
    }

    fn end_variation(&mut self) {
        if let Some(variation) = self.variants.pop() {
            self.variants.last_mut().unwrap_or(&mut self.game.tree).push(GameTreeNode::Variation(variation));
        }
    }

    fn end_game(&mut self) -> Self::Result {
        if self.skip {
            self.game = TempGame::default();
            None
        } else {
            // encode game tree 
            self.game.tree.encode(&mut self.game.moves, Some(self.game.position.clone()));

            // calc material
            let mut cur_position = self.game.position.clone();
            for item in &self.game.tree.0 {
                if let GameTreeNode::Move(san) = item {
                    if let Ok(m) = san.san.to_move(&cur_position) {
                        cur_position.play_unchecked(&m);
                    } else {
                        // Invalid game
                        self.game = TempGame::default();
                        return None;
                    }
                }
            }
            self.game.material_count = get_material_count(cur_position.board());
            
            Some(std::mem::take(&mut self.game))
        }
    }
}


#[cfg(test)]
mod test {
    use super::*;
    use regex::Regex;
    use pgn_reader::BufferedReader;


    fn trim(s: &str) -> String {
        let re = Regex::new(r"\s+").unwrap();
        re.replace_all(s, " ").to_string()
    }

    #[test]
    fn test_simple_pgn() {
        let pgns = [
            "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O b5 6.Bb3 Bc5",            
            "1.e4 e5 2.Nf3 ( 2.Bc4 c6 ) 2...Nc6 $1 {I like this move} "
        ];

        for pgn in pgns {
            let mut reader = BufferedReader::new_cursor(&pgn[..]);

            let mut importer = Importer::new(None);
            let game = reader.read_game(&mut importer).unwrap().flatten().unwrap();

            let mut bytes: Vec<u8> = Vec::new();

            game.tree.encode(&mut bytes, None);

            assert_eq!(
                game.tree,
                GameTree::from_bytes(&bytes, None).unwrap()
            );
            assert_eq!(game.tree.to_string(), pgn);
        }
    }

    #[test]
    fn test_pgn_with_many_variations() {
        let pgn = "1.e4 Nf6 2.e5 Nd5 3.d4 d6 
    ( 3...Nb6 4.c4 d5 5.c5 N6d7 6.Nc3 e6 7.b4 )
4.c4 Nb6 5.f4 dxe5 
    ( 5...g6 6.Nc3 Bg7 7.Be3 dxe5 
        ( 7...O-O 8.c5 N6d7 9.h4 h5 10.Nf3 )
        ( 7...Be6 8.d5 Bc8 
            ( 8...Bf5 9.Nf3 O-O 10.h3 c6 11.Be2 Na6 12.g4 Bd7 13.O-O cxd5 
            14.cxd5 Rc8 15.Qd2 Nc4 16.Bxc4 Rxc4 17.Rae1 )
        9.Nf3 O-O 
            ( 9...c6 )
        10.Be2 e6 
            ( 10...Bg4 11.h4 Bxf3 12.gxf3 dxe5 13.fxe5 Bxe5 14.Qc2 Bg3+ 
            15.Kf1 )
        11.O-O exd5 12.cxd5 Re8 13.a4 dxe5 14.fxe5 Bxe5 15.Nxe5 Rxe5 16.Qd4 )
    8.dxe5 Qxd1+ 9.Rxd1 c6 10.c5 N6d7 11.Nf3 )
    ( 5...c5 6.dxc5 dxc5 
        ( 6...N6d7 7.cxd6 exd6 8.exd6 Nf6 9.Qe2+ Be6 10.Nc3 g6 11.f5 gxf5 
        12.Bg5 )
    7.Qxd8+ Kxd8 8.Nc3 )
6.fxe5 Nc6 
    ( 6...Bf5 7.Nc3 e6 8.Nf3 Be7 
        ( 8...Bb4 9.Bd3 Bxd3 
            ( 9...c5 10.Bg5 f6 
                ( 10...Qd7 11.Bxf5 cxd4 12.Nxd4 exf5 13.Nxf5 Qxd1+ 14.Rxd1 O-O 15.O-O Nxc4 16.Nd5 )
            11.exf6 gxf6 12.Bxf5 exf5 13.Bh6 )
        10.Qxd3 c5 11.O-O cxd4 12.Ne4 N8d7 13.c5 Bxc5 14.Nfg5 )
    9.Be3 O-O 10.Bd3 )
    ( 6...g6 7.Nc3 Bg7 8.c5 Nd5 9.Bc4 Nxc3 
        ( 9...c6 10.Qb3 O-O 11.Nf3 )
    10.bxc3 O-O 11.h4 h5 12.Nf3 )
    ( 6...c5 7.d5 e6 
        ( 7...g6 8.Nc3 Bg7 9.Bf4 O-O 10.Qd2 e6 11.O-O-O exd5 12.cxd5 Bg4 )
    8.Nc3 exd5 9.cxd5 Qh4+ 
        ( 9...c4 10.d6 Be6 
            ( 10...f6 11.Nf3 fxe5 
                ( 11...Nc6 12.Nb5 )
            12.Nb5 )
        11.Nf3 Nc6 12.Bg5 )
    10.g3 Qd4 11.Bb5+ Bd7 12.Qe2 Nxd5 13.e6 fxe6 14.Qxe6+ Ne7 15.Nf3 )
7.Be3 Bf5 
    ( 7...g6 8.Nc3 Bg7 9.Be2 O-O 10.Nf3 f6 
        ( 10...Bg4 11.O-O f6 
            ( 11...Na5 12.b3 c5 13.dxc5 Nd7 14.Nd4 Bxe2 15.Qxe2 Bxe5 16.Rad1 )
        12.exf6 exf6 13.h3 )
    11.Qb3 )
8.Nc3 e6 
    ( 8...Qd7 9.Nf3 Bg4 10.d5 Bxf3 11.e6 Bxd1 
        ( 11...fxe6 12.Qxf3 )
    12.exd7+ Nxd7 13.dxc6 )
9.Nf3 Be7 
    ( 9...Bb4 10.Be2 Na5 
        ( 10...O-O 11.O-O Na5 12.c5 Bxc3 13.bxc3 Nd5 )
    11.c5 Nd5 
        ( 11...Nbc4 12.Qa4+ c6 13.Bd2 Nxd2 14.Qxb4 )
    12.Bd2 Bxc3 
        ( 12...Nc6 13.O-O O-O 14.Bg5 f6 15.exf6 gxf6 16.Nxd5 fxg5 17.Nxb4 
        Nxb4 18.Qd2 )
    13.bxc3 Nc6 14.O-O O-O 15.Qe1 b6 16.Bb5 Nde7 17.Bg5 )
    ( 9...Qd7 10.Be2 O-O-O 
        ( 10...Rd8 11.Qd2 Bg4 12.Rd1 Bxf3 13.gxf3 )
    11.O-O Bg4 
        ( 11...Be7 12.d5 exd5 13.Bxb6 axb6 14.cxd5 Bc5+ 15.Kh1 Nb4 16.Nd4 
        Bxd4 17.Qxd4 Nc2 18.Qc4 Nxa1 19.Rxf5 )
        ( 11...Kb8 12.a4 a5 13.Qb3 )
        ( 11...f6 12.d5 exd5 13.Bxb6 axb6 14.cxd5 Bc5+ 15.Kh1 Nb4 16.Nd4 
        Bxd4 17.Qxd4 Nc2 18.Qh4 Nxa1 19.Rxf5 )
    12.c5 Nd5 13.Nxd5 Qxd5 14.b4 Qe4 15.Qd2 Nxd4 16.Nxd4 Bxe2 17.Rxf7 Qxe5
        ( 17...Qg6 18.Qxe2 Qxf7 19.c6 )
    18.Qxe2 Rxd4 19.Re1 Rd8 20.Bf4 )
    ( 9...Bg4 10.Be2 Bxf3 11.gxf3 Qh4+ 12.Bf2 Qf4 13.c5 Nd5 
        ( 13...Nd7 14.Qc1 Qxc1+ 15.Rxc1 )
    14.Nxd5 exd5 )
    ( 9...Nb4 10.Rc1 c5 11.Qb3 cxd4 12.Nxd4 Nd3+ 13.Bxd3 Bxd3 14.Ncb5 a6 
    15.Rd1 Bxc4 16.Nxe6 )
10.Be2 O-O 
    ( 10...f6 11.O-O fxe5 12.d5 Nb4 13.g4 Bxg4 14.a3 Na6 15.Nxe5 )
11.O-O f6 12.exf6 Bxf6 13.Qd2 Qe7 
    ( 13...Qe8 14.Bg5 )
    ( 13...Qd7 14.Rad1 Rad8 15.Kh1 )
14.Rad1 Rad8 15.Kh1 h6 
    ( 15...e5 16.d5 Nd4 17.Nxd4 exd4 18.Bxd4 Bg5 19.Qe1 )
    ( 15...Bg4 16.Ne4 Bxf3 17.Nxf6+ Rxf6 18.gxf3 Qf7 19.b3 )
    ( 15...Bg6 16.Qc1 e5 17.d5 Nd4 18.Nxd4 exd4 19.Bxd4 Bg5 20.Qa1 c5 21.Bg1 )
    ( 15...Rd7 16.h3 Rfd8 17.g4 Bg6 18.c5 )
    ( 15...Bxd4 16.Nxd4 Nxd4 17.Bg5 Rf6 18.Bxf6 gxf6 )
16.h3 Rd7 17.Bg1 Bxd4 
    ( 17...Rfd8 18.c5 Nd5 19.Bb5 )
    ( 17...Nxd4 18.Bxd4 e5 19.Bxb6 Rxd2 20.Nxd2 )
18.Bxd4 e5 19.Nxe5 Nxe5 20.c5 Nc6 
    ( 20...Nbc4 21.Qe1 Nxb2 22.Bxe5 Qxe5 
        ( 22...Nxd1 23.Bxd1 Qxc5 24.Bb3+ Kh7 25.Ne4 )
    23.Rxd7 Bxd7 24.Rxf8+ Kxf8 25.Qd2 )
21.Qe3 Nxd4 22.Qxe7 Rxe7 23.Rxd4 Nd7 24.Bc4+ Kh7 25.Kh2 Ne5 26.Bb3 Ng6 27.h4 Be6 28.Rxf8 Nxf8 29.Bc2+ Kg8 30.Ra4 a6 31.c6 b5 32.Rxa6 b4";

        let mut reader = BufferedReader::new_cursor(&pgn[..]);

        let mut importer = Importer::new(None);
        let game = reader.read_game(&mut importer).unwrap().flatten().unwrap();

        let mut bytes: Vec<u8> = Vec::new();
        game.tree.encode(&mut bytes, None);

        assert_eq!(
            game.tree,
            GameTree::from_bytes(&bytes, None).unwrap()
        );
        assert_eq!(trim(&game.tree.to_string()), trim(pgn));
    }
}
