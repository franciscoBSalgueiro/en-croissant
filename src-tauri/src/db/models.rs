use std::str::FromStr;

use serde::{Deserialize, Serialize};
use specta::Type;

use diesel::prelude::*;

use crate::db::schema::*;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable, Type)]
#[diesel(table_name = puzzles)]
pub struct Puzzle {
    pub id: i32,
    pub fen: String,
    pub moves: String,
    pub rating: i32,
    pub rating_deviation: i32,
    pub popularity: i32,
    pub nb_plays: i32,
}

#[derive(Default, Debug, Serialize, Deserialize, Clone, Type)]
pub struct Player {
    pub name: Option<String>,
    pub elo: Option<i32>,
}

#[derive(Default, Debug, Serialize, Deserialize, Clone, Type)]
pub struct Event {
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default, Type, Eq, PartialEq, Hash)]
pub enum Outcome {
    #[serde(rename = "1-0")]
    WhiteWin,
    #[serde(rename = "0-1")]
    BlackWin,
    #[serde(rename = "1/2-1/2")]
    Draw,
    #[serde(rename = "*")]
    #[default]
    Unknown,
}

impl FromStr for Outcome {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "1-0" => Ok(Outcome::WhiteWin),
            "0-1" => Ok(Outcome::BlackWin),
            "1/2-1/2" => Ok(Outcome::Draw),
            "*" => Ok(Outcome::Unknown),
            _ => Err(format!("Invalid outcome: {}", s)),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Type)]
pub struct NormalizedGame {
    pub id: i32,
    pub fen: String,
    pub event: String,
    pub site: String,
    #[specta(optional)]
    pub date: Option<String>,
    #[specta(optional)]
    pub time: Option<String>,
    #[specta(optional)]
    pub round: Option<String>,
    pub white: String,
    #[specta(optional)]
    pub white_elo: Option<i32>,
    pub black: String,
    #[specta(optional)]
    pub black_elo: Option<i32>,
    pub result: Outcome,
    #[specta(optional)]
    pub time_control: Option<String>,
    #[specta(optional)]
    pub eco: Option<String>,
    #[specta(optional)]
    pub ply_count: Option<i32>,
    pub moves: String,
}
