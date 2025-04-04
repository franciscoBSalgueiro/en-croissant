use shakmaty::{
    fen::Fen, san::SanPlus, CastlingMode, Chess, FromSetup, Move, Position, PositionError,
};


pub fn decode_move(byte: u8, chess: &Chess) -> Option<Move> {
    let legal_moves = chess.legal_moves();
    legal_moves.get(byte as usize).cloned()
}
