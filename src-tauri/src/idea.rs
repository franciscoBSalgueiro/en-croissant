//! Persistent analysis tree (IDeA-style): background evaluation that expands
//! a minimaxed tree, resumable and cancellable. Contract:
//! docs/features-architecture.md.

use std::{
    collections::HashSet,
    path::PathBuf,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use dashmap::mapref::entry::Entry;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use shakmaty::{fen::Fen, san::SanPlus, uci::UciMove, Color, EnPassantMode, Position};
use specta::Type;
use tauri::Manager;
use tauri_specta::Event;
use tokio::{
    sync::watch,
    time::{sleep, Duration, Instant},
};
use vampirc_uci::{
    parse_one,
    uci::{Score, ScoreValue},
    UciInfoAttribute, UciMessage,
};

use crate::{
    engine::{
        parse_fen_and_apply_moves, parse_fen_to_position, BaseEngine, EngineOption, EngineReader,
        GoMode,
    },
    error::Error,
    progress::update_progress,
    AppState,
};

#[derive(Deserialize, Serialize, Type, Clone)]
pub struct TreeConfig {
    pub fen: String,
    pub moves: Vec<String>,
    pub engine_path: String,
    pub engine_options: Vec<EngineOption>,
    pub depth: u32,
    pub branching: u8,
    pub max_nodes: u32,
}

#[derive(Serialize, Deserialize, Type, Clone)]
pub struct TreeNode {
    pub id: u32,
    pub parent: Option<u32>,
    pub uci: Option<String>,
    pub san: String,
    pub fen: String,
    pub score_cp: Option<i32>,
    pub children: Vec<u32>,
    pub evaluated: bool,
}

#[derive(Serialize, Deserialize, Type, Clone, Default)]
pub struct IdeaTree {
    pub nodes: Vec<TreeNode>,
    pub config: Option<TreeConfig>,
    pub updated_at: u64,
}

#[derive(Serialize, Clone, Type, tauri_specta::Event)]
pub struct TreeUpdateEvent {
    pub id: String,
    pub tab: String,
    pub nodes_done: u32,
    pub best_line_san: Vec<String>,
    pub best_score_cp: Option<i32>,
    pub tree: IdeaTree,
}

pub struct IdeaController {
    pub shutdown_tx: tokio::sync::watch::Sender<bool>,
    pub tree: std::sync::Arc<tokio::sync::Mutex<IdeaTree>>,
}

/// Score (centipawns, white POV) used for mate-like results.
const MATE_CP: i32 = 100_000;
/// Persist + emit cadency, in evaluated nodes. Keeping this >= 10 naturally
/// stays under a couple of events per second.
const EMIT_EVERY: u32 = 10;
/// How long `stop_tree_analysis` waits for the background task to finish.
const STOP_TIMEOUT: Duration = Duration::from_secs(5);

/// One MultiPV line of a finished search.
struct PvLine {
    multipv: u16,
    uci_moves: Vec<String>,
    score_cp: Option<i32>,
}

/// A single engine process reused for every node evaluation. Driven through
/// `BaseEngine` directly because `chess::EngineProcess` only exposes `new`.
struct EngineSession {
    engine: BaseEngine,
    reader: EngineReader,
}

impl EngineSession {
    async fn new(path: &str, multipv: u8, options: &[EngineOption]) -> Result<Self, Error> {
        let mut engine = BaseEngine::spawn(PathBuf::from(path)).await?;
        engine.init_uci().await?;
        for option in options {
            engine.set_option(&option.name, &option.value).await?;
        }
        engine.set_option("MultiPV", multipv.max(1)).await?;
        let reader = engine.take_reader().ok_or(Error::EngineDisconnected)?;
        Ok(Self { engine, reader })
    }

    /// Evaluates `fen` at `depth`, returning the MultiPV lines of the final
    /// search iteration sorted best-first, with white-POV centipawn scores.
    async fn evaluate(&mut self, fen: &str, depth: u32) -> Result<Vec<PvLine>, Error> {
        let white_to_move = is_white_to_move(fen);
        self.engine.set_position(fen, &[]).await?;
        self.engine.go(&GoMode::Depth(depth.max(1))).await?;

        let mut lines: Vec<PvLine> = Vec::new();
        let mut best_move_seen = false;
        while let Some(line) = self.reader.next_line().await? {
            match parse_one(&line) {
                UciMessage::Info(attrs) => {
                    let mut multipv: u16 = 0;
                    let mut score: Option<Score> = None;
                    let mut uci_moves: Vec<String> = Vec::new();
                    for attr in attrs {
                        match attr {
                            UciInfoAttribute::MultiPv(n) => multipv = n,
                            UciInfoAttribute::Score(s) => score = Some(s),
                            UciInfoAttribute::Pv(moves) => {
                                uci_moves = moves.iter().map(|m| m.to_string()).collect();
                            }
                            _ => {}
                        }
                    }
                    if uci_moves.is_empty() {
                        continue;
                    }
                    let Some(score) = score else { continue };
                    if score.lower_bound == Some(true) || score.upper_bound == Some(true) {
                        continue;
                    }
                    let multipv = if multipv == 0 { 1 } else { multipv };
                    let pv_line = PvLine {
                        multipv,
                        uci_moves,
                        score_cp: score_to_cp(&score, white_to_move),
                    };
                    match lines.iter().position(|l| l.multipv == multipv) {
                        Some(i) => lines[i] = pv_line,
                        None => lines.push(pv_line),
                    }
                }
                UciMessage::BestMove { .. } => {
                    best_move_seen = true;
                    break;
                }
                _ => {}
            }
        }

        if !best_move_seen {
            return Err(Error::EngineDisconnected);
        }
        lines.sort_unstable_by_key(|l| l.multipv);
        Ok(lines)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn start_tree_analysis(
    id: String,
    tab: String,
    config: TreeConfig,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    // Fail fast on an invalid starting position.
    let root_pos = parse_fen_and_apply_moves(&config.fen, &config.moves)?;
    let root_fen = Fen::from_position(root_pos, EnPassantMode::Legal).to_string();

    // Publish the controller before spawning so `stop_tree_analysis` and
    // `get_tree` never miss a running analysis; resume the persisted tree
    // for this id when its root matches the requested position.
    let (tree, shutdown_rx) = match state.idea_trees.entry(id.clone()) {
        Entry::Occupied(_) => {
            info!("Tree analysis {} already running; resuming in place", id);
            return Ok(());
        }
        Entry::Vacant(vacant) => {
            let mut initial = load_persisted_tree(&app, &id)
                .ok()
                .flatten()
                .filter(|t| t.nodes.first().is_some_and(|n| n.fen == root_fen))
                .unwrap_or_else(|| IdeaTree {
                    nodes: vec![TreeNode {
                        id: 0,
                        parent: None,
                        uci: None,
                        san: String::new(),
                        fen: root_fen,
                        score_cp: None,
                        children: Vec::new(),
                        evaluated: false,
                    }],
                    config: None,
                    updated_at: now_secs(),
                });
            initial.config = Some(config.clone());
            let (shutdown_tx, shutdown_rx) = watch::channel(false);
            let tree = Arc::new(tokio::sync::Mutex::new(initial));
            vacant.insert(Arc::new(IdeaController {
                shutdown_tx,
                tree: Arc::clone(&tree),
            }));
            (tree, shutdown_rx)
        }
    };

    tokio::spawn(run_tree_analysis(id, tab, config, app, tree, shutdown_rx));
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_tree_analysis(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<IdeaTree, Error> {
    let controller = {
        let entry = state.idea_trees.get(&id);
        entry.map(|e| Arc::clone(e.value()))
    };

    let Some(controller) = controller else {
        // Not running: return the last persisted tree, if any.
        return load_persisted_tree(&app, &id)?
            .ok_or_else(|| Error::GameNotFound(format!("analysis tree {}", id)));
    };

    let _ = controller.shutdown_tx.send(true);

    // The task removes its own entry once the engine is quit and the final
    // tree is persisted; wait for the entry to disappear so the returned
    // tree is the final one.
    let deadline = Instant::now() + STOP_TIMEOUT;
    while state.idea_trees.contains_key(&id) {
        if Instant::now() >= deadline {
            warn!("Tree analysis {} did not stop in time; removing entry", id);
            state.idea_trees.remove_if(&id, |_, c| Arc::ptr_eq(c, &controller));
            break;
        }
        sleep(Duration::from_millis(50)).await;
    }

    let tree = controller.tree.lock().await.clone();
    Ok(tree)
}

#[tauri::command]
#[specta::specta]
pub async fn get_tree(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<IdeaTree>, Error> {
    let running = {
        let entry = state.idea_trees.get(&id);
        entry.map(|e| Arc::clone(&e.tree))
    };
    if let Some(tree) = running {
        return Ok(Some(tree.lock().await.clone()));
    }
    load_persisted_tree(&app, &id)
}

/// Background worker: evaluates the frontier node by node, expanding leaves
/// into children and propagating minimax scores towards the root. Exits on
/// shutdown, when `max_nodes` is reached, when the tree is complete or when
/// the engine dies; every exit path persists and cleans up.
async fn run_tree_analysis(
    id: String,
    tab: String,
    config: TreeConfig,
    app: tauri::AppHandle,
    tree: Arc<tokio::sync::Mutex<IdeaTree>>,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    // Positions already present anywhere in the tree (transposition guard).
    let mut fen4: HashSet<String> = tree
        .lock()
        .await
        .nodes
        .iter()
        .map(|n| fen4_key(&n.fen))
        .collect();
    // Nodes that were evaluated but produced no new children (terminal,
    // fully transposed or capped); never retried by the expand phase.
    let mut dead: HashSet<u32> = HashSet::new();
    let mut nodes_since_emit: u32 = 0;

    let mut engine_session =
        match EngineSession::new(&config.engine_path, config.branching, &config.engine_options)
            .await
        {
            Ok(session) => session,
            Err(e) => {
                error!(
                    "Failed to start engine {} for tree {}: {:?}",
                    config.engine_path, id, e
                );
                finalize_tree(&app, &id, &tab, &tree, config.max_nodes).await;
                return;
            }
        };

    // Emit the (possibly resumed) initial state so the UI can render it.
    {
        let snapshot = tree.lock().await.clone();
        emit_tree_update(&app, &id, &tab, &snapshot, config.max_nodes, false);
    }

    loop {
        if *shutdown_rx.borrow() {
            break;
        }

        let picked = {
            let current = tree.lock().await;
            pick_next(&current, &config, &dead)
        };
        let Some((node_id, fen)) = picked else {
            break;
        };

        let mut evaluated = false;
        match parse_fen_to_position(&fen) {
            // Terminal positions (checkmate/stalemate/...) need no engine.
            Ok(pos) if pos.is_game_over() => {
                {
                    let mut current = tree.lock().await;
                    apply_terminal(
                        &mut current,
                        node_id,
                        pos.turn() == Color::White,
                        pos.is_checkmate(),
                        &mut dead,
                    );
                    propagate_minimax(&mut current.nodes, node_id);
                }
                evaluated = true;
            }
            Ok(_) => {
                // No tree lock is held across the engine evaluation.
                let result = tokio::select! {
                    biased;
                    _ = shutdown_rx.changed() => None,
                    lines = engine_session.evaluate(&fen, config.depth) => Some(lines),
                };
                let lines = match result {
                    None => {
                        info!("Tree analysis {} shutting down", id);
                        break;
                    }
                    Some(Err(e)) => {
                        error!("Engine died during tree analysis {}: {:?}", id, e);
                        break;
                    }
                    Some(Ok(lines)) => lines,
                };
                {
                    let mut current = tree.lock().await;
                    apply_evaluation(&mut current, node_id, &lines, &config, &mut fen4, &mut dead);
                    propagate_minimax(&mut current.nodes, node_id);
                }
                evaluated = true;
            }
            Err(e) => {
                warn!("Invalid FEN for node {} in tree {}: {:?}", node_id, id, e);
                let mut current = tree.lock().await;
                if let Some(node) = current.nodes.iter_mut().find(|n| n.id == node_id) {
                    node.evaluated = true;
                }
                dead.insert(node_id);
                propagate_minimax(&mut current.nodes, node_id);
            }
        }

        if evaluated {
            nodes_since_emit += 1;
            if nodes_since_emit >= EMIT_EVERY {
                nodes_since_emit = 0;
                let snapshot = {
                    let mut current = tree.lock().await;
                    current.updated_at = now_secs();
                    current.clone()
                };
                persist_tree(&app, &id, &snapshot);
                emit_tree_update(&app, &id, &tab, &snapshot, config.max_nodes, false);
            }
        }
    }

    let _ = engine_session.engine.quit().await;
    finalize_tree(&app, &id, &tab, &tree, config.max_nodes).await;
}

/// Final persist + event + progress on any exit path, then remove the
/// controller entry so `stop_tree_analysis` observes completion.
async fn finalize_tree(
    app: &tauri::AppHandle,
    id: &str,
    tab: &str,
    tree: &Arc<tokio::sync::Mutex<IdeaTree>>,
    max_nodes: u32,
) {
    let snapshot = {
        let mut current = tree.lock().await;
        current.updated_at = now_secs();
        current.clone()
    };
    persist_tree(app, id, &snapshot);
    emit_tree_update(app, id, tab, &snapshot, max_nodes, true);
    // Remove the entry only if it still belongs to this task, so a wedged
    // task exiting late cannot remove a restarted analysis.
    let state = app.state::<AppState>();
    state.idea_trees.remove_if(id, |_, controller| {
        Arc::ptr_eq(&controller.tree, tree)
    });
    info!("Tree analysis {} finished", id);
}

/// Picks the next node to evaluate: the first unevaluated node (FIFO by id),
/// or, once every node has been evaluated, a childless leaf to expand
/// (smallest id, skipping terminal and dead nodes). `None` means the tree is
/// complete or `max_nodes` evaluated nodes were reached.
fn pick_next(tree: &IdeaTree, config: &TreeConfig, dead: &HashSet<u32>) -> Option<(u32, String)> {
    let evaluated = tree.nodes.iter().filter(|n| n.evaluated).count() as u32;
    if config.max_nodes == 0 || evaluated >= config.max_nodes {
        return None;
    }
    if let Some(node) = tree.nodes.iter().find(|n| !n.evaluated) {
        return Some((node.id, node.fen.clone()));
    }
    tree.nodes
        .iter()
        .find(|n| {
            n.evaluated
                && n.children.is_empty()
                && !dead.contains(&n.id)
                && !position_is_game_over(&n.fen)
        })
        .map(|n| (n.id, n.fen.clone()))
}

/// Records the engine evaluation of `node_id` and appends children for the
/// top `branching` lines, deduplicating positions by FEN-4 and capping the
/// total node count at `max_nodes`.
fn apply_evaluation(
    tree: &mut IdeaTree,
    node_id: u32,
    lines: &[PvLine],
    config: &TreeConfig,
    fen4: &mut HashSet<String>,
    dead: &mut HashSet<u32>,
) {
    let Some(index) = tree.nodes.iter().position(|n| n.id == node_id) else {
        return;
    };

    {
        let node = &mut tree.nodes[index];
        node.score_cp = lines.iter().find_map(|l| l.score_cp);
        node.evaluated = true;
    }

    let fen = tree.nodes[index].fen.clone();
    let Ok(pos) = parse_fen_to_position(&fen) else {
        dead.insert(node_id);
        return;
    };

    let branching = usize::from(config.branching.max(1));
    let max_nodes = config.max_nodes as usize;
    let mut next_id = tree.nodes.iter().map(|n| n.id + 1).max().unwrap_or(0);
    let mut children: Vec<TreeNode> = Vec::new();

    for line in lines.iter().take(branching) {
        if tree.nodes.len() + children.len() >= max_nodes {
            break;
        }
        let Some(uci_str) = line.uci_moves.first() else { continue };
        let Ok(uci) = UciMove::from_ascii(uci_str.as_bytes()) else {
            continue;
        };
        let Ok(mv) = uci.to_move(&pos) else {
            continue; // illegal in the node position
        };
        let san = SanPlus::from_move_and_play_unchecked(&mut pos.clone(), &mv).to_string();
        let mut child_pos = pos.clone();
        child_pos.play_unchecked(&mv);
        let child_fen = Fen::from_position(child_pos, EnPassantMode::Legal).to_string();
        if !fen4.insert(fen4_key(&child_fen)) {
            continue; // position already exists in the tree
        }
        children.push(TreeNode {
            id: next_id,
            parent: Some(node_id),
            uci: Some(uci_str.clone()),
            san,
            fen: child_fen,
            score_cp: None,
            children: Vec::new(),
            evaluated: false,
        });
        next_id += 1;
    }

    if children.is_empty() {
        dead.insert(node_id);
    }
    let child_ids: Vec<u32> = children.iter().map(|c| c.id).collect();
    tree.nodes.extend(children);
    tree.nodes[index].children.extend(child_ids);
}

/// Records the score of a terminal position without consulting the engine.
fn apply_terminal(
    tree: &mut IdeaTree,
    node_id: u32,
    white_to_move: bool,
    checkmate: bool,
    dead: &mut HashSet<u32>,
) {
    let Some(node) = tree.nodes.iter_mut().find(|n| n.id == node_id) else {
        return;
    };
    node.score_cp = Some(if checkmate {
        if white_to_move {
            -MATE_CP
        } else {
            MATE_CP
        }
    } else {
        0
    });
    node.evaluated = true;
    dead.insert(node_id);
}

/// Score of a node, provided it has been evaluated.
fn node_score(nodes: &[TreeNode], id: u32) -> Option<i32> {
    nodes
        .iter()
        .find(|n| n.id == id)
        .filter(|n| n.evaluated)
        .and_then(|n| n.score_cp)
}

/// Walks from `start_id` up to the root; every ancestor whose children are
/// all evaluated gets the minimax (max when white is to move in it, min
/// otherwise) of its children's white-POV scores.
fn propagate_minimax(nodes: &mut Vec<TreeNode>, start_id: u32) {
    let mut current = Some(start_id);
    while let Some(id) = current {
        let index = match nodes.iter().position(|n| n.id == id) {
            Some(index) => index,
            None => return,
        };
        let (parent, children) = {
            let node = &nodes[index];
            (node.parent, node.children.clone())
        };
        if !children.is_empty() && children.iter().all(|c| node_score(nodes, *c).is_some()) {
            let scores: Vec<i32> = children.iter().filter_map(|c| node_score(nodes, *c)).collect();
            let white_to_move = is_white_to_move(&nodes[index].fen);
            let score = if white_to_move {
                scores.iter().copied().max()
            } else {
                scores.iter().copied().min()
            };
            if let Some(score) = score {
                nodes[index].score_cp = Some(score);
            }
        }
        current = parent;
    }
}

/// Best line from the root, always picking the best child for the side to
/// move in the current node. Returns the SAN moves and the white-POV score
/// of the final node of the line.
fn best_line(tree: &IdeaTree) -> (Vec<String>, Option<i32>) {
    let mut sans = Vec::new();
    let mut score = tree.nodes.first().and_then(|n| n.score_cp);
    let mut current = tree.nodes.first().map(|n| n.id);

    while let Some(id) = current {
        let Some(node) = tree.nodes.iter().find(|n| n.id == id) else {
            break;
        };
        let white_to_move = is_white_to_move(&node.fen);
        let candidates = node
            .children
            .iter()
            .filter_map(|c| node_score(&tree.nodes, *c).map(|s| (*c, s)));
        let best = if white_to_move {
            candidates.max_by_key(|&(_, s)| s)
        } else {
            candidates.min_by_key(|&(_, s)| s)
        };
        match best {
            Some((child_id, child_score)) => {
                let Some(child) = tree.nodes.iter().find(|n| n.id == child_id) else {
                    break;
                };
                sans.push(child.san.clone());
                score = Some(child_score);
                current = Some(child_id);
            }
            None => break,
        }
    }
    (sans, score)
}

/// Emits a `TreeUpdateEvent` and updates the progress store.
fn emit_tree_update(
    app: &tauri::AppHandle,
    id: &str,
    tab: &str,
    tree: &IdeaTree,
    max_nodes: u32,
    finished: bool,
) {
    let nodes_done = tree.nodes.iter().filter(|n| n.evaluated).count() as u32;
    let (best_line_san, best_score_cp) = best_line(tree);
    let event = TreeUpdateEvent {
        id: id.to_string(),
        tab: tab.to_string(),
        nodes_done,
        best_line_san,
        best_score_cp,
        tree: tree.clone(),
    };
    if let Err(e) = event.emit(app) {
        warn!("Failed to emit tree update event for {}: {:?}", id, e);
    }
    let progress = if max_nodes == 0 {
        100.0
    } else {
        (nodes_done as f32 / max_nodes as f32 * 100.0).min(100.0)
    };
    let state = app.state::<AppState>();
    if let Err(e) = update_progress(&state.progress_state, app, id.to_string(), progress, finished)
    {
        warn!("Failed to update progress for tree {}: {:?}", id, e);
    }
}

/// Side to move of a FEN (defaults to white when malformed).
fn is_white_to_move(fen: &str) -> bool {
    fen.split_whitespace().nth(1) != Some("b")
}

/// First four FEN fields (placement, side, castling, en passant): the
/// position identity used to deduplicate transpositions.
fn fen4_key(fen: &str) -> String {
    fen.split_whitespace().take(4).collect::<Vec<_>>().join(" ")
}

fn position_is_game_over(fen: &str) -> bool {
    parse_fen_to_position(fen)
        .map(|pos| pos.is_game_over())
        .unwrap_or(true)
}

/// Converts a UCI score to centipawns from white's point of view; mate
/// scores are mapped just inside `MATE_CP`.
fn score_to_cp(score: &Score, white_to_move: bool) -> Option<i32> {
    let cp = match score.value {
        ScoreValue::Cp(cp) => cp.clamp(-MATE_CP + 1, MATE_CP - 1),
        ScoreValue::Mate(moves) => {
            if moves > 0 {
                MATE_CP - moves.min(999) as i32
            } else if moves < 0 {
                -MATE_CP - moves.max(-999) as i32
            } else {
                -MATE_CP
            }
        }
    };
    Some(if white_to_move { cp } else { -cp })
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Filesystem-safe form of an analysis id.
fn sanitize_id(id: &str) -> String {
    let mut sanitized: String = id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') {
                c
            } else {
                '_'
            }
        })
        .collect();
    if sanitized.starts_with('.') {
        sanitized.insert(0, '_');
    }
    sanitized.truncate(120);
    if sanitized.is_empty() {
        sanitized.push('_');
    }
    sanitized
}

/// Persistence path: `<app_data_dir>/idea/<sanitized id>.json`.
fn tree_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, Error> {
    Ok(app
        .path()
        .app_data_dir()?
        .join("idea")
        .join(format!("{}.json", sanitize_id(id))))
}

/// Best-effort atomic persist; failures are logged, never fatal.
fn persist_tree(app: &tauri::AppHandle, id: &str, tree: &IdeaTree) {
    let result = (|| -> Result<(), Error> {
        let path = tree_path(app, id)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(tree).map_err(|e| {
            Error::Io(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            )))
        })?;
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, json)?;
        std::fs::rename(&tmp, &path)?;
        Ok(())
    })();
    if let Err(e) = result {
        warn!("Failed to persist analysis tree {}: {:?}", id, e);
    }
}

/// Loads a persisted tree; `Ok(None)` when absent or unreadable.
fn load_persisted_tree(app: &tauri::AppHandle, id: &str) -> Result<Option<IdeaTree>, Error> {
    let path = tree_path(app, id)?;
    if !path.is_file() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&path)?;
    match serde_json::from_str(&data) {
        Ok(tree) => Ok(Some(tree)),
        Err(e) => {
            warn!("Failed to parse persisted analysis tree {}: {:?}", id, e);
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn startpos_fen(white: bool) -> String {
        format!(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR {} KQkq - 0 1",
            if white { "w" } else { "b" }
        )
    }

    fn node(
        id: u32,
        parent: Option<u32>,
        san: &str,
        white: bool,
        score: Option<i32>,
        children: Vec<u32>,
        evaluated: bool,
    ) -> TreeNode {
        TreeNode {
            id,
            parent,
            uci: Some(format!("e2e4{}", id)),
            san: san.to_string(),
            fen: startpos_fen(white),
            score_cp: score,
            children,
            evaluated,
        }
    }

    #[test]
    fn minimax_takes_max_for_white_and_min_for_black() {
        // root (white) -> a (black) -> [b (+50), c (-20)]
        let mut nodes = vec![
            node(0, None, "", true, None, vec![1], true),
            node(1, Some(0), "a", false, Some(10), vec![2, 3], true),
            node(2, Some(1), "b", true, Some(50), vec![], true),
            node(3, Some(1), "c", true, Some(-20), vec![], true),
        ];
        propagate_minimax(&mut nodes, 3);
        assert_eq!(nodes[1].score_cp, Some(-20)); // black to move minimizes
        assert_eq!(nodes[0].score_cp, Some(-20)); // white to move maximizes
    }

    #[test]
    fn minimax_waits_for_all_children() {
        let mut nodes = vec![
            node(0, None, "", true, None, vec![1, 2], true),
            node(1, Some(0), "a", true, Some(10), vec![], true),
            node(2, Some(0), "b", true, Some(-5), vec![], false),
        ];
        propagate_minimax(&mut nodes, 1);
        assert_eq!(nodes[0].score_cp, None); // child 2 not evaluated yet
    }

    #[test]
    fn best_line_respects_side_to_move() {
        let tree = IdeaTree {
            nodes: vec![
                node(0, None, "", true, None, vec![1, 2], true),
                node(1, Some(0), "Nf3", false, Some(30), vec![3, 4], true),
                node(2, Some(0), "e4", false, Some(-10), vec![], true),
                node(3, Some(1), "d5", true, Some(5), vec![], true),
                node(4, Some(1), "c5", true, Some(40), vec![], true),
            ],
            config: None,
            updated_at: 0,
        };
        let (san, score) = best_line(&tree);
        // White picks Nf3 (+30 over -10), black then minimizes to d5 (+5).
        assert_eq!(san, vec!["Nf3".to_string(), "d5".to_string()]);
        assert_eq!(score, Some(5));
    }

    #[test]
    fn score_conversion_white_pov() {
        let mate = Score {
            value: ScoreValue::Mate(3),
            ..Default::default()
        };
        assert_eq!(score_to_cp(&mate, true), Some(MATE_CP - 3));
        assert_eq!(score_to_cp(&mate, false), Some(-(MATE_CP - 3)));
        let mated = Score {
            value: ScoreValue::Mate(-2),
            ..Default::default()
        };
        assert_eq!(score_to_cp(&mated, true), Some(-(MATE_CP - 2)));
        let cp = Score {
            value: ScoreValue::Cp(25),
            ..Default::default()
        };
        assert_eq!(score_to_cp(&cp, false), Some(-25));
    }

    #[test]
    fn fen4_and_sanitize() {
        assert_eq!(fen4_key("rnbq w KQkq - 0 1"), "rnbq w KQkq -");
        assert_eq!(sanitize_id("tree_main"), "tree_main");
        assert_eq!(sanitize_id("a/b c"), "a_b_c");
        assert_eq!(sanitize_id(""), "_");
    }
}
