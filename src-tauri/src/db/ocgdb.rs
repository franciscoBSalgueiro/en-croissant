use shakmaty::{san::San, uci::Uci, ByColor, Chess, Move, Position, Square};

use super::{get_material_count, get_pawn_home, is_end_reachable};

pub fn decode_2byte_move(move_bytes: &[u8]) -> Result<Uci, String> {
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

pub fn encode_2byte_move(m: &Move) -> Result<[u8; 2], String> {
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
    Ok([
        (from | (dest & 0b00000011) << 6),
        (dest & 0b11111100) >> 2 | promotion << 4,
    ])
}

pub fn decode_moves(moves_bytes: Vec<u8>) -> Result<String, String> {
    let mut chess = Chess::default();
    let mut moves = Vec::new();
    let mut i = 0;
    while i < moves_bytes.len() {
        let uci = decode_2byte_move(&moves_bytes[i..i + 2])?;
        let m = uci.to_move(&chess).or(Err("Invalid move"))?;
        let san = San::from_move(&chess, &m);
        chess.play_unchecked(&m);
        moves.push(san.to_string());
        i += 2;
    }
    Ok(moves.join(" "))
}

// pub fn encode_moves(moves: &Vec<SanPlus>) -> Result<Vec<u8>, String> {
//     let mut chess = Chess::default();
//     let mut move_blob = Vec::new();
//     for m in moves {
//         let m = m.san.to_move(&chess).or(Err("Invalid move"))?;
//         chess.play_unchecked(&m);
//         move_blob.append(&mut encode_2byte_move(&m)?);
//     }
//     Ok(move_blob)
// }

pub fn position_search(
    move_blob: &Vec<u8>,
    test_position: &Chess,
    material: &ByColor<u8>,
    pawn_home: u16,
) -> Result<Option<String>, String> {
    let mut chess = Chess::default();
    let mut i = 0;
    while i < move_blob.len() {
        let uci = decode_2byte_move(&move_blob[i..i + 2])?;
        let m = uci.to_move(&chess).or(Err("Invalid move"))?;
        chess.play_unchecked(&m);
        let cur_material = get_material_count(chess.board());
        let cur_pawn_home = get_pawn_home(chess.board());
        if cur_material.white < material.white
            || cur_material.black < material.black
            || !is_end_reachable(pawn_home, cur_pawn_home)
        {
            return Ok(None);
        }
        if chess == *test_position {
            if i + 2 >= move_blob.len() {
                return Ok(Some("*".to_string()));
            }
            let next_move = decode_2byte_move(&move_blob[i + 2..i + 4])?;
            return Ok(Some(next_move.to_string()));
        }
        i += 2;
    }
    Ok(None)
}
