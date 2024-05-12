use log::{debug, info};
use serde::{Deserialize, Serialize};
use shakmaty::uci::Uci;
use shakmaty::{fen::Fen, Outcome};
use shakmaty::{Chess, Color, FromSetup, Position};
use specta::Type;
use tauri::{AppHandle, Manager};
use tauri_specta::Event;
use tokio::io::{BufReader, Lines};
use tokio::process::ChildStdout;
use tokio::select;
use vampirc_uci::{parse_one, UciMessage};

use crate::chess::{EngineOption, EngineOptions, EngineProcess, GoMode, PlayersTime};
use crate::error::Error;

#[derive(Debug, Clone, Deserialize, Type)]
pub struct TimeControlField {
    pub time: u32,
    pub increment: Option<u32>,
    pub moves: Option<u32>,
}

type TimeControl = Vec<TimeControlField>;

#[derive(Debug, Clone, Deserialize, Type)]
enum PlayerConfig {
    Human,
    Engine(EngineConfig),
}

#[derive(Debug, Clone, Deserialize, Type)]
struct EngineConfig {
    path: String,
    options: Vec<EngineOption>,
}

enum Player {
    Human,
    Engine((EngineProcess, Lines<BufReader<ChildStdout>>)),
}

impl Player {
    async fn init(config: &PlayerConfig) -> Result<Self, Error> {
        match config {
            PlayerConfig::Human => Ok(Player::Human),
            PlayerConfig::Engine(config) => {
                let path = config.path.clone();
                let (mut proc, reader) = EngineProcess::new(path.into()).await?;
                proc.set_options(EngineOptions {
                    fen: Fen::default().to_string(),
                    moves: vec![],
                    extra_options: config.options.clone(),
                })
                .await?;
                Ok(Player::Engine((proc, reader)))
            }
        }
    }
}

#[derive(Debug, Clone, Deserialize, Type)]
pub struct GameConfig {
    time_control: TimeControl,
    white: PlayerConfig,
    black: PlayerConfig,
    initial_position: String,
}

pub struct InitializingGame {
    config: GameConfig,
}

pub struct RunningGame {
    config: GameConfig,
    position: Chess,
    states: Vec<GameState>,
    white: Player,
    black: Player,
    halfmove_clock: u32,
}

struct GameState {
    _move: Option<Uci>,
    position: Chess,
    white_time: u32,
    black_time: u32,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct FinishedGame {
    moves: Vec<String>,
    result: String,
}

impl InitializingGame {
    pub fn new(config: GameConfig) -> Self {
        InitializingGame { config }
    }

    pub async fn init(self) -> Result<RunningGame, Error> {
        let fen = Fen::from_ascii(self.config.initial_position.as_bytes()).unwrap_or_default();
        let position =
            Chess::from_setup(fen.as_setup().clone(), shakmaty::CastlingMode::Standard).unwrap();
        let game = RunningGame {
            white: Player::init(&self.config.white).await?,
            black: Player::init(&self.config.black).await?,
            states: vec![GameState {
                _move: None,
                position: position.clone(),
                white_time: self.config.time_control[0].time,
                black_time: self.config.time_control[0].time,
            }],
            position,
            config: self.config,
            halfmove_clock: 0,
        };
        Ok(game)
    }
}

enum PlayResult {
    Move(Uci),
    TimeExpired,
}

async fn wait_for_engine_move(
    proc: &mut EngineProcess,
    states: &[GameState],
    reader: &mut Lines<BufReader<ChildStdout>>,
    players_time: PlayersTime,
) -> Result<PlayResult, Error> {
    info!("Waiting for engine move");
    proc.set_position(
        &Fen::default().to_string(),
        &states
            .iter()
            .filter(|m| m._move.is_some())
            .map(|m| m._move.clone().unwrap().to_string())
            .collect::<Vec<String>>(),
    )
    .await?;

    proc.go(&GoMode::PlayersTime(players_time)).await?;

    while let Some(line) = reader.next_line().await? {
        let parsed = parse_one(&line);
        if let UciMessage::BestMove {
            best_move,
            ponder: _,
        } = parsed
        {
            let uci = Uci::from_ascii(best_move.to_string().as_bytes()).unwrap();
            return Ok(PlayResult::Move(uci));
        }
    }
    Err(Error::NoStdout)
}

async fn wait_for_human_move(app: &AppHandle) -> Result<PlayResult, Error> {
    info!("Waiting for human move");
    let (tx, mut rx) = tokio::sync::mpsc::channel(100);
    let id = app.listen_global("game-move", move |event| {
        tokio::task::block_in_place(|| {
            tauri::async_runtime::block_on(async {
                let m = event.payload().unwrap().replace('\"', "");
                println!("Received move: {}", m);
                let uci = Uci::from_ascii(m.as_bytes()).unwrap();

                if let Err(e) = tx.send(uci).await {
                    log::error!("Error sending move: {}", e);
                }
            });
        });
    });

    let uci = rx.recv().await.unwrap();
    app.unlisten(id);
    Ok(PlayResult::Move(uci))
}

#[derive(Serialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct GameEvent {
    pub id: String,
    pub states: Vec<(String, u32, u32)>,
}

impl RunningGame {
    fn is_draw(&self) -> bool {
        // 3-fold repetition
        if self
            .states
            .iter()
            .filter(|p| p.position == self.position)
            .count()
            >= 3
        {
            return true;
        }

        // 50 move rule
        if self.halfmove_clock >= 100 {
            return true;
        }

        false
    }

    pub async fn run(mut self, id: String, app: tauri::AppHandle) -> Result<FinishedGame, Error> {
        let winc = self.config.time_control[0].increment.unwrap_or(0);
        let binc = self.config.time_control[0].increment.unwrap_or(0);
        let mut white_time = self.config.time_control[0].time;
        let mut black_time = self.config.time_control[0].time;

        info!(
            "Starting game with time control: {:?}",
            self.config.time_control
        );
        let mut result = None;
        while result.is_none() {
            let player = match self.position.turn() {
                Color::White => &mut self.white,
                Color::Black => &mut self.black,
            };
            let now = std::time::SystemTime::now();

            let time_left = match self.position.turn() {
                Color::White => white_time,
                Color::Black => black_time,
            };

            let res = match player {
                Player::Human => {
                    select! {
                        _ = tokio::time::sleep(std::time::Duration::from_millis(time_left.into())) => {
                            PlayResult::TimeExpired
                        },
                        v = wait_for_human_move(&app)
                         => {
                            v?
                        }
                    }
                }
                Player::Engine((proc, reader)) => {
                    select! {
                        _ = tokio::time::sleep(std::time::Duration::from_millis(time_left.into())) => {
                            PlayResult::TimeExpired
                        },
                        v = wait_for_engine_move(proc, &self.states, reader, PlayersTime::new(
                            white_time, black_time, winc, binc))
                         => {
                            v?
                        }
                    }
                }
            };
            let uci = match res {
                PlayResult::Move(uci) => {
                    info!("Engine {} played: {};", self.position.turn(), uci);

                    self.position
                        .play_unchecked(&uci.to_move(&self.position).unwrap());
                    uci.clone()
                }
                PlayResult::TimeExpired => {
                    info!("Time expired for player: {:?}", self.position.turn());
                    result = Some(Outcome::Decisive {
                        winner: self.position.turn().other(),
                    });
                    break;
                }
            };
            let time_passed = now.elapsed().unwrap().as_millis() as u32;
            let time_left = match self.position.turn() {
                Color::White => &mut black_time,
                Color::Black => &mut white_time,
            };
            let increment = match self.position.turn() {
                Color::White => winc,
                Color::Black => binc,
            };
            if time_passed > *time_left {
                info!("Time expired for player: {:?}", self.position.turn());
                result = Some(Outcome::Decisive {
                    winner: self.position.turn().other(),
                });
            } else {
                *time_left -= time_passed;
                *time_left += increment;
                if let Some(o) = self.position.outcome() {
                    result = Some(o);
                }
            }
            let new_state = GameState {
                _move: Some(uci.clone()),
                position: self.position.clone(),
                white_time,
                black_time,
            };
            self.states.push(new_state);
            GameEvent {
                id: id.clone(),
                states: self
                    .states
                    .iter()
                    .map(|m| {
                        (
                            m._move.clone().map(|m| m.to_string()).unwrap_or_default(),
                            m.white_time,
                            m.black_time,
                        )
                    })
                    .collect(),
            }
            .emit_all(&app)?;

            // add halfmove clock
            if let Ok(m) = uci.to_move(&self.position) {
                if m.is_zeroing() {
                    self.halfmove_clock = 0;
                } else {
                    self.halfmove_clock += 1;
                }
            }

            if self.is_draw() {
                result = Some(Outcome::Draw);
            }
        }
        info!("Game finished: {:?}", result.unwrap());
        Ok(FinishedGame {
            moves: self
                .states
                .iter()
                .filter(|m| m._move.is_some())
                .map(|m| m._move.clone().unwrap().to_string())
                .collect(),
            result: result.unwrap().to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // #[tokio::test]
    // async fn test_game() {
    //     let config = GameConfig {
    //         time_control: vec![TimeControlField {
    //             seconds: 60,
    //             increment: Some(1),
    //             moves: None,
    //         }],
    //         white: PlayerConfig::Human,
    //         black: PlayerConfig::Engine(EngineConfig {
    //             path: "stockfish".into(),
    //             options: vec![],
    //         }),
    //         initial_position: None,
    //     };

    //     let game = InitializingGame::new(config);
    //     let game = game.init().await.unwrap();
    //     let game = game.run().await.unwrap();

    //     assert!(game.result == Outcome::Draw)
    // }
}
