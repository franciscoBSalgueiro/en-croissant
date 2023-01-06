use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::db::schema::*;

#[derive(Default, Queryable, Serialize, Deserialize, Identifiable)]
#[table_name = "players"]
pub struct Player {
    pub id: i32,
    pub name: Option<String>,
    pub game_count: i32,
}

#[derive(Insertable, Serialize, Deserialize)]
#[table_name = "players"]
pub struct NewPlayer<'a> {
    pub name: Option<&'a str>,
    pub game_count: i32,
}

struct White(pub Player);
struct Black(pub Player);

#[derive(Default, Queryable, Serialize, Deserialize, Identifiable, Associations)]
#[belongs_to(White, foreign_key = "white")]
#[belongs_to(Black, foreign_key = "black")]
#[table_name = "games"]
pub struct Game {
    pub id: i32,
    pub speed: Option<i32>,
    pub fen: Option<String>,
    pub site: Option<String>,
    pub date: Option<String>,
    pub white: i32,
    pub white_rating: Option<i32>,
    pub black: i32,
    pub black_rating: Option<i32>,
    pub outcome: Option<i32>,
    pub moves: String,
}

#[derive(Default, Insertable, Serialize, Deserialize, Associations)]
#[belongs_to(White, foreign_key = "white")]
#[belongs_to(Black, foreign_key = "black")]
#[table_name = "games"]
pub struct NewGame<'a> {
    pub speed: Option<i32>,
    pub fen: Option<&'a str>,
    pub site: Option<&'a str>,
    pub date: Option<&'a str>,
    pub white: i32,
    pub white_rating: Option<i32>,
    pub black: i32,
    pub black_rating: Option<i32>,
    pub outcome: Option<i32>,
    pub moves: &'a str,
}
