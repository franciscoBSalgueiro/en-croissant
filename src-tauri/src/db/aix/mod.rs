//! The SQL functions of the aixchess DuckDB extension that En Croissant uses,
//! registered directly on the connection. Used where the extension (a dynamic
//! library) can't be loaded – iOS and Android.

#![allow(dead_code)]

mod scoutfish;
mod subfen;

use duckdb::{
    core::{DataChunkHandle, Inserter, LogicalTypeId},
    ffi::duckdb_string_t,
    types::DuckString,
    vscalar::{ScalarFunctionSignature, VScalar},
    vtab::arrow::WritableVector,
    Connection,
};

/// Types that the vendored modules expect (the extension's FFI bridge, without diplomat).
pub(crate) mod ffi {
    #[derive(Debug)]
    pub enum ScoutfishQueryParseError {
        InvalidPiece = 1,
        InvalidImbalanceFormat = 2,
        InvalidMaterialFormat = 3,
        InvalidSideToMove = 4,
        InvalidSan = 5,
        InvalidSyntaxOrStructure = 6,
        BincodeError = 7,
        BufferTooSmall = 8,
        CursorWriteError = 9,
    }

    #[derive(Debug)]
    pub enum DecodeError {
        NoErrorNoValue = 0,
        EmptyBlob = 1,
        InvalidCompressionLevel = 2,
        InvalidEncodedGameConstructionData = 3,
        InvalidDataDuringDecoding = 4,
    }

    #[derive(Clone, Copy)]
    pub struct Subfen {
        pub white: u64,
        pub black: u64,
        pub king: u64,
        pub queen: u64,
        pub rook: u64,
        pub bishop: u64,
        pub knight: u64,
        pub pawn: u64,
    }

    #[derive(Clone, Copy)]
    pub struct Fen {
        pub white: u64,
        pub black: u64,
        pub king: u64,
        pub queen: u64,
        pub rook: u64,
        pub bishop: u64,
        pub knight: u64,
        pub pawn: u64,
        pub white_to_move: bool,
        pub castling_rights: u64,
        pub ep_square: i8,
    }
}

impl From<aix_chess_compression::DecodeError> for ffi::DecodeError {
    fn from(_: aix_chess_compression::DecodeError) -> Self {
        ffi::DecodeError::InvalidDataDuringDecoding
    }
}

impl From<aix_chess_compression::EncodedGameConstructionError> for ffi::DecodeError {
    fn from(e: aix_chess_compression::EncodedGameConstructionError) -> Self {
        use aix_chess_compression::EncodedGameConstructionError as E;
        match e {
            E::EmptyData => ffi::DecodeError::EmptyBlob,
            E::InvalidCompressionLevel => ffi::DecodeError::InvalidCompressionLevel,
            E::InvalidData => ffi::DecodeError::InvalidEncodedGameConstructionData,
        }
    }
}

const STANDARD_START: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type BoxError = Box<dyn std::error::Error>;

/// Reads row `i` of a flat VARCHAR/BLOB column (None for NULL).
struct Column<'a> {
    vector: duckdb::core::FlatVector<'a>,
    data: &'a [duckdb_string_t],
}

impl<'a> Column<'a> {
    fn new(input: &'a DataChunkHandle, idx: usize) -> Self {
        let vector = input.flat_vector(idx);
        let data = unsafe { vector.as_slice_with_len::<duckdb_string_t>(input.len()) };
        // SAFETY: the slice borrows the chunk's memory, which outlives this struct.
        let data = unsafe { std::mem::transmute::<&[duckdb_string_t], &'a [duckdb_string_t]>(data) };
        Self { vector, data }
    }

    fn bytes(&self, i: usize) -> Option<Vec<u8>> {
        if self.vector.row_is_null(i as u64) {
            return None;
        }
        let mut s = self.data[i];
        Some(DuckString::new(&mut s).as_bytes().to_vec())
    }

    fn string(&self, i: usize) -> Option<String> {
        self.bytes(i).map(|b| String::from_utf8_lossy(&b).into_owned())
    }
}

/// The game's start position: NULL (or the standard start) means "normal game".
fn start_fen(s: &Option<String>) -> Option<&str> {
    match s.as_deref() {
        None | Some("") => None,
        Some(f) if f == STANDARD_START => None,
        Some(f) => Some(f),
    }
}

fn three_varchar_like(ret: LogicalTypeId) -> Vec<ScalarFunctionSignature> {
    vec![
        ScalarFunctionSignature::exact(
            vec![LogicalTypeId::Blob.into(), LogicalTypeId::Varchar.into()],
            ret.into(),
        ),
        ScalarFunctionSignature::exact(
            vec![
                LogicalTypeId::Blob.into(),
                LogicalTypeId::Varchar.into(),
                LogicalTypeId::Varchar.into(),
            ],
            ret.into(),
        ),
    ]
}

/// `matches_fen(movedata, fen[, start_fen]) -> BOOLEAN`
struct MatchesFen;

impl VScalar for MatchesFen {
    type State = ();

    fn invoke(
        _: &(),
        input: &mut DataChunkHandle,
        output: &mut dyn WritableVector,
    ) -> Result<(), BoxError> {
        let rows = input.len();
        let games = Column::new(input, 0);
        let fens = Column::new(input, 1);
        let starts = (input.num_columns() > 2).then(|| Column::new(input, 2));
        let mut out = output.flat_vector();
        let mut cached: Option<(String, ffi::Fen)> = None;
        for i in 0..rows {
            let (Some(game), Some(fen)) = (games.bytes(i), fens.string(i)) else {
                out.set_null(i);
                continue;
            };
            if cached.as_ref().map(|(f, _)| f != &fen).unwrap_or(true) {
                let parsed = subfen::try_parse_fen(fen.as_bytes())
                    .map_err(|_| format!("matches_fen: failed to parse fen '{fen}'"))?;
                cached = Some((fen.clone(), parsed));
            }
            let target = cached.as_ref().unwrap().1;
            let start = starts.as_ref().and_then(|c| c.string(i));
            let result = subfen::matches_fen_with_initial_fen(target, &game, start_fen(&start));
            let value = match result {
                Ok(v) => v,
                Err(ffi::DecodeError::NoErrorNoValue) => false,
                Err(e) => return Err(format!("matches_fen: invalid movedata ({e:?})").into()),
            };
            unsafe { out.as_mut_slice::<bool>()[i] = value };
        }
        Ok(())
    }

    fn signatures() -> Vec<ScalarFunctionSignature> {
        three_varchar_like(LogicalTypeId::Boolean)
    }
}

/// `next_move_at_fen(movedata, fen[, start_fen]) -> VARCHAR` (UCI move, `*` = game ended there)
struct NextMoveAtFen;

impl VScalar for NextMoveAtFen {
    type State = ();

    fn invoke(
        _: &(),
        input: &mut DataChunkHandle,
        output: &mut dyn WritableVector,
    ) -> Result<(), BoxError> {
        let rows = input.len();
        let games = Column::new(input, 0);
        let fens = Column::new(input, 1);
        let starts = (input.num_columns() > 2).then(|| Column::new(input, 2));
        let mut out = output.flat_vector();
        let mut cached: Option<(String, ffi::Fen)> = None;
        for i in 0..rows {
            let (Some(game), Some(fen)) = (games.bytes(i), fens.string(i)) else {
                out.set_null(i);
                continue;
            };
            if cached.as_ref().map(|(f, _)| f != &fen).unwrap_or(true) {
                let parsed = subfen::try_parse_fen(fen.as_bytes())
                    .map_err(|_| format!("next_move_at_fen: failed to parse fen '{fen}'"))?;
                cached = Some((fen.clone(), parsed));
            }
            let target = cached.as_ref().unwrap().1;
            let start = starts.as_ref().and_then(|c| c.string(i));
            match subfen::next_move_at_fen(&target, &game, start_fen(&start)) {
                Ok(0) => out.insert(i, "*"),
                Ok(next) => {
                    let code = next - 1;
                    let (from, to, promotion) = (code & 63, (code >> 6) & 63, code >> 12);
                    let mut uci = String::with_capacity(5);
                    uci.push((b'a' + (from % 8) as u8) as char);
                    uci.push((b'1' + (from / 8) as u8) as char);
                    uci.push((b'a' + (to % 8) as u8) as char);
                    uci.push((b'1' + (to / 8) as u8) as char);
                    if promotion != 0 {
                        uci.push(promotion as u8 as char);
                    }
                    out.insert(i, uci.as_str());
                }
                Err(ffi::DecodeError::NoErrorNoValue) => out.set_null(i),
                Err(e) => {
                    return Err(format!("next_move_at_fen: invalid movedata ({e:?})").into())
                }
            }
        }
        Ok(())
    }

    fn signatures() -> Vec<ScalarFunctionSignature> {
        three_varchar_like(LogicalTypeId::Varchar)
    }
}

/// `scoutfish_query(movedata, query_json[, start_fen]) -> BOOLEAN`
struct ScoutfishQuery;

impl VScalar for ScoutfishQuery {
    type State = ();

    fn invoke(
        _: &(),
        input: &mut DataChunkHandle,
        output: &mut dyn WritableVector,
    ) -> Result<(), BoxError> {
        let rows = input.len();
        let games = Column::new(input, 0);
        let queries = Column::new(input, 1);
        let starts = (input.num_columns() > 2).then(|| Column::new(input, 2));
        let mut out = output.flat_vector();
        let mut cached: Option<(String, scoutfish::Query)> = None;
        for i in 0..rows {
            let (Some(game), Some(query)) = (games.bytes(i), queries.string(i)) else {
                out.set_null(i);
                continue;
            };
            if cached.as_ref().map(|(q, _)| q != &query).unwrap_or(true) {
                let parsed = scoutfish::Query::parse(query.as_bytes())
                    .map_err(|e| format!("scoutfish_query: invalid query ({e:?})"))?;
                cached = Some((query.clone(), parsed));
            }
            let start = starts.as_ref().and_then(|c| c.string(i));
            let encoded = aix_chess_compression::EncodedGame::from_bytes(&game)
                .map_err(|e| format!("scoutfish_query: invalid movedata ({e:?})"))?;
            let value = match cached
                .as_ref()
                .unwrap()
                .1
                .apply_with_initial_fen(&encoded, false, start_fen(&start))
            {
                Ok((v, _)) => v,
                Err(ffi::DecodeError::NoErrorNoValue) => false,
                Err(e) => return Err(format!("scoutfish_query: invalid movedata ({e:?})").into()),
            };
            unsafe { out.as_mut_slice::<bool>()[i] = value };
        }
        Ok(())
    }

    fn signatures() -> Vec<ScalarFunctionSignature> {
        three_varchar_like(LogicalTypeId::Boolean)
    }
}

/// Registers the functions on a connection (instead of `LOAD aixchess`).
pub fn register_functions(conn: &Connection) -> duckdb::Result<()> {
    conn.register_scalar_function::<MatchesFen>("matches_fen")?;
    conn.register_scalar_function::<NextMoveAtFen>("next_move_at_fen")?;
    conn.register_scalar_function::<ScoutfishQuery>("scoutfish_query")?;
    Ok(())
}
