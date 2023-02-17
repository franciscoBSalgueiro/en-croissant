use shakmaty::{uci::Uci, san::San, Chess, Position, Square};

pub fn decode_moves(move_blob: Option<Vec<u8>>) -> Result<String, String> {
    if let Some(move_blob) = move_blob {
        let mut chess = Chess::default();
        let mut moves = Vec::new();
        let mut i = 0;
        while i < move_blob.len() {
            let from = move_blob[i] & 0b00111111;
            let dest = (move_blob[i] & 0b11000000) >> 6 | (move_blob[i + 1] & 0b00001111) << 2;
            let promotion = (move_blob[i + 1] & 0b11110000) >> 4;
            let uci = Uci::Normal {
                from: Square::new(from.into()),
                to: Square::new(dest.into()),
                promotion: match promotion {
                    0 => None,
                    2 => Some(shakmaty::Role::Knight),
                    3 => Some(shakmaty::Role::Bishop),
                    4 => Some(shakmaty::Role::Rook),
                    5 => Some(shakmaty::Role::Queen),
                    _ => {
                        dbg!(i, from, dest, promotion);
                        return Err("Invalid promotion".to_string())
                    },
                },
            };
            let m = uci.to_move(&chess).or(Err("Invalid move".to_string()))?;
            let san = San::from_move(&chess, &m);
            chess.play_unchecked(&m);
            moves.push(san.to_string());
            i += 2;
        }
        Ok(moves.join(" "))
    } else {
        Ok(String::new())
    }
}
