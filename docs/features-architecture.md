# Architecture: Preparation Suite (Opening Report · Monte Carlo · Opponent Clone · Analysis Tree)

This document is the binding contract for the implementation. Rust and
frontend code must match the signatures, names and payload shapes below.

Conventions (from codebase analysis):

- Commands: `#[tauri::command] #[specta::specta]`, return `Result<T, crate::error::Error>`,
  args/returns derive `Serialize/Deserialize + specta::Type` (`Clone` where stored).
- Background tasks follow the `game_loop` pattern: `tokio::spawn` + `tokio::select! { biased; shutdown_rx.changed() => .. }`,
  engines `quit().await` on all exit paths.
- Progress: `update_progress(&state.progress_state, &app, id, pct, finished)`.
- Cancel: `watch::Sender<bool>` shutdown channel stored in a manager struct.
- Ids: `opening_${tab}`, `simulation_${tab}`, `tree_${tab}` — prefix-matchable.
- Events: new payloads derive `(Serialize, Clone, Type, tauri_specta::Event)`,
  registered in `collect_events!` (main.rs). Frontend uses generated `events.x.listen`.
- AppState gains: `idea_trees: DashMap<String, Arc<IdeaController>>`,
  `simulations: DashMap<String, Arc<SimulationHandle>>` (both `Default`).

---

## Feature 1 — Opening Report (`src-tauri/src/db/search.rs`)

Reuse `search_position`'s scan (semaphore, mmap cache, `get_move_after_match`)
but aggregate richer stats. No SQL.

```rust
#[derive(Debug, Serialize, Clone, Type)]
pub struct EloBucketStat { pub bucket: String, pub total: u32, pub white: u32, pub draw: u32, pub black: u32 }
// buckets by max(white_elo, black_elo) (0 = missing, skipped):
// "<1200", "1200-1499", "1500-1799", "1800-2099", ">=2100"

#[derive(Debug, Serialize, Clone, Type)]
pub struct YearStat { pub year: String, pub total: u32, pub white: u32, pub draw: u32, pub black: u32 }

#[derive(Debug, Serialize, Clone, Type)]
pub struct OpeningMoveReport {
    pub move_: String,           // SAN of the next move ("*" = game ended here; keep row)
    pub total: u32, pub white: u32, pub draw: u32, pub black: u32,
    pub avg_elo: Option<f64>,    // mean of non-zero max-elos
    pub elo_buckets: Vec<EloBucketStat>,
    pub yearly: Vec<YearStat>,   // sorted by year asc
}

#[tauri::command]
#[specta::specta]
pub async fn opening_report(
    file: PathBuf, query: GameQuery, state: tauri::State<'_, AppState>,
) -> Result<Vec<OpeningMoveReport>, Error>
```

Rules: count `GameResult::Other/None` as draw (consistent with search_position);
result from the mover's perspective already handled by existing w/d/b counters;
year = first 4 chars of `date` (`None` → skip year stat, still counted in totals);
return rows sorted by `total` desc; expose `EloBucketStat`/`YearStat`/`OpeningMoveReport`
via `db/mod.rs` re-export. Include `elo_count` internally; don't ship it.

## Feature 2 — Monte Carlo simulation (`src-tauri/src/simulation.rs`, new)

One persistent engine process playing both sides; per ply request MultiPV=k,
softmax-sample a move by score (temperature); game ends by real rules or
ply-cap adjudication (|last cp| >= 700 → decisive for the side ahead, else draw).

```rust
#[derive(Deserialize, Type, Clone)]
pub struct SimulationConfig {
    pub fen: String, pub moves: Vec<String>,
    pub engine_path: String, pub engine_options: Vec<EngineOption>,
    pub movetime_ms: u32,        // per move (default 100)
    pub games: u32,              // default 40
    pub max_plies: u32,          // default 150
    pub multipv: u8,             // default 4
    pub temperature: f64,        // softmax temp (default 60.0 on centipawns)
}

#[derive(Serialize, Type, Clone)]
pub struct SimulationFirstMove { pub uci: String, pub san: String,
    pub total: u32, pub white: u32, pub draw: u32, pub black: u32, pub avg_length: f64 }

#[derive(Serialize, Type, Clone)]
pub struct PiecePath { pub from: String, pub to: String, pub count: u32 } // squares a1..h8

#[derive(Serialize, Type, Clone)]
pub struct SimulationResult {
    pub games: u32, pub white: u32, pub draw: u32, pub black: u32, pub avg_length: f64,
    pub first_moves: Vec<SimulationFirstMove>,        // sorted by total desc
    pub piece_paths: Vec<PiecePath>,                  // top 40 transitions overall
}

#[derive(Serialize, Clone, Type, tauri_specta::Event)]
pub struct SimulationUpdateEvent { pub id: String, pub games_done: u32,
    pub white: u32, pub draw: u32, pub black: u32 }    // emitted per finished game

#[tauri::command] #[specta::specta]
pub async fn run_simulation(id: String, config: SimulationConfig,
    app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<SimulationResult, Error>
// - spawns tokio task; SimulationHandle { shutdown_tx, cancel: Arc<AtomicBool> } in state.simulations
// - progress id = `id`; emit SimulationUpdateEvent per game; final result via command return (frontend promise)
// - check cancel between games AND between plies (kill engine promptly)

#[tauri::command] #[specta::specta]
pub async fn cancel_simulation(id: String, state: tauri::State<'_, AppState>) -> Result<(), Error>
```

Details: sampling weight = exp(cp_white_pov / temperature) per MultiPV line
(skipped for side to move = convert; clamp cp to ±1000). Draw rules: fivefold
repetition, 75-move, insufficient material — implement simply with shakmaty
(`Chess::is_insufficient_material`, halfmove clock >= 150, position repetition
HashMap count >= 5; threefold/50 with offer-free adjudication: use 3-fold/50
as draw too, ChessBase-style adjudication). Track per-game move list for
first-move tallies + from/to transitions.

## Feature 3 — Opponent-style play (`src-tauri/src/game.rs` + TS)

### Rust

```rust
#[derive(Deserialize, Serialize, Type, Clone)]
pub struct BookMove { pub uci: String, pub san: String, pub weight: u32 }

#[derive(Deserialize, Serialize, Type, Clone, Default)]
pub struct OpponentBook { pub max_ply: u16, pub positions: std::collections::HashMap<String, Vec<BookMove>> }
// key: FEN first 4 fields (placement active castling ep) of the position TO MOVE in

// PlayerConfig::Engine gains field:
pub struct EnginePlayer { ..., pub opponent_book: Option<OpponentBook> }
```

In `request_engine_move`: **before** the polyglot book check, if
`self.moves.len() < book.max_ply`, look up FEN-4 of current position in the
book; weighted-random pick among moves that are legal in the current position
(lookup UciMove; skip illegal); apply exactly like the polyglot path
(SAN available from book). Miss → fall through to polyglot/engine.
`PlayerConfig` serde must keep backward compat: `#[serde(default)]` on new field.

### Frontend (contract for the UI agent)

- `build_opponent_book(games: { moves: string /* uci, space-separated */ }[] , maxPly: number): OpponentBook` in
  `src/utils/opponent.ts` — replay each game with chessops from its start FEN
  (default startpos), for ply < maxPly record `fen4 → san/uci` weighted by
  occurrence (dedupe transpositions by fen4).
- Source of games: (a) any local database — query by player name via existing
  db search commands; (b) lichess public API `GET /api/games/user/:username?max=50&moves=true`
  (no auth, plugin-http fetch) parsed with existing PGN import utils.
- UI: "Clone opponent" modal from the Play tab setup (`BoardGame.tsx`):
  username/db-player input, color selection, engine picker (defaults to a
  Maia engine at opponent's avg Elo if installed), maxPly (default 12).
  On start: fetch games → build book → set engine `PlayerConfig` with
  `opponentBook` + MaiaElo setting → existing `startGame` flow unchanged.

## Feature 4 — Persistent analysis tree (`src-tauri/src/idea.rs`, new)

```rust
#[derive(Deserialize, Type, Clone)]
pub struct TreeConfig {
    pub fen: String, pub moves: Vec<String>,
    pub engine_path: String, pub engine_options: Vec<EngineOption>,
    pub depth: u32,        // per-node search depth (default 18)
    pub branching: u8,     // children expanded per evaluated node (default 3)
    pub max_nodes: u32,    // stop after N evaluated nodes (default 500)
}

#[derive(Serialize, Type, Clone)]
pub struct TreeNode {
    pub id: u32, pub parent: Option<u32>,
    pub uci: Option<String>,       // move from parent (None = root)
    pub san: String,
    pub fen: String,               // full fen after the move
    pub score_cp: Option<i32>,     // engine eval, WHITE POV, at `depth` (leaves evaluated; interior = minimax)
    pub children: Vec<u32>,        // child node ids in move order
    pub evaluated: bool,
}

#[derive(Serialize, Type, Clone, Default)]
pub struct IdeaTree { pub nodes: Vec<TreeNode>, pub config: Option<TreeConfig>, pub updated_at: u64 }

#[derive(Serialize, Clone, Type, tauri_specta::Event)]
pub struct TreeUpdateEvent { pub id: String, pub tab: String,
    pub nodes_done: u32, pub best_line_san: Vec<String>, pub best_score_cp: Option<i32>, pub tree: IdeaTree }
// rate-limit to 2/sec (governor), full tree attached (trees are ≤ a few thousand nodes)

pub struct IdeaController { pub shutdown_tx: watch::Sender<bool>, pub tree: Arc<tokio::sync::Mutex<IdeaTree>> }

#[tauri::command] #[specta::specta]
pub async fn start_tree_analysis(id: String, tab: String, config: TreeConfig,
    app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<(), Error>
// if state.idea_trees contains id with existing tree → resume unevaluated frontier

#[tauri::command] #[specta::specta]
pub async fn stop_tree_analysis(id: String, state: tauri::State<'_, AppState>) -> Result<IdeaTree, Error>
// signals shutdown, waits for task end (join handle in controller), persists, returns tree

#[tauri::command] #[specta::specta]
pub async fn get_tree(id: String, state: tauri::State<'_, AppState>) -> Result<Option<IdeaTree>, Error>
```

Algorithm: frontier = nodes without children. Pop frontier node (FIFO), run
MultiPV=`branching` at `depth`, take top legal lines → create child nodes
(scored None) appended to frontier; leaf gets its engine score; minimax from
leaf up to root over white-POV cp (interior node score = best-for-side-to-move
of children once ALL children evaluated; before that keep parent's own eval if
evaluated). Persist to `app_data_dir/idea/<sanitized id>.json` every 10 nodes
and on stop. Cancel between nodes via watch channel; engine `quit()` on exit.
Repetition safety: don't expand a node whose FEN already exists in the tree
(keyed by fen4) — link nothing, skip. Cap total nodes at max_nodes.

## Frontend integration summary (contract for TS agents)

- New AnalysisPanel sub-tabs: `report` exists; add `montecarlo` and `tree`
  (`AnalysisPanel.tsx` Tabs; atoms `currentAnalysisTabAtom` union extended).
- Opening Report: new sub-tab of DatabasePanel "Report" (or replace stats when
  a reference DB is set): calls `commands.openingReport(path, query)` via SWR
  on (tab, position); renders `OpeningsTable`-style rows + expandable
  Elo-bucket/year tables; row click plays the move.
- Monte Carlo panel: config form (games, movetime, multipv, temperature),
  Start (`commands.runSimulation("simulation_"+tab, cfg)`), progress via
  `useProgress`, live tally via `events.simulationUpdateEvent`, result view:
  W/D/L bar, per-first-move table, piece-path arrows on a mini board
  (Board component `arrows` prop) — v1: table + top transitions list.
- Tree panel: config (engine, depth, branching, max nodes), Start/Stop, live
  `events.treeUpdateEvent` → nodes done, best line SAN + eval, small tree
  summary table (children of root with minimax scores); resume persisted tree
  via `getTree` on mount.
- Opponent clone: modal per §3 + `src/utils/opponent.ts`.
- All new `t()` keys → `pnpm i18n:extract` once at the end (en-US only).
- Do not hand-edit `src/bindings/generated.ts`. Regenerate with
  `cargo test export_bindings` from `src-tauri` (headless; a debug app run
  also exports on startup).

## Verification plan

1. `cargo check` after Rust integration.
2. Debug app run to regenerate bindings (`pnpm dev` short run).
3. `pnpm i18n:extract`, `pnpm format`, `pnpm lint` (tsc+oxlint), `pnpm test`.
4. `pnpm build-vite` (tsc + vite build).
5. Feature smoke tests: vitest for `opponent.ts` book building and any pure
   helpers; Rust `cargo test` for simulation sampling + minimax units.
