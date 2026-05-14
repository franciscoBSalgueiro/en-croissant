use shakmaty::{fen::Fen, uci::UciMove, CastlingMode, Chess, Position};

use crate::error::Error;

pub fn parse_fen_to_position(fen: &str) -> Result<Chess, Error> {
    let fen: Fen = fen.parse()?;
    let setup = fen.as_setup().clone();
    let castling_mode = CastlingMode::detect(&setup);
    match setup.position(castling_mode) {
        Ok(p) => Ok(p),
        Err(e) => Ok(e.ignore_too_much_material()?),
    }
}

pub fn apply_uci_moves(pos: &mut Chess, moves: &[String]) -> Result<(), Error> {
    for m in moves {
        let uci = UciMove::from_ascii(m.as_bytes())?;
        let mv = uci.to_move(pos)?;
        pos.play_unchecked(mv);
    }
    Ok(())
}

pub fn parse_fen_and_apply_moves(fen: &str, moves: &[String]) -> Result<Chess, Error> {
    let mut pos = parse_fen_to_position(fen)?;
    apply_uci_moves(&mut pos, moves)?;
    Ok(pos)
}

pub fn normalize_uci_moves_for_fen(fen: &str, moves: &[String]) -> Result<Vec<String>, Error> {
    let fen: Fen = fen.parse()?;
    let setup = fen.as_setup().clone();
    let castling_mode = CastlingMode::detect(&setup);
    let mut pos = match setup.position(castling_mode) {
        Ok(p) => p,
        Err(e) => e.ignore_too_much_material()?,
    };

    let mut normalized_moves = Vec::with_capacity(moves.len());

    for m in moves {
        let uci = UciMove::from_ascii(m.as_bytes())?;
        let mv = uci.to_move(&pos)?;
        normalized_moves.push(UciMove::from_move(mv, castling_mode).to_string());
        pos.play_unchecked(mv);
    }

    Ok(normalized_moves)
}
