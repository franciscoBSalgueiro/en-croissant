use serde::{Deserialize, Serialize};
use shakmaty::uci::Uci;
use shakmaty::{fen::Fen, Outcome};
use shakmaty::{Chess, Color, FromSetup, Position};
use specta::Type;
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
    moves: Vec<Uci>,
    positions: Vec<Chess>,
    white: Player,
    black: Player,
    halfmove_clock: u32,
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
            moves: vec![],
            positions: vec![position.clone()],
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

async fn get_next_move(reader: &mut Lines<BufReader<ChildStdout>>) -> Result<PlayResult, Error> {
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

#[derive(Serialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct GameEvent {
    pub id: String,
    pub moves: Vec<String>,
    pub white_time: u32,
    pub black_time: u32,
}

impl RunningGame {
    pub async fn run(mut self, id: String, app: tauri::AppHandle) -> Result<FinishedGame, Error> {
        let winc = self.config.time_control[0].increment.unwrap_or(0);
        let binc = self.config.time_control[0].increment.unwrap_or(0);
        let mut white_time = self.config.time_control[0].time;
        let mut black_time = self.config.time_control[0].time;

        println!(
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
            match player {
                Player::Human => {}
                Player::Engine((proc, reader)) => {
                    proc.set_position(
                        &Fen::default().to_string(),
                        &self
                            .moves
                            .iter()
                            .map(|m| m.to_string())
                            .collect::<Vec<String>>(),
                    )
                    .await?;
                    proc.go(&GoMode::PlayersTime(PlayersTime::new(
                        white_time, black_time, winc, binc,
                    )))
                    .await?;

                    let time_left = match self.position.turn() {
                        Color::White => white_time,
                        Color::Black => black_time,
                    };

                    let res = select! {
                        _ = tokio::time::sleep(std::time::Duration::from_millis(time_left.into())) => {
                            PlayResult::TimeExpired
                        },
                        v = get_next_move(reader) => {
                            v?
                        }
                    };
                    match res {
                        PlayResult::Move(uci) => {
                            println!(
                                "Engine {} played: {}; {} : {}",
                                self.position.turn(),
                                uci,
                                white_time,
                                black_time
                            );

                            // add halfmove clock
                            if let Ok(m) = uci.to_move(&self.position) {
                                if m.is_zeroing() {
                                    self.halfmove_clock = 0;
                                } else {
                                    self.halfmove_clock += 1;
                                }
                            }

                            // check for threefold repetition
                            if self
                                .positions
                                .iter()
                                .filter(|p| **p == self.position)
                                .count()
                                >= 3
                            {
                                result = Some(Outcome::Draw);
                                break;
                            }

                            // check for 50 move rule
                            if self.halfmove_clock >= 100 {
                                result = Some(Outcome::Draw);
                                break;
                            }

                            self.moves.push(uci.clone());
                            self.position
                                .play_unchecked(&uci.to_move(&self.position).unwrap());
                            self.positions.push(self.position.clone());
                        }
                        PlayResult::TimeExpired => {
                            println!("Time expired for player: {:?}", self.position.turn());
                            result = Some(Outcome::Decisive {
                                winner: self.position.turn().other(),
                            });
                            break;
                        }
                    }
                }
            }
            let time_passed = now.elapsed().unwrap().as_millis() as u32;
            let time_left = match self.position.turn() {
                Color::White => &mut white_time,
                Color::Black => &mut black_time,
            };
            if time_passed > *time_left {
                println!("Time expired for player: {:?}", self.position.turn());
                result = Some(Outcome::Decisive {
                    winner: self.position.turn().other(),
                });
            } else {
                *time_left -= time_passed;
                if let Some(o) = self.position.outcome() {
                    result = Some(o);
                }
            }
            GameEvent {
                id: id.clone(),
                moves: self.moves.iter().map(|m| m.to_string()).collect(),
                white_time,
                black_time,
            }
            .emit_all(&app)?;
        }
        println!("Game finished: {:?}", result.unwrap());
        Ok(FinishedGame {
            moves: self.moves.iter().map(|m| m.to_string()).collect(),
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
