use log::info;
use serde::{Deserialize, Serialize};
use shakmaty::{fen::Fen, san::San, Chess, EnPassantMode, Position};

use lazy_static::lazy_static;
use strsim::jaro_winkler;

use crate::error::Error;

#[derive(Serialize, Debug, Clone)]
pub struct Opening {
    eco: String,
    name: String,
    fen: String,
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
pub fn get_opening_from_fen(fen: &str) -> Result<&str, Error> {
    OPENINGS
        .iter()
        .find(|o| o.fen == fen)
        .map(|o| o.name.as_str())
        .ok_or(Error::NoOpeningFound)
}

pub fn get_opening_from_eco(eco: &str) -> Result<&str, Error> {
    OPENINGS
        .iter()
        .find(|o| o.eco == eco)
        .map(|o| o.name.as_str())
        .ok_or(Error::NoOpeningFound)
}

#[tauri::command]
pub async fn search_opening_name(query: String) -> Result<Vec<Opening>, Error> {
    let mut best_matches: Vec<(Opening, f64)> = Vec::new();

    for opening in OPENINGS.iter() {
        if best_matches.iter().any(|(m, _)| m.name == opening.name) {
            continue;
        }

        let score = jaro_winkler(&query, &opening.name);

        if best_matches.len() < 15 {
            best_matches.push((opening.clone(), score));
            best_matches.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        } else if let Some(min_score) = best_matches.last().map(|(_, s)| *s) {
            if score > min_score {
                best_matches.pop();
                best_matches.push((opening.clone(), score));
                best_matches.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
            }
        }
    }

    if !best_matches.is_empty() {
        let best_matches_names = best_matches.iter().map(|(o, _)| o.clone()).collect();
        Ok(best_matches_names)
    } else {
        Err(Error::NoMatchFound)
    }
}

lazy_static! {
    static ref OPENINGS: Vec<Opening> = {
        info!("Initializing openings table...");

        let mut positions = vec![
            Opening {
                eco: "Extra".to_string(),
                name: "Starting Position".to_string(),
                fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string(),
            },
            Opening {
                eco: "Extra".to_string(),
                name: "Empty Board".to_string(),
                fen: "8/8/8/8/8/8/8/8 w - - 0 1".to_string(),
            },
        ];

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
                let fen = Fen::from_position(pos.clone(), EnPassantMode::Legal);
                positions.push(Opening {
                    eco: record.eco,
                    name: record.name,
                    fen: fen.to_string(),
                });
            }
        }
        positions
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
