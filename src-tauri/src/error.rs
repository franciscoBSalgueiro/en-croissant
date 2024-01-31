use shakmaty::Chess;
use specta::Type;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Zip(#[from] zip::result::ZipError),

    #[error(transparent)]
    BincodeEncode(#[from] bincode::error::EncodeError),

    #[error(transparent)]
    BincodeDecode(#[from] bincode::error::DecodeError),

    #[error(transparent)]
    XmlDeserialize(#[from] quick_xml::de::DeError),

    #[error(transparent)]
    ParseInt(#[from] std::num::ParseIntError),

    #[error(transparent)]
    Tauri(#[from] tauri::Error),

    #[error(transparent)]
    TauriApi(#[from] tauri::api::Error),

    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),

    #[error(transparent)]
    ChessPosition(#[from] shakmaty::PositionError<Chess>),

    #[error(transparent)]
    IllegalUci(#[from] shakmaty::uci::IllegalUciError),

    #[error(transparent)]
    ParseUci(#[from] shakmaty::uci::ParseUciError),

    #[error(transparent)]
    Fen(#[from] shakmaty::fen::ParseFenError),

    #[error(transparent)]
    ParseSan(#[from] shakmaty::san::ParseSanError),

    #[error(transparent)]
    IllegalSan(#[from] shakmaty::san::SanError),

    #[error(transparent)]
    Diesel(#[from] diesel::result::Error),

    #[error(transparent)]
    R2d2(#[from] diesel::r2d2::PoolError),

    #[error("No stdin")]
    NoStdin,

    #[error("No stdout")]
    NoStdout,

    #[error("No moves found")]
    NoMovesFound,

    #[error("Lower or upper bound")]
    LowerOrUpperBound,

    #[error("Search stopped")]
    SearchStopped,

    #[error("Missing reference database")]
    MissingReferenceDatabase,

    #[error("No opening found")]
    NoOpeningFound,

    #[error("No match found")]
    NoMatchFound,

    #[error("No puzzles")]
    NoPuzzles,
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

impl Type for Error {
    fn inline(_type_map: &mut specta::TypeMap, _generics: &[specta::DataType]) -> specta::DataType {
        specta::DataType::Primitive(specta::PrimitiveType::String)
    }
}
