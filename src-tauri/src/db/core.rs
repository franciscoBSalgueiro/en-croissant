use super::{
    create_event, create_player, create_site, models::{Event, Game, NewGame, NormalizedGame, Outcome, Player, Site, UpdateGame}, pgn::{GameTree, Importer}, schema::{events, games, players, sites}
};
use crate::error::{Result};
use diesel::{connection::SimpleConnection, prelude::*};
use shakmaty::{Chess, fen::Fen, CastlingMode, FromSetup};
use std::str::FromStr;
use std::string::ToString;
use pgn_reader::BufferedReader;

const DATABASE_VERSION: &str = "1.0.0";
const CREATE_TABLES_SQL: &str = include_str!("create.sql");

pub fn init_db(conn: &mut SqliteConnection, title: &str, description: &str) -> Result<()> {
    conn.batch_execute(CREATE_TABLES_SQL)?;
    conn.batch_execute(
        format!(
            "INSERT INTO Info (Name, Value) VALUES (\"Version\", \"{DATABASE_VERSION}\");
                INSERT INTO Info (Name, Value) VALUES (\"Title\", \"{title}\");
                INSERT INTO Info (Name, Value) VALUES (\"Description\", \"{description}\");"
        )
        .as_str(),
    )?;

    Ok(())
}

pub fn normalize_game(
    game: Game,
    white: Player,
    black: Player,
    event: Event,
    site: Site,
) -> Result<NormalizedGame> {
    let fen: Fen = game
        .fen
        .map(|f| Fen::from_ascii(f.as_bytes()).unwrap())
        .unwrap_or_default();

    Ok(NormalizedGame {
        id: game.id,
        event: event.name.unwrap_or_default(),
        event_id: event.id,
        site: site.name.unwrap_or_default(),
        site_id: site.id,
        date: game.date,
        time: game.time,
        round: game.round,
        white: white.name.unwrap_or_default(),
        white_id: game.white_id,
        white_elo: game.white_elo,
        black: black.name.unwrap_or_default(),
        black_id: game.black_id,
        black_elo: game.black_elo,
        result: Outcome::from_str(&game.result.unwrap_or_default()).unwrap_or_default(),
        time_control: game.time_control,
        eco: game.eco,
        ply_count: game.ply_count,
        fen: fen.to_string(),
        //moves: decode_moves(game.moves, fen).unwrap_or_default().join(" "),
        moves: GameTree::from_bytes(&game.moves, Some(Chess::from_setup(fen.into(), CastlingMode::Chess960)?))?.to_string()
    })
}

/// Creates a new game in the database, and returns the game's ID.
pub fn add_game(
    conn: &mut SqliteConnection,
    game: NewGame,
) -> Result<Game> {
    use crate::db::schema::games;

    Ok(diesel::insert_or_ignore_into(games::table)
        .values(&game)
        .get_result(conn)?)
}


pub fn get_game(conn: &mut SqliteConnection, id: i32) -> Result<NormalizedGame> {
    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    let (game, white, black, event, site): (Game, Player, Player, Event, Site) = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .filter(games::id.eq(id))
        .first(conn)?;

    normalize_game(game, white, black, event, site)
}

pub fn update_game(conn: &mut SqliteConnection, id: i32, data: &UpdateGame) -> Result<()> {
    //let mut importer = Importer::new(None);

    let mut reader = BufferedReader::new_cursor(dbg!(&data.moves));
    let mut importer = Importer::new(None);

    let tree: GameTree = reader.read_game(&mut importer)?.flatten().ok_or(crate::error::Error::NoMovesFound)?.tree;
    let mut moves: Vec<u8> = Vec::new();
    tree.encode(&mut moves, None);

    diesel::update(games::dsl::games)
        .filter(games::id.eq(id))
        .set((
            games::fen.eq(&data.fen),
            games::event_id.eq(create_event(conn, &data.event)?.id),
            games::date.eq(&data.date),
            games::time.eq(&data.time),
            games::round.eq(&data.round),
            games::site_id.eq(create_site(conn, &data.site)?.id),
            games::white_id.eq(create_player(conn, &data.white)?.id),
            games::white_elo.eq(data.white_elo),
            games::black_id.eq(create_player(conn, &data.black)?.id),
            games::black_elo.eq(data.black_elo),
            games::result.eq(data.result.to_string()),
            games::time_control.eq(&data.time_control),
            games::eco.eq(&data.eco),
            games::ply_count.eq(data.ply_count),
            games::moves.eq(&moves)
        ))
        .execute(conn)?;
    
    Ok(())
}


pub fn remove_game(conn: &mut SqliteConnection, id: i32) -> Result<()> {
    diesel::delete(games::table.filter(games::id.eq(id))).execute(conn)?;

    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;
    use diesel::{sql_query, sql_types::Text};
    use serde::Serialize;

    fn test_db() -> SqliteConnection {
        let mut conn = SqliteConnection::establish(":memory:").unwrap();
        init_db(&mut conn, "Test", "Test").unwrap();

        conn
    }

    #[derive(QueryableByName, Debug, Serialize)]
    struct IndexInfo {
        #[diesel(sql_type = Text, column_name = "name")]
        _name: String,
    }

    #[test]
    fn test_add_game() {
        let mut db = test_db();

        let query = sql_query("SELECT name FROM pragma_index_list('Games');");
        let indexes: Vec<IndexInfo> = query.load(&mut db).unwrap();
        assert!(indexes.is_empty());
    }
}
