use pgn_reader::SanPlus;
use shakmaty::{san::San, uci::Uci, Chess, Move, Position, Square};

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

fn encode_2byte_move(m: &Move) -> Result<Vec<u8>, String> {
    let mut move_bytes = Vec::new();
    let from = m.from().unwrap().file() as u8 | (m.from().unwrap().rank() as u8) << 3;
    let dest = m.to().file() as u8 | (m.to().rank() as u8) << 3;
    let promotion = match m.promotion() {
        None => 0,
        Some(shakmaty::Role::Knight) => 2,
        Some(shakmaty::Role::Bishop) => 3,
        Some(shakmaty::Role::Rook) => 4,
        Some(shakmaty::Role::Queen) => 5,
        _ => {
            return Err("Invalid promotion".to_string());
        }
    };
    move_bytes.push(from | (dest & 0b00000011) << 6);
    move_bytes.push((dest & 0b11111100) >> 2 | promotion << 4);
    Ok(move_bytes)
}

pub fn decode_moves(moves_bytes: Option<Vec<u8>>) -> Result<String, String> {
    if let Some(move_blob) = moves_bytes {
        let mut chess = Chess::default();
        let mut moves = Vec::new();
        let mut i = 0;
        while i < move_blob.len() {
            let uci = decode_2byte_move(&move_blob[i..i + 2])?;
            let m = uci.to_move(&chess).or(Err("Invalid move"))?;
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

pub fn encode_moves(moves: &Vec<SanPlus>) -> Result<Vec<u8>, String> {
    let mut chess = Chess::default();
    let mut move_blob = Vec::new();
    for m in moves {
        let m = m.san.to_move(&chess).or(Err("Invalid move"))?;
        chess.play_unchecked(&m);
        move_blob.append(&mut encode_2byte_move(&m)?);
    }
    Ok(move_blob)
}

pub fn position_search(move_blob: &Option<Vec<u8>>, test_position: &Chess) -> Result<bool, String> {
    if let Some(move_blob) = move_blob {
        let mut chess = Chess::default();
        let mut i = 0;
        while i < move_blob.len() {
            let uci = decode_2byte_move(&move_blob[i..i + 2])?;
            let m = uci.to_move(&chess).or(Err("Invalid move"))?;
            chess.play_unchecked(&m);
            if chess == *test_position {
                return Ok(true);
            }
            i += 2;
        }
    }
    Ok(false)
}
