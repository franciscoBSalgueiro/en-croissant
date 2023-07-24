use shakmaty::{san::SanPlus, Chess, Move, Position};

pub fn encode_move(m: &Move, chess: &Chess) -> Result<u8, String> {
    let moves = chess.legal_moves();
    Ok(moves.iter().position(|x| x == m).unwrap() as u8)
}

pub fn decode_move(byte: u8, chess: &Chess) -> Option<Move> {
    let legal_moves = chess.legal_moves();
    legal_moves.get(byte as usize).cloned()
}

pub fn decode_moves(moves_bytes: Vec<u8>) -> Result<String, String> {
    let mut chess = Chess::default();
    let mut moves = Vec::new();
    for byte in moves_bytes {
        let m = decode_move(byte, &chess).unwrap();
        let san = SanPlus::from_move_and_play_unchecked(&mut chess, &m);
        moves.push(san.to_string());
    }
    Ok(moves.join(" "))
}
