pub use self::game::GameEvent;
use self::game::{FinishedGame, GameConfig, InitializingGame};

mod game;

#[tauri::command]
#[specta::specta]
pub async fn start_game(id: String, config: GameConfig, app: tauri::AppHandle) -> FinishedGame {
    println!("Starting game with config: {:?}", config);
    let game = InitializingGame::new(config);
    let game = game.init().await.unwrap();
    let game = game.run(id, app).await.unwrap();

    return game;
}
