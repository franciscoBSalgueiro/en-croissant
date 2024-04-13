use crate::db::models::{Event, Game, NewEvent, NewGame, NewPlayer, NewSite, Player, Site};
use diesel::prelude::*;

/// Creates a new player in the database, and returns the player's ID.
/// If the player already exists, returns the ID of the existing player.
pub fn create_player(
    conn: &mut SqliteConnection,
    name: &str,
) -> Result<Player, diesel::result::Error> {
    use crate::db::schema::players;

    let new_player = NewPlayer { name, elo: None };

    let player = diesel::insert_or_ignore_into(players::table)
        .values(&new_player)
        .execute(conn);

    match player {
        Ok(_) => players::table
            .filter(players::name.eq(name))
            .first::<Player>(conn),
        Err(e) => Err(e),
    }
}

pub fn create_event(
    conn: &mut SqliteConnection,
    name: &str,
) -> Result<Event, diesel::result::Error> {
    use crate::db::schema::events;

    let new_event = NewEvent { name };

    let event = diesel::insert_or_ignore_into(events::table)
        .values(&new_event)
        .execute(conn);

    match event {
        Ok(_) => events::table
            .filter(events::name.eq(name))
            .first::<Event>(conn),
        Err(e) => Err(e),
    }
}

pub fn create_site(conn: &mut SqliteConnection, name: &str) -> Result<Site, diesel::result::Error> {
    use crate::db::schema::sites;

    let new_site = NewSite { name };

    let site = diesel::insert_or_ignore_into(sites::table)
        .values(&new_site)
        .execute(conn);

    match site {
        Ok(_) => sites::table
            .filter(sites::name.eq(name))
            .first::<Site>(conn),
        Err(e) => Err(e),
    }
}

/// Creates a new game in the database, and returns the game's ID.
pub fn create_game(
    conn: &mut SqliteConnection,
    game: NewGame,
) -> Result<Game, diesel::result::Error> {
    use crate::db::schema::games;

    diesel::insert_or_ignore_into(games::table)
        .values(&game)
        .get_result(conn)
}
