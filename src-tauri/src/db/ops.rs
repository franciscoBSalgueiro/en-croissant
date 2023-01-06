use crate::db::models::{Game, NewGame, NewPlayer, Player};
use diesel::prelude::*;
use diesel::SqliteConnection;

pub fn create_player(conn: &mut SqliteConnection, name: &str) -> Player {
    use crate::db::schema::players;

    let new_player = NewPlayer {
        name: Some(name),
        game_count: 0,
    };

    diesel::insert_or_ignore_into(players::table)
        .values(&new_player)
        .execute(conn)
        .expect("Error saving new player");

    players::table
        .order(players::id.desc())
        .first(conn)
        .unwrap()
}

pub fn create_game(conn: &mut SqliteConnection, game: NewGame) -> Game {
    use crate::db::schema::games;

    diesel::insert_or_ignore_into(games::table)
        .values(game)
        .execute(conn)
        .expect("Error saving new game");

    games::table.order(games::id.desc()).first(conn).unwrap()
}

pub fn get_player(conn: &mut SqliteConnection, id: i32) -> Player {
    use crate::db::schema::players::dsl::*;

    players
        .filter(id.eq(id))
        .first(conn)
        .expect("Error loading player")
}

pub fn get_game(conn: &mut SqliteConnection, id: i32) -> Game {
    use crate::db::schema::games::dsl::*;

    games
        .filter(id.eq(id))
        .first(conn)
        .expect("Error loading game")
}
