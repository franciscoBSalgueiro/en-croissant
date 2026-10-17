use dashmap::DashMap;
use diesel::prelude::*;
use log::info;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, Bitboard, ByColor, CastlingMode, Chess, FromSetup, Position, Setup,
};
use specta::Type;
use std::{
    cmp::Reverse,
    collections::{BinaryHeap, HashMap},
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};
use tauri::Emitter;

use crate::{
    db::{
        encoding::{decode_move, iter_mainline_move_bytes},
        get_db_or_create, get_material_count, get_pawn_home,
        models::*,
        normalize_games,
        schema::*,
        search_index::{get_index_path, GameResult, MmapSearchIndex, SearchGameEntryRef},
        ConnectionOptions, MaterialCount,
    },
    error::Error,
    AppState,
};

use super::GameQuery;

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub struct ExactData {
    pawn_home: u16,
    material: MaterialCount,
    position: Chess,
}

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub struct PartialData {
    // piece_counts: Vec<(Piece, u8)>,
    piece_positions: Setup,
    material: MaterialCount,
}

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub enum PositionQuery {
    Exact(ExactData),
    Partial(PartialData),
}

impl PositionQuery {
    pub fn exact_from_fen(fen: &str) -> Result<PositionQuery, Error> {
        let fen = Fen::from_ascii(fen.as_bytes())?;
        let setup = fen.into_setup();
        let castling_mode = CastlingMode::detect(&setup);
        let position: Chess = setup.position(castling_mode)?;
        let pawn_home = get_pawn_home(position.board());
        let material = get_material_count(position.board());
        Ok(PositionQuery::Exact(ExactData {
            pawn_home,
            material,
            position,
        }))
    }

    pub fn partial_from_fen(fen: &str) -> Result<PositionQuery, Error> {
        let fen = Fen::from_ascii(fen.as_bytes())?;
        let setup = fen.into_setup();
        let material = get_material_count(&setup.board);
        Ok(PositionQuery::Partial(PartialData {
            piece_positions: setup,
            material,
        }))
    }
}

#[derive(Debug, Clone, Deserialize, Type, PartialEq, Eq, Hash)]
pub struct PositionQueryJs {
    pub fen: String,
    pub type_: String,
}

fn convert_position_query(query: PositionQueryJs) -> Result<PositionQuery, Error> {
    match query.type_.as_str() {
        "exact" => PositionQuery::exact_from_fen(&query.fen),
        "partial" => PositionQuery::partial_from_fen(&query.fen),
        _ => unreachable!(),
    }
}

impl PositionQuery {
    fn matches(&self, position: &Chess) -> bool {
        match self {
            PositionQuery::Exact(ref data) => {
                data.position.turn() == position.turn() && data.position.board() == position.board()
            }
            PositionQuery::Partial(ref data) => {
                let query_board = &data.piece_positions.board;
                let tested_board = position.board();

                is_contained(tested_board.white(), query_board.white())
                    && is_contained(tested_board.black(), query_board.black())
                    && is_contained(tested_board.pawns(), query_board.pawns())
                    && is_contained(tested_board.knights(), query_board.knights())
                    && is_contained(tested_board.bishops(), query_board.bishops())
                    && is_contained(tested_board.rooks(), query_board.rooks())
                    && is_contained(tested_board.queens(), query_board.queens())
                    && is_contained(tested_board.kings(), query_board.kings())
            }
        }
    }

    fn is_reachable_by(&self, material: &MaterialCount, pawn_home: u16) -> bool {
        match self {
            PositionQuery::Exact(ref data) => {
                is_end_reachable(data.pawn_home, pawn_home)
                    && is_material_reachable(&data.material, material)
            }
            PositionQuery::Partial(ref data) => is_material_reachable(&data.material, material),
        }
    }

    fn can_reach(&self, material: &MaterialCount, pawn_home: u16) -> bool {
        match self {
            PositionQuery::Exact(ref data) => {
                is_end_reachable(pawn_home, data.pawn_home)
                    && is_material_reachable(material, &data.material)
            }
            PositionQuery::Partial(_) => true,
        }
    }
}

/// Returns true if the end pawn structure is reachable
fn is_end_reachable(end: u16, pos: u16) -> bool {
    end & !pos == 0
}

/// Returns true if the end material is reachable
fn is_material_reachable(end: &MaterialCount, pos: &MaterialCount) -> bool {
    end.white <= pos.white && end.black <= pos.black
}

/// Returns true if the subset is contained in the container
fn is_contained(container: Bitboard, subset: Bitboard) -> bool {
    container & subset == subset
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct PositionStats {
    #[serde(rename = "move")]
    pub move_: String,
    pub white: i32,
    pub draw: i32,
    pub black: i32,
}

fn get_move_after_match(
    move_blob: &[u8],
    fen: &Option<&str>,
    query: &PositionQuery,
) -> Result<Option<String>, Error> {
    let mut chess = if let Some(fen) = fen {
        let fen = Fen::from_ascii(fen.as_bytes())?;
        let setup = fen.into_setup();
        let castling_mode = CastlingMode::detect(&setup);
        Chess::from_setup(setup, castling_mode)?
    } else {
        Chess::default()
    };

    if query.matches(&chess) {
        let mut mainline = iter_mainline_move_bytes(move_blob).peekable();
        if mainline.peek().is_none() {
            return Ok(Some("*".to_string()));
        }
        let Some(next_byte) = mainline.peek().copied() else {
            return Ok(Some("*".to_string()));
        };
        let Some(next_move) = decode_move(next_byte, &chess) else {
            return Ok(None);
        };
        let san = SanPlus::from_move(chess, &next_move);
        return Ok(Some(san.to_string()));
    }

    let mut mainline = iter_mainline_move_bytes(move_blob).peekable();

    while let Some(byte) = mainline.next() {
        let Some(m) = decode_move(byte, &chess) else {
            return Ok(None);
        };
        chess.play_unchecked(&m);

        let is_irreversible =
            m.is_capture() || m.role() == shakmaty::Role::Pawn || m.is_promotion();

        if is_irreversible {
            let board = chess.board();
            if !query.is_reachable_by(&get_material_count(board), get_pawn_home(board)) {
                return Ok(None);
            }
        }
        if query.matches(&chess) {
            if mainline.peek().is_none() {
                return Ok(Some("*".to_string()));
            }
            let Some(next_byte) = mainline.peek().copied() else {
                return Ok(Some("*".to_string()));
            };
            let Some(next_move) = decode_move(next_byte, &chess) else {
                return Ok(None);
            };
            let san = SanPlus::from_move(chess, &next_move);
            return Ok(Some(san.to_string()));
        }
    }
    Ok(None)
}

#[derive(Clone, serde::Serialize)]
pub struct ProgressPayload {
    pub progress: f64,
    pub id: String,
    pub finished: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn search_position(
    file: PathBuf,
    query: GameQuery,
    app: tauri::AppHandle,
    tab_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(Vec<PositionStats>, Vec<NormalizedGame>), Error> {
    let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    let collision_lock = {
        let entry = state
            .search_collisions
            .entry((query.clone(), file.clone()))
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())));
        entry.value().clone()
    };

    let _guard = collision_lock.lock().await;

    if let Some(pos) = state.line_cache.get(&(query.clone(), file.clone())) {
        return Ok(pos.clone());
    }

    let start = Instant::now();
    info!("start loading games");

    let permit = state.new_request.acquire().await.unwrap();

    let mmap_index = {
        let mut cache = state.db_cache.lock().unwrap();
        if cache.is_none() {
            let index_path = get_index_path(&file);

            if !MmapSearchIndex::is_valid(&index_path) {
                info!("Search index not found, generating automatically...");
                drop(cache);
                if let Err(e) = super::generate_search_index(&file, &state) {
                    return Err(Error::from(std::io::Error::other(format!(
                        "Failed to generate search index: {}",
                        e
                    ))));
                }
                cache = state.db_cache.lock().unwrap();
            }

            info!("Loading games from mmap binary search index");
            match MmapSearchIndex::open(&index_path) {
                Ok(index) => {
                    info!(
                        "Opened mmap index with {} games: {:?}",
                        index.len(),
                        start.elapsed()
                    );
                    *cache = Some(index);
                }
                Err(e) => {
                    return Err(Error::from(e));
                }
            }
        }
        cache.as_ref().unwrap().clone()
    };

    let game_count = mmap_index.len();

    info!(
        "Ready to search {} games: {:?}",
        game_count,
        start.elapsed()
    );

    let openings: DashMap<String, PositionStats> = DashMap::new();
    const MAX_SAMPLES: usize = 500;
    // Min-heap of (elo_key, game_id) to track top-rated sample games.
    // Using Reverse so peek() returns the entry with the lowest ELO,
    // which we can evict when a higher-rated game is found.
    let top_games: Mutex<BinaryHeap<Reverse<(i16, i32)>>> =
        Mutex::new(BinaryHeap::with_capacity(MAX_SAMPLES + 1));

    let processed = AtomicUsize::new(0);

    let parsed_position_query: Option<PositionQuery> = if let Some(pq) = &query.position {
        Some(convert_position_query(pq.clone())?)
    } else {
        None
    };

    let wanted_result = query.wanted_result.as_ref().and_then(|r| match r.as_str() {
        "whitewon" => Some(GameResult::WhiteWin),
        "blackwon" => Some(GameResult::BlackWin),
        "draw" => Some(GameResult::Draw),
        _ => None,
    });

    info!("start search on {tab_id}");

    let process_entry = |entry: SearchGameEntryRef<'_>| {
        let index = processed.fetch_add(1, Ordering::Relaxed) + 1;
        if index.is_multiple_of(50000) {
            let _ = app.emit(
                "search_progress",
                ProgressPayload {
                    progress: (index as f64 / game_count as f64) * 100.0,
                    id: tab_id.clone(),
                    finished: false,
                },
            );
        }

        if let Some(white) = query.player1 {
            if white != entry.white_id {
                return;
            }
        }

        if let Some(black) = query.player2 {
            if black != entry.black_id {
                return;
            }
        }

        if let Some(wanted) = wanted_result {
            if entry.result != wanted {
                return;
            }
        }

        if let Some(start_date) = &query.start_date {
            if let Some(date) = entry.date {
                if date < start_date.as_str() {
                    return;
                }
            }
        }

        if let Some(end_date) = &query.end_date {
            if let Some(date) = entry.date {
                if date > end_date.as_str() {
                    return;
                }
            }
        }

        if let Some(position_query) = &parsed_position_query {
            let end_material: MaterialCount = ByColor {
                white: entry.white_material,
                black: entry.black_material,
            };
            if position_query.can_reach(&end_material, entry.pawn_home) {
                if let Ok(Some(m)) = get_move_after_match(entry.moves, &entry.fen, position_query) {
                    let elo_key = entry.white_elo.max(entry.black_elo);
                    let mut heap = top_games.lock().unwrap();
                    if heap.len() < MAX_SAMPLES {
                        heap.push(Reverse((elo_key, entry.id)));
                    } else if let Some(&Reverse((min_elo, _))) = heap.peek() {
                        if elo_key > min_elo {
                            heap.pop();
                            heap.push(Reverse((elo_key, entry.id)));
                        }
                    }
                    drop(heap);

                    openings
                        .entry(m)
                        .and_modify(|opening| match entry.result {
                            GameResult::WhiteWin => opening.white += 1,
                            GameResult::BlackWin => opening.black += 1,
                            GameResult::Draw => opening.draw += 1,
                            GameResult::Other | GameResult::None => opening.draw += 1,
                        })
                        .or_insert_with(|| PositionStats {
                            black: i32::from(entry.result == GameResult::BlackWin),
                            white: i32::from(entry.result == GameResult::WhiteWin),
                            draw: i32::from(
                                entry.result == GameResult::Draw
                                    || entry.result == GameResult::Other
                                    || entry.result == GameResult::None,
                            ),
                            move_: String::new(),
                        });
                }
            }
        }
    };

    mmap_index.par_iter().for_each(process_entry);

    let openings: Vec<PositionStats> = openings
        .into_iter()
        .map(|(k, mut v)| {
            v.move_ = k;
            v
        })
        .collect();
    let ids: Vec<i32> = top_games
        .into_inner()
        .unwrap()
        .into_iter()
        .map(|Reverse((_, id))| id)
        .collect();

    info!("finished search in {:?}", start.elapsed());

    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    let games: Vec<(Game, Player, Player, Event, Site)> = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .filter(games::id.eq_any(ids))
        .order((games::white_elo.desc(), games::black_elo.desc()))
        .load(db)?;
    let normalized_games = normalize_games(games);
    let file_path = file.clone();

    state.line_cache.insert(
        (query.clone(), file),
        (openings.clone(), normalized_games.clone()),
    );

    state.search_collisions.remove(&(query, file_path));

    drop(permit);

    Ok((openings, normalized_games))
}

#[derive(Debug, Serialize, Clone, Type)]
pub struct EloBucketStat {
    pub bucket: String,
    pub total: u32,
    pub white: u32,
    pub draw: u32,
    pub black: u32,
}

#[derive(Debug, Serialize, Clone, Type)]
pub struct YearStat {
    pub year: String,
    pub total: u32,
    pub white: u32,
    pub draw: u32,
    pub black: u32,
}

#[derive(Debug, Serialize, Clone, Type)]
pub struct OpeningMoveReport {
    pub move_: String,
    pub total: u32,
    pub white: u32,
    pub draw: u32,
    pub black: u32,
    pub avg_elo: Option<f64>,
    pub elo_buckets: Vec<EloBucketStat>,
    pub yearly: Vec<YearStat>,
}

const ELO_BUCKET_LABELS: [&str; 5] = ["<1200", "1200-1499", "1500-1799", "1800-2099", ">=2100"];

/// Returns the index into `ELO_BUCKET_LABELS` for an Elo value,
/// or `None` when the value is missing (0).
fn elo_bucket_index(elo: i16) -> Option<usize> {
    match elo {
        ..=0 => None,
        ..=1199 => Some(0),
        1200..=1499 => Some(1),
        1500..=1799 => Some(2),
        1800..=2099 => Some(3),
        _ => Some(4),
    }
}

#[derive(Default)]
struct ResultCount {
    total: u32,
    white: u32,
    draw: u32,
    black: u32,
}

impl ResultCount {
    fn record(&mut self, result: GameResult) {
        self.total += 1;
        match result {
            GameResult::WhiteWin => self.white += 1,
            GameResult::BlackWin => self.black += 1,
            GameResult::Draw | GameResult::Other | GameResult::None => self.draw += 1,
        }
    }
}

#[derive(Default)]
struct OpeningMoveAccum {
    results: ResultCount,
    elo_sum: i64,
    elo_count: u32,
    buckets: [ResultCount; 5],
    years: HashMap<String, ResultCount>,
}

impl OpeningMoveAccum {
    fn record(&mut self, result: GameResult, date: Option<&str>, elo: i16) {
        self.results.record(result);
        if let Some(bucket) = elo_bucket_index(elo) {
            self.elo_sum += i64::from(elo);
            self.elo_count += 1;
            self.buckets[bucket].record(result);
        }
        if let Some(year) = date.and_then(|d| d.get(..4)) {
            self.years.entry(year.to_string()).or_default().record(result);
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn opening_report(
    file: PathBuf,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<OpeningMoveReport>, Error> {
    let start = Instant::now();
    info!("start loading games for opening report");

    let permit = state.new_request.acquire().await.unwrap();

    let mmap_index = {
        let mut cache = state.db_cache.lock().unwrap();
        if cache.is_none() {
            let index_path = get_index_path(&file);

            if !MmapSearchIndex::is_valid(&index_path) {
                info!("Search index not found, generating automatically...");
                drop(cache);
                if let Err(e) = super::generate_search_index(&file, &state) {
                    return Err(Error::from(std::io::Error::other(format!(
                        "Failed to generate search index: {}",
                        e
                    ))));
                }
                cache = state.db_cache.lock().unwrap();
            }

            info!("Loading games from mmap binary search index");
            match MmapSearchIndex::open(&index_path) {
                Ok(index) => {
                    info!(
                        "Opened mmap index with {} games: {:?}",
                        index.len(),
                        start.elapsed()
                    );
                    *cache = Some(index);
                }
                Err(e) => {
                    return Err(Error::from(e));
                }
            }
        }
        cache.as_ref().unwrap().clone()
    };

    let game_count = mmap_index.len();

    info!(
        "Ready to search {} games: {:?}",
        game_count,
        start.elapsed()
    );

    let openings: DashMap<String, OpeningMoveAccum> = DashMap::new();

    let parsed_position_query: Option<PositionQuery> = if let Some(pq) = &query.position {
        Some(convert_position_query(pq.clone())?)
    } else {
        None
    };

    let wanted_result = query.wanted_result.as_ref().and_then(|r| match r.as_str() {
        "whitewon" => Some(GameResult::WhiteWin),
        "blackwon" => Some(GameResult::BlackWin),
        "draw" => Some(GameResult::Draw),
        _ => None,
    });

    info!("start opening report search");

    let process_entry = |entry: SearchGameEntryRef<'_>| {
        if let Some(white) = query.player1 {
            if white != entry.white_id {
                return;
            }
        }

        if let Some(black) = query.player2 {
            if black != entry.black_id {
                return;
            }
        }

        if let Some(wanted) = wanted_result {
            if entry.result != wanted {
                return;
            }
        }

        if let Some(start_date) = &query.start_date {
            if let Some(date) = entry.date {
                if date < start_date.as_str() {
                    return;
                }
            }
        }

        if let Some(end_date) = &query.end_date {
            if let Some(date) = entry.date {
                if date > end_date.as_str() {
                    return;
                }
            }
        }

        if let Some(position_query) = &parsed_position_query {
            let end_material: MaterialCount = ByColor {
                white: entry.white_material,
                black: entry.black_material,
            };
            if position_query.can_reach(&end_material, entry.pawn_home) {
                if let Ok(Some(m)) = get_move_after_match(entry.moves, &entry.fen, position_query) {
                    let elo = entry.white_elo.max(entry.black_elo);
                    openings.entry(m).or_default().record(entry.result, entry.date, elo);
                }
            }
        }
    };

    mmap_index.par_iter().for_each(process_entry);

    let mut reports: Vec<OpeningMoveReport> = openings
        .into_iter()
        .map(|(move_, accum)| {
            let OpeningMoveAccum { results, elo_sum, elo_count, buckets, years } = accum;
            let mut yearly: Vec<YearStat> = years
                .into_iter()
                .map(|(year, count)| YearStat {
                    year,
                    total: count.total,
                    white: count.white,
                    draw: count.draw,
                    black: count.black,
                })
                .collect();
            yearly.sort_by(|a, b| a.year.cmp(&b.year));
            OpeningMoveReport {
                move_,
                total: results.total,
                white: results.white,
                draw: results.draw,
                black: results.black,
                avg_elo: if elo_count > 0 {
                    Some(elo_sum as f64 / f64::from(elo_count))
                } else {
                    None
                },
                elo_buckets: buckets
                    .into_iter()
                    .zip(ELO_BUCKET_LABELS)
                    .filter(|(count, _)| count.total > 0)
                    .map(|(count, bucket)| EloBucketStat {
                        bucket: bucket.to_string(),
                        total: count.total,
                        white: count.white,
                        draw: count.draw,
                        black: count.black,
                    })
                    .collect(),
                yearly,
            }
        })
        .collect();

    reports.sort_by(|a, b| b.total.cmp(&a.total).then_with(|| a.move_.cmp(&b.move_)));

    info!("finished opening report in {:?}", start.elapsed());

    drop(permit);

    Ok(reports)
}

#[derive(Debug, Serialize, Clone, Type)]
pub struct ModelPlayerStat {
    pub name: String,
    pub elo: Option<i32>,
    pub games: u32,
    pub wins: u32,
    pub draws: u32,
    pub losses: u32,
}

#[derive(Serialize, Clone, Type)]
pub struct ModelGamesReport {
    pub players: Vec<ModelPlayerStat>,
    pub games: Vec<NormalizedGame>,
}

const MAX_MODEL_PLAYERS: usize = 10;
const MAX_MODEL_GAMES: usize = 30;

#[derive(Default)]
struct PlayerAccum {
    games: u32,
    wins: u32,
    draws: u32,
    losses: u32,
    white_elo: i16,
    black_elo: i16,
}

impl PlayerAccum {
    /// Records one game for this player. Wins count games the player won with
    /// either color; "*" results do not count towards wins/draws/losses.
    fn record(&mut self, result: GameResult, as_white: bool, elo: i16) {
        self.games += 1;
        match result {
            GameResult::WhiteWin => {
                if as_white {
                    self.wins += 1;
                } else {
                    self.losses += 1;
                }
            }
            GameResult::BlackWin => {
                if as_white {
                    self.losses += 1;
                } else {
                    self.wins += 1;
                }
            }
            GameResult::Draw => self.draws += 1,
            GameResult::Other | GameResult::None => {}
        }
        if as_white {
            self.white_elo = self.white_elo.max(elo);
        } else {
            self.black_elo = self.black_elo.max(elo);
        }
    }

    fn max_elo(&self) -> i16 {
        self.white_elo.max(self.black_elo)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn model_games(
    file: PathBuf,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<ModelGamesReport, Error> {
    let start = Instant::now();
    info!("start loading games for model games report");

    let permit = state.new_request.acquire().await.unwrap();

    let mmap_index = {
        let mut cache = state.db_cache.lock().unwrap();
        if cache.is_none() {
            let index_path = get_index_path(&file);

            if !MmapSearchIndex::is_valid(&index_path) {
                info!("Search index not found, generating automatically...");
                drop(cache);
                if let Err(e) = super::generate_search_index(&file, &state) {
                    return Err(Error::from(std::io::Error::other(format!(
                        "Failed to generate search index: {}",
                        e
                    ))));
                }
                cache = state.db_cache.lock().unwrap();
            }

            info!("Loading games from mmap binary search index");
            match MmapSearchIndex::open(&index_path) {
                Ok(index) => {
                    info!(
                        "Opened mmap index with {} games: {:?}",
                        index.len(),
                        start.elapsed()
                    );
                    *cache = Some(index);
                }
                Err(e) => {
                    return Err(Error::from(e));
                }
            }
        }
        cache.as_ref().unwrap().clone()
    };

    let game_count = mmap_index.len();

    info!(
        "Ready to search {} games: {:?}",
        game_count,
        start.elapsed()
    );

    let player_stats: DashMap<i32, PlayerAccum> = DashMap::new();
    // Min-heap of (elo_key, game_id) to track the top-rated model games.
    // Using Reverse so peek() returns the entry with the lowest ELO,
    // which we can evict when a higher-rated game is found.
    let top_games: Mutex<BinaryHeap<Reverse<(i16, i32)>>> =
        Mutex::new(BinaryHeap::with_capacity(MAX_MODEL_GAMES + 1));

    let parsed_position_query: Option<PositionQuery> = if let Some(pq) = &query.position {
        Some(convert_position_query(pq.clone())?)
    } else {
        None
    };

    let wanted_result = query.wanted_result.as_ref().and_then(|r| match r.as_str() {
        "whitewon" => Some(GameResult::WhiteWin),
        "blackwon" => Some(GameResult::BlackWin),
        "draw" => Some(GameResult::Draw),
        _ => None,
    });

    info!("start model games search");

    let process_entry = |entry: SearchGameEntryRef<'_>| {
        if let Some(white) = query.player1 {
            if white != entry.white_id {
                return;
            }
        }

        if let Some(black) = query.player2 {
            if black != entry.black_id {
                return;
            }
        }

        if let Some(wanted) = wanted_result {
            if entry.result != wanted {
                return;
            }
        }

        if let Some(start_date) = &query.start_date {
            if let Some(date) = entry.date {
                if date < start_date.as_str() {
                    return;
                }
            }
        }

        if let Some(end_date) = &query.end_date {
            if let Some(date) = entry.date {
                if date > end_date.as_str() {
                    return;
                }
            }
        }

        if let Some(position_query) = &parsed_position_query {
            let end_material: MaterialCount = ByColor {
                white: entry.white_material,
                black: entry.black_material,
            };
            if position_query.can_reach(&end_material, entry.pawn_home) {
                if get_move_after_match(entry.moves, &entry.fen, position_query)
                    .unwrap_or(None)
                    .is_some()
                {
                    let elo_key = entry.white_elo.max(entry.black_elo);
                    let mut heap = top_games.lock().unwrap();
                    if heap.len() < MAX_MODEL_GAMES {
                        heap.push(Reverse((elo_key, entry.id)));
                    } else if let Some(&Reverse((min_elo, _))) = heap.peek() {
                        if elo_key > min_elo {
                            heap.pop();
                            heap.push(Reverse((elo_key, entry.id)));
                        }
                    }
                    drop(heap);

                    player_stats
                        .entry(entry.white_id)
                        .or_default()
                        .record(entry.result, true, entry.white_elo);
                    player_stats
                        .entry(entry.black_id)
                        .or_default()
                        .record(entry.result, false, entry.black_elo);
                }
            }
        }
    };

    mmap_index.par_iter().for_each(process_entry);

    if player_stats.is_empty() {
        info!("finished model games search in {:?}", start.elapsed());
        drop(permit);
        return Ok(ModelGamesReport {
            players: Vec::new(),
            games: Vec::new(),
        });
    }

    let mut ranked_players: Vec<(i32, PlayerAccum)> = player_stats.into_iter().collect();
    ranked_players.sort_by(|(id_a, a), (id_b, b)| {
        b.games
            .cmp(&a.games)
            .then_with(|| b.max_elo().cmp(&a.max_elo()))
            .then_with(|| id_a.cmp(id_b))
    });
    ranked_players.truncate(MAX_MODEL_PLAYERS);

    let game_ids: Vec<i32> = top_games
        .into_inner()
        .unwrap()
        .into_iter()
        .map(|Reverse((_, id))| id)
        .collect();

    info!("finished model games search in {:?}", start.elapsed());

    let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    let player_ids: Vec<i32> = ranked_players.iter().map(|(id, _)| *id).collect();
    let stored_players: Vec<Player> = players::table
        .filter(players::id.eq_any(player_ids))
        .load(db)?;
    let stored_by_id: HashMap<i32, Player> =
        stored_players.into_iter().map(|p| (p.id, p)).collect();

    let model_players: Vec<ModelPlayerStat> = ranked_players
        .into_iter()
        .map(|(id, accum)| {
            let stored = stored_by_id.get(&id);
            let name = stored
                .and_then(|p| p.name.clone())
                .unwrap_or_else(|| format!("Player {id}"));
            let elo = stored
                .and_then(|p| p.elo)
                .or_else(|| {
                    let max_seen = accum.max_elo();
                    (max_seen > 0).then_some(i32::from(max_seen))
                });
            ModelPlayerStat {
                name,
                elo,
                games: accum.games,
                wins: accum.wins,
                draws: accum.draws,
                losses: accum.losses,
            }
        })
        .collect();

    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    let games: Vec<(Game, Player, Player, Event, Site)> = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .filter(games::id.eq_any(game_ids))
        .order((games::white_elo.desc(), games::black_elo.desc()))
        .load(db)?;

    let mut model_games_list = normalize_games(games);
    model_games_list.sort_by(|a, b| {
        let a_key = a.white_elo.unwrap_or(0).max(a.black_elo.unwrap_or(0));
        let b_key = b.white_elo.unwrap_or(0).max(b.black_elo.unwrap_or(0));
        b_key.cmp(&a_key)
    });

    drop(permit);

    Ok(ModelGamesReport {
        players: model_players,
        games: model_games_list,
    })
}

#[derive(Serialize, Clone, Type)]
pub struct SimilarGame {
    pub game: NormalizedGame,
    pub ply: u32,
    pub matched_plies: u32,
}

/// A pawn skeleton: the bitboards of the white and black pawns of a position.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PawnStructure {
    white: Bitboard,
    black: Bitboard,
}

impl PawnStructure {
    fn from_position(position: &Chess) -> Self {
        let board = position.board();
        let pawns = board.pawns();
        Self {
            white: board.white() & pawns,
            black: board.black() & pawns,
        }
    }

    /// The same skeleton flipped vertically (square ^ 56).
    fn flip_vertical(self) -> Self {
        Self {
            white: self.white.flip_vertical(),
            black: self.black.flip_vertical(),
        }
    }

    fn swap_colors(self) -> Self {
        Self {
            white: self.black,
            black: self.white,
        }
    }

    /// Returns true when the skeletons are identical, or when they become
    /// identical after flipping the target vertically, either with colors
    /// preserved or with colors swapped (the same skeleton seen from the
    /// other side's perspective).
    fn matches(self, target: PawnStructure) -> bool {
        if self == target {
            return true;
        }
        let flipped = target.flip_vertical();
        self == flipped || self == flipped.swap_colors()
    }
}

fn pawn_structure_from_fen(fen: &str) -> Result<PawnStructure, Error> {
    let fen = Fen::from_ascii(fen.as_bytes())?;
    let setup = fen.into_setup();
    let castling_mode = CastlingMode::detect(&setup);
    let position: Chess = setup.position(castling_mode)?;
    Ok(PawnStructure::from_position(&position))
}

/// Replays the encoded mainline and counts the plies whose pawn skeleton
/// matches the target (directly or mirrored). Returns
/// `(first matching ply, number of matching plies)`, or `None` when the game
/// never matches or its data cannot be decoded.
fn count_pawn_structure_matches(
    move_blob: &[u8],
    fen: Option<&str>,
    target: PawnStructure,
) -> Option<(u32, u32)> {
    let mut chess = if let Some(fen) = fen {
        let fen = Fen::from_ascii(fen.as_bytes()).ok()?;
        let setup = fen.into_setup();
        let castling_mode = CastlingMode::detect(&setup);
        Chess::from_setup(setup, castling_mode).ok()?
    } else {
        Chess::default()
    };

    let mut first_match_ply: Option<u32> = None;
    let mut matched_plies = 0u32;

    if PawnStructure::from_position(&chess).matches(target) {
        first_match_ply = Some(0);
        matched_plies += 1;
    }

    for (ply, byte) in iter_mainline_move_bytes(move_blob).enumerate() {
        let Some(m) = decode_move(byte, &chess) else {
            return None;
        };
        chess.play_unchecked(&m);

        if PawnStructure::from_position(&chess).matches(target) {
            if first_match_ply.is_none() {
                first_match_ply = Some(ply as u32 + 1);
            }
            matched_plies += 1;
        }
    }

    first_match_ply.map(|ply| (ply, matched_plies))
}

struct SimilarAccum {
    id: i32,
    first_match_ply: u32,
    matched_plies: u32,
    white_elo: i16,
    black_elo: i16,
}

impl SimilarAccum {
    fn elo_key(&self) -> i16 {
        self.white_elo.max(self.black_elo)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn similar_games(
    file: PathBuf,
    fen: String,
    limit: u32,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SimilarGame>, Error> {
    let target = pawn_structure_from_fen(&fen)?;

    let start = Instant::now();
    info!("start loading games for similar structure search");

    let permit = state.new_request.acquire().await.unwrap();

    let mmap_index = {
        let mut cache = state.db_cache.lock().unwrap();
        if cache.is_none() {
            let index_path = get_index_path(&file);

            if !MmapSearchIndex::is_valid(&index_path) {
                info!("Search index not found, generating automatically...");
                drop(cache);
                if let Err(e) = super::generate_search_index(&file, &state) {
                    return Err(Error::from(std::io::Error::other(format!(
                        "Failed to generate search index: {}",
                        e
                    ))));
                }
                cache = state.db_cache.lock().unwrap();
            }

            info!("Loading games from mmap binary search index");
            match MmapSearchIndex::open(&index_path) {
                Ok(index) => {
                    info!(
                        "Opened mmap index with {} games: {:?}",
                        index.len(),
                        start.elapsed()
                    );
                    *cache = Some(index);
                }
                Err(e) => {
                    return Err(Error::from(e));
                }
            }
        }
        cache.as_ref().unwrap().clone()
    };

    let game_count = mmap_index.len();

    info!(
        "Ready to search {} games: {:?}",
        game_count,
        start.elapsed()
    );

    let matched_games: DashMap<i32, SimilarAccum> = DashMap::new();

    info!("start similar structure search");

    let process_entry = |entry: SearchGameEntryRef<'_>| {
        if let Some((first_match_ply, matched_plies)) =
            count_pawn_structure_matches(entry.moves, entry.fen, target)
        {
            matched_games.entry(entry.id).or_insert_with(|| SimilarAccum {
                id: entry.id,
                first_match_ply,
                matched_plies,
                white_elo: entry.white_elo,
                black_elo: entry.black_elo,
            });
        }
    };

    mmap_index.par_iter().for_each(process_entry);

    let mut ranked: Vec<SimilarAccum> = matched_games.into_iter().map(|(_, accum)| accum).collect();
    ranked.sort_by(|a, b| {
        b.matched_plies
            .cmp(&a.matched_plies)
            .then_with(|| b.elo_key().cmp(&a.elo_key()))
            .then_with(|| a.first_match_ply.cmp(&b.first_match_ply))
            .then_with(|| a.id.cmp(&b.id))
    });
    ranked.truncate(limit as usize);

    info!("finished similar structure search in {:?}", start.elapsed());

    if ranked.is_empty() {
        drop(permit);
        return Ok(Vec::new());
    }

    let ids: Vec<i32> = ranked.iter().map(|accum| accum.id).collect();

    let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    let games: Vec<(Game, Player, Player, Event, Site)> = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .filter(games::id.eq_any(ids))
        .order((games::white_elo.desc(), games::black_elo.desc()))
        .load(db)?;

    let games_by_id: HashMap<i32, NormalizedGame> =
        normalize_games(games).into_iter().map(|game| (game.id, game)).collect();

    let similar_games: Vec<SimilarGame> = ranked
        .into_iter()
        .filter_map(|accum| {
            let game = games_by_id.get(&accum.id)?.clone();
            Some(SimilarGame {
                game,
                ply: accum.first_match_ply,
                matched_plies: accum.matched_plies,
            })
        })
        .collect();

    drop(permit);

    Ok(similar_games)
}

pub async fn is_position_in_db(
    file: PathBuf,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<bool, Error> {
    let collision_lock = {
        let entry = state
            .search_collisions
            .entry((query.clone(), file.clone()))
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())));
        entry.value().clone()
    };

    let _guard = collision_lock.lock().await;

    if let Some(pos) = state.line_cache.get(&(query.clone(), file.clone())) {
        return Ok(!pos.0.is_empty());
    }

    let parsed_position_query: Option<PositionQuery> = if let Some(pq) = &query.position {
        Some(convert_position_query(pq.clone())?)
    } else {
        None
    };

    let start = Instant::now();
    info!("start loading games for is_position_in_db");

    let permit = state.new_request.acquire().await.unwrap();

    let mmap_index = {
        let mut cache = state.db_cache.lock().unwrap();
        if cache.is_none() {
            let index_path = get_index_path(&file);

            if !MmapSearchIndex::is_valid(&index_path) {
                info!("Search index not found, generating automatically...");
                drop(cache);
                if let Err(e) = super::generate_search_index(&file, &state) {
                    return Err(Error::from(std::io::Error::other(format!(
                        "Failed to generate search index: {}",
                        e
                    ))));
                }
                cache = state.db_cache.lock().unwrap();
            }

            info!("Loading games from mmap binary search index");
            match MmapSearchIndex::open(&index_path) {
                Ok(index) => {
                    info!(
                        "Opened mmap index with {} games: {:?}",
                        index.len(),
                        start.elapsed()
                    );
                    *cache = Some(index);
                }
                Err(e) => {
                    return Err(Error::from(e));
                }
            }
        }
        cache.as_ref().unwrap().clone()
    };

    let check_entry = |entry: SearchGameEntryRef<'_>| -> bool {
        let end_material: MaterialCount = ByColor {
            white: entry.white_material,
            black: entry.black_material,
        };
        if let Some(position_query) = &parsed_position_query {
            position_query.can_reach(&end_material, entry.pawn_home)
                && get_move_after_match(entry.moves, &entry.fen, position_query)
                    .unwrap_or(None)
                    .is_some()
        } else {
            false
        }
    };

    let exists = mmap_index.par_iter().any(check_entry);

    info!("finished search in {:?}", start.elapsed());

    if !exists {
        state
            .line_cache
            .insert((query.clone(), file.clone()), (vec![], vec![]));
    }

    state.search_collisions.remove(&(query, file));

    drop(permit);

    Ok(exists)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_partial_match(fen1: &str, fen2: &str) {
        let query = PositionQuery::partial_from_fen(fen1).unwrap();
        let fen = Fen::from_ascii(fen2.as_bytes()).unwrap();
        let chess = Chess::from_setup(fen.into_setup(), shakmaty::CastlingMode::Chess960).unwrap();
        assert!(query.matches(&chess));
    }

    #[test]
    fn exact_matches() {
        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        )
        .unwrap();
        let chess = Chess::default();
        assert!(query.matches(&chess));
    }

    #[test]
    fn empty_matches_anything() {
        assert_partial_match(
            "8/8/8/8/8/8/8/8 w - - 0 1",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        );
    }

    #[test]
    fn correct_partial_match() {
        assert_partial_match(
            "8/8/8/8/8/8/8/6N1 w - - 0 1",
            "3k4/8/8/8/8/4P3/3PKP2/6N1 w - - 0 1",
        );
    }

    #[test]
    #[should_panic]
    fn fail_partial_match() {
        assert_partial_match(
            "8/8/8/8/8/8/8/6N1 w - - 0 1",
            "3k4/8/8/8/8/4P3/3PKP2/7N w - - 0 1",
        );
        assert_partial_match(
            "8/8/8/8/8/8/8/6N1 w - - 0 1",
            "3k4/8/8/8/8/4P3/3PKP2/6n1 w - - 0 1",
        );
    }

    #[test]
    fn correct_exact_is_reachable() {
        let query =
            PositionQuery::exact_from_fen("rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR")
                .unwrap();
        let chess = Chess::default();
        assert!(query.is_reachable_by(
            &get_material_count(chess.board()),
            get_pawn_home(chess.board())
        ));
    }

    #[test]
    fn correct_partial_is_reachable() {
        let query = PositionQuery::partial_from_fen("8/8/8/8/8/8/8/8").unwrap();
        let chess = Chess::default();
        assert!(query.is_reachable_by(
            &get_material_count(chess.board()),
            get_pawn_home(chess.board())
        ));
    }

    #[test]
    fn correct_partial_can_reach() {
        let query = PositionQuery::partial_from_fen("8/8/8/8/8/8/8/8").unwrap();
        let chess = Chess::default();
        assert!(query.can_reach(
            &get_material_count(chess.board()),
            get_pawn_home(chess.board())
        ));
    }

    #[test]
    fn get_move_after_exact_match_test() {
        let game = vec![12, 12]; // 1. e4 e5

        let query =
            PositionQuery::exact_from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR").unwrap();
        let result = get_move_after_match(&game, &None, &query).unwrap();
        assert_eq!(result, Some("e4".to_string()));

        let query =
            PositionQuery::exact_from_fen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR").unwrap();
        let result = get_move_after_match(&game, &None, &query).unwrap();
        assert_eq!(result, Some("e5".to_string()));

        let query =
            PositionQuery::exact_from_fen("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR")
                .unwrap();
        let result = get_move_after_match(&game, &None, &query).unwrap();
        assert_eq!(result, Some("*".to_string()));
    }

    #[test]
    fn get_move_after_partial_match_test() {
        let game = vec![12, 12]; // 1. e4 e5

        let query = PositionQuery::partial_from_fen("8/pppppppp/8/8/8/8/PPPPPPPP/8").unwrap();
        let result = get_move_after_match(&game, &None, &query).unwrap();
        assert_eq!(result, Some("e4".to_string()));
    }

    #[test]
    fn pawn_structure_direct_match_test() {
        let target = pawn_structure_from_fen("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1").unwrap();

        // same skeleton, different side to move
        let game = pawn_structure_from_fen("4k3/8/8/3p4/4P3/8/8/4K3 b - - 0 1").unwrap();
        assert!(game.matches(target));

        // non-pawn pieces are ignored
        let game = pawn_structure_from_fen("4k3/8/8/3p1N2/4P3/8/8/4K3 b - - 0 1").unwrap();
        assert!(game.matches(target));
    }

    #[test]
    fn pawn_structure_rejects_different_skeleton_test() {
        let target = pawn_structure_from_fen("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1").unwrap();

        // black pawn moved
        let game = pawn_structure_from_fen("4k3/8/4p3/8/4P3/8/8/4K3 w - - 0 1").unwrap();
        assert!(!game.matches(target));

        // colors swapped without mirroring is not a match
        let game = pawn_structure_from_fen("4k3/8/8/3P4/3p4/8/8/4K3 w - - 0 1").unwrap();
        assert!(!game.matches(target));
    }

    #[test]
    fn pawn_structure_mirrored_match_test() {
        // target: white pawn e4, black pawn d5
        let target = pawn_structure_from_fen("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1").unwrap();

        // target flipped with colors preserved: white e5, black d4
        let game = pawn_structure_from_fen("4k3/8/8/4P3/3p4/8/8/4K3 w - - 0 1").unwrap();
        assert!(game.matches(target));

        // target flipped with colors swapped: white d4, black e5
        let game = pawn_structure_from_fen("4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1").unwrap();
        assert!(game.matches(target));
    }

    fn encode_san_game(sans: &[&str]) -> Vec<u8> {
        use crate::db::encoding::encode_move;

        let mut chess = Chess::default();
        let mut bytes = Vec::new();
        for san in sans {
            let san: shakmaty::san::San = san.parse().unwrap();
            let m = san.to_move(&chess).unwrap();
            bytes.push(encode_move(&m, &chess).unwrap());
            chess.play_unchecked(&m);
        }
        bytes
    }

    #[test]
    fn count_pawn_structure_matches_test() {
        // start position skeleton: only ply 0 of 1. e4 e5 matches
        let target = pawn_structure_from_fen(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        )
        .unwrap();
        let game = vec![12, 12]; // 1. e4 e5
        assert_eq!(
            count_pawn_structure_matches(&game, None, target),
            Some((0, 1))
        );

        // knight moves keep the skeleton: every ply of 1. Nf3 Nf6 matches
        let game = encode_san_game(&["Nf3", "Nf6"]);
        assert_eq!(
            count_pawn_structure_matches(&game, None, target),
            Some((0, 3))
        );

        // skeleton after 1. e4 e5: only the last ply of 1. e4 e5 matches
        let target = pawn_structure_from_fen(
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        )
        .unwrap();
        assert_eq!(
            count_pawn_structure_matches(&game, None, target),
            None
        );
        let game = vec![12, 12]; // 1. e4 e5
        assert_eq!(
            count_pawn_structure_matches(&game, None, target),
            Some((2, 1))
        );

        // mirrored skeletons match during replay: 1. d4 e5 is the mirrored
        // 1. e4 d5 (same skeleton from the other side's perspective)
        let target = pawn_structure_from_fen(
            "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        )
        .unwrap();
        let game = encode_san_game(&["d4", "e5"]);
        assert_eq!(
            count_pawn_structure_matches(&game, None, target),
            Some((2, 1))
        );

        // undecodable move byte aborts the replay
        assert_eq!(count_pawn_structure_matches(&[200], None, target), None);
    }

    #[test]
    fn player_accum_record_test() {
        let mut accum = PlayerAccum::default();
        accum.record(GameResult::WhiteWin, true, 2700);
        accum.record(GameResult::WhiteWin, false, 2500);
        accum.record(GameResult::BlackWin, false, 2600);
        accum.record(GameResult::Draw, true, 0);
        accum.record(GameResult::Other, true, 2400);

        assert_eq!(accum.games, 5);
        assert_eq!(accum.wins, 2);
        assert_eq!(accum.draws, 1);
        assert_eq!(accum.losses, 1);
        assert_eq!(accum.max_elo(), 2700);
    }
}
