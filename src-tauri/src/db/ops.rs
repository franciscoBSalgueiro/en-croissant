use crate::db::models::{
    Event, Game, NewEvent, NewGame, NewOpening, NewPlayer, NewSite, Opening, Player, Site,
};
use diesel::prelude::*;
use diesel::SqliteConnection;
use pgn_reader::Outcome;
use shakmaty::zobrist::Zobrist32;

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

pub fn add_opening(
    conn: &mut SqliteConnection,
    hash: &Zobrist32,
    m: &[u8],
    result: Outcome,
) -> Result<(), diesel::result::Error> {
    use crate::db::schema::openings;

    let new_opening = match result {
        Outcome::Decisive { winner } => NewOpening {
            hash: hash.0 as i32,
            move_: m,
            black: (winner == shakmaty::Color::Black) as i32,
            white: (winner == shakmaty::Color::White) as i32,
            draw: 0,
        },
        Outcome::Draw => NewOpening {
            hash: hash.0 as i32,
            move_: m,
            black: 0,
            white: 0,
            draw: 1,
        },
    };

    // get the opening if it exists and increment the appropriate result
    // otherwise, insert the new opening
    let opening = openings::table
        .filter(openings::hash.eq(hash.0 as i32))
        .filter(openings::move_.eq(&m))
        .first::<Opening>(conn);

    match opening {
        Ok(o) => {
            match result {
                Outcome::Decisive { winner } => {
                    if winner == shakmaty::Color::Black {
                        diesel::update(openings::table)
                            .filter(openings::id.eq(o.id))
                            .set(openings::black.eq(o.black + 1))
                            .execute(conn)
                    } else {
                        diesel::update(openings::table)
                            .filter(openings::id.eq(o.id))
                            .set(openings::white.eq(o.white + 1))
                            .execute(conn)
                    }
                }
                Outcome::Draw => diesel::update(openings::table)
                    .filter(openings::id.eq(o.id))
                    .set(openings::draw.eq(o.draw + 1))
                    .execute(conn),
            }?;
        }
        Err(_) => {
            diesel::insert_or_ignore_into(openings::table)
                .values(&new_opening)
                .execute(conn)?;
        }
    }

    Ok(())
}
