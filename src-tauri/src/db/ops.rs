use crate::db::models::{Game, NewGame, NewPlayer, Player};
use diesel::prelude::*;
use diesel::SqliteConnection;

/// Creates a new player in the database, and returns the player's ID.
/// If the player already exists, returns the ID of the existing player.
pub fn create_player(
    conn: &mut SqliteConnection,
    name: &str,
) -> Result<Player, diesel::result::Error> {
    use crate::db::schema::players;

    let new_player = NewPlayer {
        name: Some(name),
        game_count: 0,
    };

    let player = diesel::insert_into(players::table)
        .values(&new_player)
        .on_conflict(players::name)
        .do_nothing()
        .execute(conn);

    match player {
        Ok(_) => players::table
            .filter(players::name.eq(name))
            .first::<Player>(conn),
        Err(e) => Err(e),
    }
}

/// Creates a new game in the database, and returns the game's ID.
pub fn create_game(
    conn: &mut SqliteConnection,
    game: NewGame,
) -> Result<Game, diesel::result::Error> {
    use crate::db::schema::games;

    diesel::insert_into(games::table)
        .values(&game)
        .get_result(conn)
}

pub fn increment_game_count(conn: &mut SqliteConnection, player_id: i32) {
    use crate::db::schema::players::dsl::*;

    diesel::update(players.filter(id.eq(player_id)))
        .set(game_count.eq(game_count + 1))
        .execute(conn)
        .expect("Error incrementing game count");
}
