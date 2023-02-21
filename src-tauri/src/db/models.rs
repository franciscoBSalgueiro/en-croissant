use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::db::schema::*;

#[derive(Default, Debug, Queryable, Serialize, Deserialize, Identifiable)]
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

struct White(pub Player);
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
    pub round: Option<String>,
    pub white_id: i32,
    pub white_elo: Option<i32>,
    pub black_id: i32,
    pub black_elo: Option<i32>,
    pub result: Option<String>,
    pub time_control: Option<String>,
    pub eco: Option<String>,
    pub ply_count: Option<i32>,
    pub fen: Option<String>,
    pub moves2: Option<Vec<u8>>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = games)]
pub struct NewGame<'a> {
    pub event_id: i32,
    pub site_id: i32,
    pub date: Option<&'a str>,
    pub round: Option<&'a str>,
    pub white_id: Option<i32>,
    pub white_elo: Option<i32>,
    pub black_id: Option<i32>,
    pub black_elo: Option<i32>,
    pub result: Option<&'a str>,
    pub time_control: Option<&'a str>,
    pub eco: Option<&'a str>,
    pub ply_count: i32,
    pub fen: Option<&'a str>,
    pub moves2: &'a [u8],
}

#[derive(Default, Debug, Queryable, Serialize, Deserialize, Identifiable)]
pub struct Site {
    pub id: i32,
    pub name: Option<String>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = sites)]
pub struct NewSite<'a> {
    pub name: &'a str,
}

#[derive(Default, Debug, Queryable, Serialize, Deserialize, Identifiable)]
pub struct Event {
    pub id: i32,
    pub name: Option<String>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = events)]
pub struct NewEvent<'a> {
    pub name: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct NormalizedGame {
    pub id: i32,
    pub event: Event,
    pub site: Site,
    pub date: Option<String>,
    pub round: Option<String>,
    pub white: Player,
    pub white_elo: Option<i32>,
    pub black: Player,
    pub black_elo: Option<i32>,
    pub result: Option<String>,
    pub time_control: Option<String>,
    pub eco: Option<String>,
    pub ply_count: Option<i32>,
    pub fen: Option<String>,
    pub moves: String,
}

#[derive(Queryable, Serialize, Deserialize)]
pub struct Info {
    pub name: String,
    pub value: Option<String>,
}