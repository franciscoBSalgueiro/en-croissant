//! Per-player study reports. Contract: docs/learning-features-architecture.md.

use std::collections::HashMap;

use diesel::prelude::*;
use serde::Serialize;
use specta::Type;

use super::models::{Event, Game, Player, Site};
use super::schema::{events, games, players, sites};
use super::{get_db_or_create, normalize_games, ConnectionOptions, GameOutcome, NormalizedGame};
use crate::{error::Error, AppState};

#[derive(Serialize, Clone, Type)]
pub struct PlayerOpening {
    pub eco: String,
    pub games: u32,
    pub wins: u32,
    pub draws: u32,
    pub losses: u32,
}

#[derive(Serialize, Clone, Type)]
pub struct PlayerReport {
    pub name: String,
    pub elo: Option<i32>,
    pub games: u32,
    pub wins: u32,
    pub draws: u32,
    pub losses: u32,
    pub avg_opponent_elo: Option<f64>,
    pub first_year: Option<String>,
    pub last_year: Option<String>,
    pub openings: Vec<PlayerOpening>,
    pub best_games: Vec<NormalizedGame>,
}

/// Win/draw/loss counters for one scope (overall or a single ECO code).
#[derive(Default)]
struct ResultTally {
    games: u32,
    wins: u32,
    draws: u32,
    losses: u32,
}

impl ResultTally {
    fn record(&mut self, result: Option<&str>, is_white: bool) {
        self.games += 1;
        match count_result(result, is_white) {
            Some(GameOutcome::Won) => self.wins += 1,
            Some(GameOutcome::Drawn) => self.draws += 1,
            Some(GameOutcome::Lost) => self.losses += 1,
            None => {}
        }
    }
}

/// Classifies a `Result` string from the player's perspective: wins are
/// "1-0" as white and "0-1" as black, "1/2-1/2" is a draw; "*", missing and
/// unrecognized results count as neither.
fn count_result(result: Option<&str>, is_white: bool) -> Option<GameOutcome> {
    match result? {
        "1-0" => Some(if is_white {
            GameOutcome::Won
        } else {
            GameOutcome::Lost
        }),
        "0-1" => Some(if is_white {
            GameOutcome::Lost
        } else {
            GameOutcome::Won
        }),
        "1/2-1/2" => Some(GameOutcome::Drawn),
        _ => None,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn player_report(
    file: std::path::PathBuf,
    player_id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<PlayerReport, Error> {
    let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    let player = players::table
        .filter(players::id.eq(player_id))
        .first::<Player>(db)
        .optional()?
        // No dedicated PlayerNotFound variant exists; GameNotFound is the
        // closest "not found" error.
        .ok_or_else(|| Error::GameNotFound(format!("Player {}", player_id)))?;

    // One scan of the player's games feeds the overall stats, the per-ECO
    // tallies, the year range and the best-game candidates.
    type PlayerGameRow = (
        i32,            // id
        i32,            // white_id
        i32,            // black_id
        Option<String>, // result
        Option<i32>,    // white_elo
        Option<i32>,    // black_elo
        Option<String>, // date
        Option<String>, // eco
    );
    let rows: Vec<PlayerGameRow> = games::table
        .select((
            games::id,
            games::white_id,
            games::black_id,
            games::result,
            games::white_elo,
            games::black_elo,
            games::date,
            games::eco,
        ))
        .filter(games::white_id.eq(player_id).or(games::black_id.eq(player_id)))
        .load(db)?;

    let mut overall = ResultTally::default();
    let mut openings: HashMap<String, ResultTally> = HashMap::new();
    let mut elo_sum: i64 = 0;
    let mut elo_count: u32 = 0;
    let mut first_year: Option<String> = None;
    let mut last_year: Option<String> = None;
    // (opponent elo, game id), ranked by opponent elo desc below.
    let mut best_candidates: Vec<(i32, i32)> = Vec::new();

    for (id, white_id, _black_id, result, white_elo, black_elo, date, eco) in rows {
        let is_white = white_id == player_id;
        overall.record(result.as_deref(), is_white);

        let opponent_elo = if is_white { black_elo } else { white_elo };
        if let Some(elo) = opponent_elo.filter(|e| *e > 0) {
            elo_sum += i64::from(elo);
            elo_count += 1;
            best_candidates.push((elo, id));
        }

        // Skip partial dates such as "????.??.??" whose year prefix is not
        // numeric.
        if let Some(year) = date
            .as_deref()
            .and_then(|d| d.get(..4))
            .filter(|y| y.chars().all(|c| c.is_ascii_digit()))
        {
            if first_year.as_deref().is_none_or(|y| year < y) {
                first_year = Some(year.to_string());
            }
            if last_year.as_deref().is_none_or(|y| year > y) {
                last_year = Some(year.to_string());
            }
        }

        if let Some(eco) = eco.as_deref().filter(|e| !e.is_empty()) {
            openings
                .entry(eco.to_string())
                .or_default()
                .record(result.as_deref(), is_white);
        }
    }

    let mut openings: Vec<PlayerOpening> = openings
        .into_iter()
        .map(|(eco, tally)| PlayerOpening {
            eco,
            games: tally.games,
            wins: tally.wins,
            draws: tally.draws,
            losses: tally.losses,
        })
        .collect();
    openings.sort_by(|a, b| b.games.cmp(&a.games).then_with(|| a.eco.cmp(&b.eco)));
    openings.truncate(12);

    best_candidates.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    best_candidates.truncate(15);
    let best_ids: Vec<i32> = best_candidates.into_iter().map(|(_, id)| id).collect();
    let rank_by_id: HashMap<i32, usize> = best_ids
        .iter()
        .enumerate()
        .map(|(rank, &id)| (id, rank))
        .collect();

    // Load the best games with the same join + conversion search_position
    // uses, then restore the opponent-elo ranking.
    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    let joined: Vec<(Game, Player, Player, Event, Site)> = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .filter(games::id.eq_any(best_ids))
        .load(db)?;
    let mut best_games = normalize_games(joined);
    best_games.sort_by_key(|g| rank_by_id.get(&g.id).copied().unwrap_or(usize::MAX));

    Ok(PlayerReport {
        name: player.name.unwrap_or_default(),
        elo: player.elo,
        games: overall.games,
        wins: overall.wins,
        draws: overall.draws,
        losses: overall.losses,
        avg_opponent_elo: if elo_count > 0 {
            Some(elo_sum as f64 / f64::from(elo_count))
        } else {
            None
        },
        first_year,
        last_year,
        openings,
        best_games,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tally_counts_results_from_both_colors() {
        let mut tally = ResultTally::default();
        tally.record(Some("1-0"), true); // won as white
        tally.record(Some("1-0"), false); // lost as black
        tally.record(Some("0-1"), true); // lost as white
        tally.record(Some("0-1"), false); // won as black
        tally.record(Some("1/2-1/2"), true);
        tally.record(Some("1/2-1/2"), false);

        assert_eq!(tally.games, 6);
        assert_eq!(tally.wins, 2);
        assert_eq!(tally.draws, 2);
        assert_eq!(tally.losses, 2);
    }

    #[test]
    fn tally_ignores_unknown_results() {
        let mut tally = ResultTally::default();
        tally.record(None, true);
        tally.record(Some("*"), false);
        tally.record(Some(""), true);

        assert_eq!(tally.games, 3);
        assert_eq!((tally.wins, tally.draws, tally.losses), (0, 0, 0));
    }

    #[test]
    fn count_result_classifies_from_the_player_perspective() {
        assert!(matches!(
            count_result(Some("1-0"), true),
            Some(GameOutcome::Won)
        ));
        assert!(matches!(
            count_result(Some("0-1"), false),
            Some(GameOutcome::Won)
        ));
        assert!(matches!(
            count_result(Some("1-0"), false),
            Some(GameOutcome::Lost)
        ));
        assert!(matches!(
            count_result(Some("0-1"), true),
            Some(GameOutcome::Lost)
        ));
        assert!(matches!(
            count_result(Some("1/2-1/2"), true),
            Some(GameOutcome::Drawn)
        ));
        assert!(matches!(count_result(None, true), None));
        assert!(matches!(count_result(Some("*"), false), None));
    }
}
