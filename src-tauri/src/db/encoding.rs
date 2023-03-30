use shakmaty::{san::SanPlus, ByColor, Chess, Move, Position, uci::Uci};

use super::{get_material_count, get_pawn_home, is_end_reachable, is_material_reachable};

pub fn encode_move(m: &Move, chess: &Chess) -> Result<u8, String> {
    let moves = chess.legal_moves();
    Ok(moves.iter().position(|x| x == m).unwrap() as u8)
}

fn decode_move(byte: u8, chess: &Chess) -> Option<Move> {
    let legal_moves = chess.legal_moves();
    legal_moves.into_iter().nth(byte as usize)
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

pub fn position_search(
    move_blob: &Vec<u8>,
    test_position: &Chess,
    material: &ByColor<u8>,
    pawn_home: u16,
) -> Result<Option<String>, String> {
    let mut chess = Chess::default();

    if chess == *test_position {
        if move_blob.is_empty() {
            return Ok(Some("*".to_string()));
        }
        let next_move = decode_move(move_blob[0], &chess).unwrap();
        let uci = Uci::from_move(&next_move, shakmaty::CastlingMode::Standard);
        return Ok(Some(uci.to_string()));
    }

    for (i, byte) in move_blob.iter().enumerate() {
        let m = decode_move(*byte, &chess).unwrap();
        chess.play_unchecked(&m);
        let cur_material = get_material_count(chess.board());
        let cur_pawn_home = get_pawn_home(chess.board());
        if !is_end_reachable(pawn_home, cur_pawn_home)
            || !is_material_reachable(material, &cur_material)
        {
            return Ok(None);
        }
        if chess == *test_position {
            if i == move_blob.len() - 1 {
                return Ok(Some("*".to_string()));
            }
            let next_move = decode_move(move_blob[i + 1], &chess).unwrap();
            let uci = Uci::from_move(&next_move, shakmaty::CastlingMode::Standard);
            return Ok(Some(uci.to_string()));
        }
    }
    Ok(None)
}
