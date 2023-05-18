use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen,
    san::San,
    zobrist::{Zobrist64, ZobristHash},
    CastlingMode, Chess, EnPassantMode, Position,
};

use lazy_static::lazy_static;

#[derive(Serialize, Debug)]
pub struct Opening {
    eco: String,
    name: String,
}

#[derive(Deserialize)]
struct OpeningRecord {
    eco: String,
    name: String,
    pgn: String,
}

const TSV_DATA: [&[u8]; 5] = [
    include_bytes!("../data/a.tsv"),
    include_bytes!("../data/b.tsv"),
    include_bytes!("../data/c.tsv"),
    include_bytes!("../data/d.tsv"),
    include_bytes!("../data/e.tsv"),
];

#[tauri::command]
pub fn get_opening_from_fen(fen: &str) -> Result<&str, &str> {
    let fen: Fen = fen.parse().or(Err("Invalid FEN"))?;
    let pos: Chess = fen
        .into_position(CastlingMode::Standard)
        .or(Err("Invalid Position"))?;
    let hash: Zobrist64 = pos.zobrist_hash(EnPassantMode::Legal);
    OPENINGS
        .get(&hash)
        .map(|o| o.name.as_str())
        .ok_or("No opening found")
}

pub fn get_opening_from_eco(eco: &str) -> Result<&str, &str> {
    OPENINGS
        .values()
        .find(|o| o.eco == eco)
        .map(|o| o.name.as_str())
        .ok_or("No opening found")
}

lazy_static! {
    static ref OPENINGS: HashMap<Zobrist64, Opening> = {
        println!("Initializing openings table...");
        let mut map = HashMap::new();
        for tsv in TSV_DATA {
            let mut rdr = csv::ReaderBuilder::new().delimiter(b'\t').from_reader(tsv);
            for result in rdr.deserialize() {
                let record: OpeningRecord = result.expect("Failed to deserialize opening");
                let mut pos = Chess::default();
                for token in record.pgn.split_whitespace() {
                    if let Ok(san) = token.parse::<San>() {
                        pos.play_unchecked(&san.to_move(&pos).expect("legal move"));
                    }
                }
                map.insert(
                    pos.zobrist_hash(EnPassantMode::Legal),
                    Opening {
                        eco: record.eco,
                        name: record.name,
                    },
                );
            }
        }
        map
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_opening() {
        let opening =
            get_opening_from_fen("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR b kq - 1 2")
                .unwrap();
        assert_eq!(opening, "Bongcloud Attack");
    }
}
