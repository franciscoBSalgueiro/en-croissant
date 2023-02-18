use shakmaty::{san::San, uci::Uci, Chess, Position, Square};

fn decode_2byte_move(move_bytes: &[u8]) -> Result<Uci, String> {
    let from = move_bytes[0] & 0b00111111;
    let dest = (move_bytes[0] & 0b11000000) >> 6 | (move_bytes[1] & 0b00001111) << 2;
    let promotion = (move_bytes[1] & 0b11110000) >> 4;
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
                return Err("Invalid promotion".to_string());
            }
        },
    };
    Ok(uci)
}

pub fn decode_moves(moves_bytes: Option<Vec<u8>>) -> Result<String, String> {
    if let Some(move_blob) = moves_bytes {
        let mut chess = Chess::default();
        let mut moves = Vec::new();
        let mut i = 0;
        while i < move_blob.len() {
            let uci = decode_2byte_move(&move_blob[i..i + 2])?;
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

pub fn position_search(move_blob: &Option<Vec<u8>>, test_position: &Chess) -> Result<bool, String> {
    if let Some(move_blob) = move_blob {
        let mut chess = Chess::default();
        let mut i = 0;
        while i < move_blob.len() {
            let uci = decode_2byte_move(&move_blob[i..i + 2])?;
            let m = uci.to_move(&chess).or(Err("Invalid move".to_string()))?;
            chess.play_unchecked(&m);
            if chess == *test_position {
                return Ok(true);
            }
            i += 2;
        }
    }
    Ok(false)
}
