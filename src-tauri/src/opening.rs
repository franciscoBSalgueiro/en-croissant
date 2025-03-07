use log::info;
use serde::{Deserialize, Serialize};
use shakmaty::{fen::Fen, san::San, Chess, EnPassantMode, Position, Setup};

use lazy_static::lazy_static;
use specta::Type;
use strsim::{jaro_winkler, sorensen_dice};

use crate::error::Error;

#[derive(Debug, Clone)]
struct Opening {
    eco: String,
    name: String,
    setup: Setup,
    pgn: Option<String>,
}

#[derive(Debug, Clone, Type, Serialize)]
pub struct OutOpening {
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

const FISCHER_RANDOM_DATA: &[u8] = include_bytes!("../data/frc.tsv");

#[derive(Deserialize)]
struct FischerRandomRecord {
    name: String,
    fen: String,
}

#[tauri::command]
#[specta::specta]
pub fn get_opening_from_fen(fen: &str) -> Result<String, Error> {
    let fen: Fen = fen.parse()?;
    get_opening_from_setup(fen.into_setup())
}

#[tauri::command]
#[specta::specta]
pub fn get_opening_from_name(name: &str) -> Result<String, Error> {
    OPENINGS
        .iter()
        .find(|o| o.name == name)
        .map(|o| o.pgn.clone().expect("opening without pgn"))
        .ok_or_else(|| Error::NoOpeningFound)
}

pub fn get_opening_from_setup(setup: Setup) -> Result<String, Error> {
    OPENINGS
        .iter()
        .find(|o| o.setup == setup)
        .map(|o| o.name.clone())
        .ok_or_else(|| Error::NoOpeningFound)
}

#[tauri::command]
#[specta::specta]
pub async fn search_opening_name(query: String) -> Result<Vec<OutOpening>, Error> {
    let lower_query = query.to_lowercase();
    let scores = OPENINGS
        .iter()
        .map(|opening| {
            let lower_name = opening.name.to_lowercase();
            let sorenson_score = sorensen_dice(&lower_query, &lower_name);
            let jaro_score = jaro_winkler(&lower_query, &lower_name);
            let score = sorenson_score.max(jaro_score);
            (opening.clone(), score)
        })
        .collect::<Vec<_>>();
    let mut best_matches = scores
        .into_iter()
        .filter(|(_, score)| *score > 0.8)
        .collect::<Vec<_>>();

    best_matches.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    let best_matches_names = best_matches
        .iter()
        .map(|(o, _)| o.clone())
        .take(15)
        .map(|o| OutOpening {
            name: o.name,
            fen: Fen::from_setup(o.setup.clone()).to_string(),
        })
        .collect();
    Ok(best_matches_names)
}

lazy_static! {
    static ref OPENINGS: Vec<Opening> = {
        info!("Initializing openings table...");

        let mut positions = vec![
            Opening {
                eco: "Extra".to_string(),
                name: "Starting Position".to_string(),
                setup: Setup::default(),
                pgn: None,
            },
            Opening {
                eco: "Extra".to_string(),
                name: "Empty Board".to_string(),
                setup: Setup::empty(),
                pgn: None,
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
                positions.push(Opening {
                    eco: record.eco,
                    name: record.name,
                    setup: pos.into_setup(EnPassantMode::Legal),
                    pgn: Some(record.pgn),
                });
            }
        }
        let mut rdr = csv::ReaderBuilder::new()
            .delimiter(b'\t')
            .from_reader(FISCHER_RANDOM_DATA);
        for result in rdr.deserialize() {
            let record: FischerRandomRecord = result.expect("Failed to deserialize opening");
            let fen: Fen = record.fen.parse().expect("Failed to parse fen");
            positions.push(Opening {
                eco: "FRC".to_string(),
                name: record.name,
                setup: fen.into_setup(),
                pgn: None,
            });
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
