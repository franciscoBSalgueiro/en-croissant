// Vendored from https://github.com/franciscoBSalgueiro/aix (aixrs, GPL-3.0).
// Used on iOS/Android, where the aixchess DuckDB extension can't be loaded.
#![allow(dead_code)]

use super::ffi::{Fen, Subfen};
use aix_chess_compression::{CompressionLevel, Decode, Decoder, EncodedGame};
use shakmaty::{
    fen::{Fen as ShakmatyFen, ParseFenError},
    Board, CastlingMode, Chess, Color, FromSetup, Position,
};

const SECOND_RANK: u64 = 0x0000_0000_0000_ff00;
const SEVENTH_RANK: u64 = 0x00ff_0000_0000_0000;

pub fn try_parse(subfen: &[u8]) -> Result<Subfen, ParseFenError> {
    let board = Board::from_ascii_board_fen(subfen)?;
    Ok(subfen_from_board(&board))
}

pub fn try_parse_fen(fen: &[u8]) -> Result<Fen, ParseFenError> {
    let parsed = ShakmatyFen::from_ascii(fen)?;
    let setup = parsed.as_setup();
    let castling_rights = CastlingMode::detect(setup);
    let position: Chess = Chess::from_setup(setup.clone(), castling_rights).map_err(
        |_| ParseFenError::InvalidFen, // Map any error to InvalidFen for simplicity
    )?;
    let subfen = subfen_from_board(position.board());
    Ok(Fen {
        white: subfen.white,
        black: subfen.black,
        king: subfen.king,
        queen: subfen.queen,
        rook: subfen.rook,
        bishop: subfen.bishop,
        knight: subfen.knight,
        pawn: subfen.pawn,
        white_to_move: position.turn() == Color::White,
        castling_rights: position.castles().castling_rights().0,
        ep_square: position
            .legal_ep_square()
            .map(|square| square.to_u32() as i8)
            .unwrap_or(-1),
    })
}

fn subfen_from_board(board: &Board) -> Subfen {
    Subfen {
        white: board.white().0,
        black: board.black().0,
        king: board.kings().0,
        queen: board.queens().0,
        rook: board.rooks().0,
        bishop: board.bishops().0,
        knight: board.knights().0,
        pawn: board.pawns().0,
    }
}

pub fn matches(subfen: Subfen, game: &[u8]) -> Result<bool, super::ffi::DecodeError> {
    matches_with_initial_fen(subfen, game, None)
}

pub fn matches_with_initial_fen(
    subfen: Subfen,
    game: &[u8],
    initial_fen: Option<&str>,
) -> Result<bool, super::ffi::DecodeError> {
    let encoded = EncodedGame::from_bytes(game)?;
    let decoder = Decoder::new_with_initial_fen(&encoded, initial_fen)?;
    for position in decoder.into_iter_positions() {
        let position = position?;
        let board = position.board();
        if matches_board(&subfen, board) {
            return Ok(true);
        }
    }

    Ok(false)
}

pub fn matches_fen(fen: Fen, game: &[u8]) -> Result<bool, super::ffi::DecodeError> {
    matches_fen_with_initial_fen(fen, game, None)
}

pub fn matches_fen_ply(fen: Fen, game: &[u8]) -> Result<u16, super::ffi::DecodeError> {
    matches_fen_ply_with_initial_fen(fen, game, None)
}

pub fn matches_fen_with_initial_fen(
    fen: Fen,
    game: &[u8],
    initial_fen: Option<&str>,
) -> Result<bool, super::ffi::DecodeError> {
    let encoded = EncodedGame::from_bytes(game)?;
    let initial_position = initial_position_for_matching(&encoded, initial_fen)?;
    if matches_fen_state(&fen, &initial_position) {
        return Ok(true);
    }

    let mut decoder = Decoder::new_with_initial_fen(&encoded, initial_fen)?;
    let target_pawn_home = get_pawn_home_for_fen(&fen);

    loop {
        let position = decoder.next_position();
        if let Some(position) = position {
            let position = position?;
            let board = position.board();
            if !is_end_reachable(target_pawn_home, get_pawn_home(board)) {
                return Ok(false);
            }
        
            if matches_fen_state(&fen, position) {
                return Ok(true);
            }

        } else {
            break;
        }
    }

    Ok(false)
}

pub fn matches_fen_ply_with_initial_fen(
    fen: Fen,
    game: &[u8],
    initial_fen: Option<&str>,
) -> Result<u16, super::ffi::DecodeError> {
    let encoded = EncodedGame::from_bytes(game)?;
    let initial_position = initial_position_for_matching(&encoded, initial_fen)?;
    if matches_fen_state(&fen, &initial_position) {
        return Ok(0);
    }

    let mut decoder = Decoder::new_with_initial_fen(&encoded, initial_fen)?;
    let target_pawn_home = get_pawn_home_for_fen(&fen);
    let mut ply: u16 = 0;

    loop {
        let position = decoder.next_position();
        if let Some(position) = position {
            ply = ply.saturating_add(1);
            let position = position?;
            let board = position.board();
            if !is_end_reachable(target_pawn_home, get_pawn_home(board)) {
                return Err(super::ffi::DecodeError::NoErrorNoValue);
            }

            if matches_fen_state(&fen, position) {
                return Ok(ply);
            }
        } else {
            break;
        }
    }

    Err(super::ffi::DecodeError::NoErrorNoValue)
}

fn initial_position_for_matching(
    encoded: &EncodedGame,
    initial_fen: Option<&str>,
) -> Result<Chess, super::ffi::DecodeError> {
    if encoded.compression_level() != CompressionLevel::Low {
        return Ok(Chess::new());
    }

    let Some(initial_fen) = initial_fen else {
        return Ok(Chess::new());
    };

    let parsed = ShakmatyFen::from_ascii(initial_fen.as_bytes())
        .map_err(|_| super::ffi::DecodeError::InvalidDataDuringDecoding)?;
    let setup = parsed.as_setup();
    let castling_mode = CastlingMode::detect(setup);
    Chess::from_setup(setup.clone(), castling_mode)
        .map_err(|_| super::ffi::DecodeError::InvalidDataDuringDecoding)
}

fn get_pawn_home(board: &Board) -> u16 {
    let white_pawns = (board.pawns() & board.white()).0;
    let black_pawns = (board.pawns() & board.black()).0;
    let second_rank_pawns = ((white_pawns & SECOND_RANK) >> 8) as u8;
    let seventh_rank_pawns = ((black_pawns & SEVENTH_RANK) >> 48) as u8;
    (second_rank_pawns as u16) | ((seventh_rank_pawns as u16) << 8)
}

fn get_pawn_home_for_fen(fen: &Fen) -> u16 {
    let white_pawns = fen.pawn & fen.white;
    let black_pawns = fen.pawn & fen.black;
    let second_rank_pawns = ((white_pawns & SECOND_RANK) >> 8) as u8;
    let seventh_rank_pawns = ((black_pawns & SEVENTH_RANK) >> 48) as u8;
    (second_rank_pawns as u16) | ((seventh_rank_pawns as u16) << 8)
}

/// Returns true if the end pawn structure is reachable.
fn is_end_reachable(end: u16, pos: u16) -> bool {
    end & !pos == 0
}

pub fn matches_board(subfen: &Subfen, board: &Board) -> bool {
    (board.white().0 & subfen.white) == subfen.white
        && (board.black().0 & subfen.black) == subfen.black
        && (board.kings().0 & subfen.king) == subfen.king
        && (board.queens().0 & subfen.queen) == subfen.queen
        && (board.rooks().0 & subfen.rook) == subfen.rook
        && (board.bishops().0 & subfen.bishop) == subfen.bishop
        && (board.knights().0 & subfen.knight) == subfen.knight
        && (board.pawns().0 & subfen.pawn) == subfen.pawn
}

fn matches_fen_state(fen: &Fen, position: &Chess) -> bool {
    let board = position.board();
    board.white().0 == fen.white
        && board.black().0 == fen.black
        && board.kings().0 == fen.king
        && board.queens().0 == fen.queen
        && board.rooks().0 == fen.rook
        && board.bishops().0 == fen.bishop
        && board.knights().0 == fen.knight
        && board.pawns().0 == fen.pawn
        && (position.turn() == Color::White) == fen.white_to_move
        && position.castles().castling_rights().0 == fen.castling_rights
        && position
            .legal_ep_square()
            .map(|square| square.to_u32() as i8)
            .unwrap_or(-1)
            == fen.ep_square
}

/// Finds the first occurrence and returns its next move in one decoding pass.
/// Zero means the game ended at the target. Otherwise the value is one plus
/// from | (to << 6) | (promotion ASCII << 12). NoErrorNoValue means no match.
pub fn next_move_at_fen(
    fen: &Fen,
    game: &[u8],
    initial_fen: Option<&str>,
) -> Result<u32, super::ffi::DecodeError> {
    let encoded = EncodedGame::from_bytes(game)?;
    let target_home = get_pawn_home_for_fen(fen);
    let target_count = (fen.white | fen.black).count_ones() as usize;
    // Reject impossible home-pawn and capture histories before reconstructing boards.
    // Custom starts and other encodings retain the general decoder path.
    if initial_fen.is_none()
        && encoded.compression_level() == CompressionLevel::Low
        && home_pawns_exclude(game, target_home, target_count)
    {
        return Err(super::ffi::DecodeError::NoErrorNoValue);
    }

    let initial = initial_position_for_matching(&encoded, initial_fen)?;
    let mut decoder = Decoder::new_with_initial_fen(&encoded, initial_fen)?;
    if !matches_fen_state(fen, &initial) {
        loop {
            let Some(position) = decoder.next_position() else {
                return Err(super::ffi::DecodeError::NoErrorNoValue);
            };
            let position = position?;
            if position.board().occupied().count() < target_count
                || !is_end_reachable(target_home, get_pawn_home(position.board())) {
                return Err(super::ffi::DecodeError::NoErrorNoValue);
            }
            if matches_fen_state(fen, position) {
                break;
            }
        }
    }

    let Some(m) = decoder.next_move() else { return Ok(0); };
    let m = m?;
    let to = if let shakmaty::Move::Castle { king, rook } = m {
        let side = shakmaty::CastlingSide::from_king_side(king < rook);
        shakmaty::Square::from_coords(side.king_to_file(), king.rank())
    } else { m.to() };
    let from = m.from().ok_or(super::ffi::DecodeError::InvalidDataDuringDecoding)?;
    let promotion = m.promotion().map(|p| p.char() as u32).unwrap_or(0);
    Ok(1 + (from as u32 | ((to as u32) << 6) | (promotion << 12)))
}

/// Low encoding stores source/destination in two-byte records. Home pawns
/// cannot return, so departures/captures can rule out a target without boards.
/// Captures reduce total piece count; promotions preserve it. Stop at the first
/// compatible mask and piece count; never follow variation records.
fn home_pawns_exclude(game: &[u8], target: u16, target_count: usize) -> bool {
    let mut home = u16::MAX;
    let mut count = 32usize;
    if (target == home && target_count == count) || game.len() % 2 != 1 { return false; }
    let mut depth = 0u32;
    for pair in game[..game.len() - 1].chunks_exact(2) {
        match pair {
            [255, 255] => { depth += 1; continue; }
            [255, 254] => {
                if depth == 0 { return false; }
                depth -= 1;
                continue;
            }
            [255, _] => return false,
            _ => {}
        }
        if depth != 0 { continue; }
        let from = pair[0] & 63;
        let captured = if pair[0] & 128 != 0 { Some(pair[1] & 63) } else { None };
        if captured.is_some() {
            if count == 0 { return false; }
            count -= 1;
        }
        if count < target_count { return true; }
        for sq in [Some(from), captured].into_iter().flatten() {
            if (8..16).contains(&sq) { home &= !(1 << (sq - 8)); }
            if (48..56).contains(&sq) { home &= !(1 << (sq - 40)); }
        }
        if !is_end_reachable(target, home) { return true; }
        if home == target && count == target_count { return false; }
    }
    // No mainline position had both the required home pawns and piece count.
    depth == 0
}

