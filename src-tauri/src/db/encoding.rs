use crate::error::Error;
use shakmaty::{
    fen::Fen, san::SanPlus, CastlingMode, Chess, FromSetup, Move, Position, PositionError,
};

pub fn encode_move(m: &Move, chess: &Chess) -> Result<u8, Error> {
    let moves = chess.legal_moves();
    Ok(moves.iter().position(|x| x == m).unwrap() as u8)
}

pub fn decode_move(byte: u8, chess: &Chess) -> Option<Move> {
    let legal_moves = chess.legal_moves();
    legal_moves.get(byte as usize).cloned()
}

pub fn decode_moves(moves_bytes: Vec<u8>, initial_fen: Fen) -> Result<Vec<String>, Error> {
    let mut chess = Chess::from_setup(initial_fen.into(), CastlingMode::Chess960)
        .or_else(PositionError::ignore_too_much_material)
        .unwrap();
    let mut moves = Vec::new();
    for byte in moves_bytes {
        let m = decode_move(byte, &chess).unwrap();
        let san = SanPlus::from_move_and_play_unchecked(&mut chess, &m);
        moves.push(san.to_string());
    }
    Ok(moves)
}

#[cfg(test)]
mod tests {
    use super::*;

    use shakmaty::{Role, Square};

    #[test]
    fn test_encoding() {
        let mut chess = Chess::default();
        let m = Move::Normal {
            role: Role::Pawn,
            from: Square::E2,
            to: Square::E4,
            capture: None,
            promotion: None,
        };

        let byte = encode_move(&m, &chess).unwrap();
        let m2 = decode_move(byte, &chess).unwrap();
        assert_eq!(m, m2);

        chess.play_unchecked(&m);

        let m = Move::Normal {
            role: Role::Pawn,
            from: Square::E7,
            to: Square::E5,
            capture: None,
            promotion: None,
        };
        let byte = encode_move(&m, &chess).unwrap();
        let m2 = decode_move(byte, &chess).unwrap();
        assert_eq!(m, m2);
    }
}
