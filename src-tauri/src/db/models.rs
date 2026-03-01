use std::str::FromStr;

use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use specta::Type;

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

#[derive(Default, Debug, Queryable, Serialize, Deserialize, Identifiable, Clone, Type)]
#[diesel(table_name = players)]
pub struct Player {
    pub id: i32,
    pub name: Option<String>,
    pub elo: Option<i32>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = players)]
pub struct NewPlayer<'a> {
    pub name: &'a str,
    pub elo: Option<i32>,
}

#[allow(dead_code)]
struct White(pub Player);
#[allow(dead_code)]
struct Black(pub Player);

#[derive(Default, Queryable, Serialize, Deserialize, Identifiable, Associations)]
#[diesel(belongs_to(White, foreign_key = white_id))]
#[diesel(belongs_to(Black, foreign_key = black_id))]
#[diesel(table_name = games)]
pub struct Game {
    pub id: i32,
    pub event_id: i32,
    pub site_id: i32,
    pub date: Option<String>,
    pub time: Option<String>,
    pub round: Option<String>,
    pub white_id: i32,
    pub white_elo: Option<i32>,
    pub black_id: i32,
    pub black_elo: Option<i32>,
    pub white_material: i32,
    pub black_material: i32,
    pub result: Option<String>,
    pub time_control: Option<String>,
    pub eco: Option<String>,
    pub ply_count: Option<i32>,
    pub fen: Option<String>,
    pub moves: Vec<u8>,
    pub pawn_home: i32,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = games)]
pub struct NewGame<'a> {
    pub event_id: i32,
    pub site_id: i32,
    pub date: Option<&'a str>,
    pub time: Option<&'a str>,
    pub round: Option<&'a str>,
    pub white_id: i32,
    pub white_elo: Option<i32>,
    pub black_id: i32,
    pub black_elo: Option<i32>,
    pub white_material: i32,
    pub black_material: i32,
    pub result: Option<&'a str>,
    pub time_control: Option<&'a str>,
    pub eco: Option<&'a str>,
    pub ply_count: i32,
    pub fen: Option<&'a str>,
    pub moves: &'a [u8],
    pub pawn_home: i32,
}

#[derive(Default, Debug, Queryable, Serialize, Deserialize, Identifiable, Clone)]
pub struct Site {
    pub id: i32,
    pub name: Option<String>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = sites)]
pub struct NewSite<'a> {
    pub name: &'a str,
}

#[derive(Default, Debug, Queryable, Serialize, Deserialize, Identifiable, Clone, Type)]
pub struct Event {
    pub id: i32,
    pub name: Option<String>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = events)]
pub struct NewEvent<'a> {
    pub name: &'a str,
}

#[derive(Queryable, Serialize, Deserialize)]
pub struct Info {
    pub name: String,
    pub value: Option<String>,
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
    pub event_id: i32,
    pub site: String,
    pub site_id: i32,
    #[specta(optional)]
    pub date: Option<String>,
    #[specta(optional)]
    pub time: Option<String>,
    #[specta(optional)]
    pub round: Option<String>,
    pub white: String,
    pub white_id: i32,
    #[specta(optional)]
    pub white_elo: Option<i32>,
    pub black: String,
    pub black_id: i32,
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
