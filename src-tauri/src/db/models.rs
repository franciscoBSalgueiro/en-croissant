use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::db::schema::*;

use super::{Speed, CustomOutcome};

#[derive(Default, Debug, Queryable, Serialize, Deserialize, Identifiable)]
#[diesel(table_name = players)]
pub struct Player {
    pub id: i32,
    pub name: Option<String>,
    pub game_count: i32,
}

#[derive(Debug, Insertable, Serialize, Deserialize)]
#[diesel(table_name = players)]
pub struct NewPlayer<'a> {
    pub name: Option<&'a str>,
    pub game_count: i32,
}

struct White(pub Player);
struct Black(pub Player);

#[derive(Default, Queryable, Serialize, Deserialize, Identifiable, Associations)]
#[diesel(belongs_to(White, foreign_key = white))]
#[diesel(belongs_to(Black, foreign_key = black))]
#[diesel(table_name = games)]
pub struct Game {
    pub id: i32,
    pub speed: Option<Speed>,
    pub fen: Option<String>,
    pub site: Option<String>,
    pub date: Option<String>,
    pub white: i32,
    pub white_rating: Option<i32>,
    pub black: i32,
    pub black_rating: Option<i32>,
    pub max_rating: Option<i32>,
    pub outcome: Option<CustomOutcome>,
    pub moves: String,
}

#[derive(Debug, Default, Insertable, Serialize, Deserialize, Associations)]
#[diesel(belongs_to(White, foreign_key = white))]
#[diesel(belongs_to(Black, foreign_key = black))]
#[diesel(table_name = games)]
pub struct NewGame<'a> {
    pub speed: Option<Speed>,
    pub fen: Option<&'a str>,
    pub site: Option<&'a str>,
    pub date: Option<&'a str>,
    pub white: i32,
    pub white_rating: Option<i32>,
    pub black: i32,
    pub black_rating: Option<i32>,
    pub max_rating: Option<i32>,
    pub outcome: Option<CustomOutcome>,
    pub moves: &'a str,
}
