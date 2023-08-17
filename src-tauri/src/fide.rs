use std::{
    fs::File,
    io::{BufReader, BufWriter, Cursor},
};

use bincode::{config, Decode, Encode};
use quick_xml::de::from_reader;
use serde::{Deserialize, Deserializer, Serialize};
use specta::Type;
use strsim::jaro_winkler;
use tauri::{
    api::{
        http::{ClientBuilder, HttpRequestBuilder, ResponseType},
        path::{resolve_path, BaseDirectory},
    },
    Manager,
};
use zip::ZipArchive;

use crate::AppState;

#[derive(Debug, Deserialize, Serialize, Type, Clone, Decode, Encode)]
pub struct FidePlayer {
    pub fideid: u32,
    pub name: String,
    pub country: String,
    pub sex: String,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub title: Option<String>,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub w_title: Option<String>,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub o_title: Option<String>,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub foa_title: Option<String>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub rating: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub games: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub k: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub rapid_rating: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub rapid_games: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub rapid_k: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub blitz_rating: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub blitz_games: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub blitz_k: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub birthday: Option<u16>,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub flag: Option<String>,
}

fn empty_string_is_none<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    if s.is_empty() {
        Ok(None)
    } else {
        Ok(Some(s))
    }
}

fn deserialize_option_u16<'de, D>(deserializer: D) -> Result<Option<u16>, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(Option::deserialize(deserializer).unwrap_or(None))
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PlayersList {
    #[serde(rename = "player")]
    pub players: Vec<FidePlayer>,
}

async fn download_fide_db() -> PlayersList {
    let client = ClientBuilder::new().build().unwrap();
    let res = client
        .send(
            HttpRequestBuilder::new(
                "GET",
                "http://ratings.fide.com/download/players_list_xml.zip",
            )
            .unwrap()
            .response_type(ResponseType::Binary),
        )
        .await
        .unwrap();

    let data = res.bytes().await.unwrap().data;

    let cursor = Cursor::new(data);

    let mut archive = ZipArchive::new(cursor).unwrap();
    let reader = BufReader::new(archive.by_index(0).unwrap());

    let players_list: PlayersList = from_reader(reader).unwrap();
    println!("Players: {}", players_list.players.len());
    players_list
}

#[tauri::command]
#[specta::specta]
pub async fn find_fide_player(
    player: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Option<FidePlayer>, String> {
    let fide_players = state.fide_players.read().await;

    if fide_players.is_empty() {
        drop(fide_players);
        let config = config::standard();
        let fide_path = resolve_path(
            &app.config(),
            app.package_info(),
            &app.env(),
            "fide.bin",
            Some(BaseDirectory::AppData),
        )
        .unwrap();

        let mut should_download = false;

        if let Ok(f) = File::open(&fide_path) {
            let modified = f.metadata().unwrap().modified().unwrap();
            if modified.elapsed().unwrap().as_secs() > 60 * 60 * 24 * 30 {
                should_download = true;
            } else {
                let mut fide_players = state.fide_players.write().await;
                *fide_players = bincode::decode_from_reader(BufReader::new(f), config).unwrap();
            }
        } else {
            should_download = true;
        }
        if should_download {
            let players_list = download_fide_db().await;

            let mut out_file = BufWriter::new(File::create(&fide_path).unwrap());
            bincode::encode_into_std_write(&players_list.players, &mut out_file, config).unwrap();

            let mut fide_players = state.fide_players.write().await;
            *fide_players = players_list.players;
        }
    }

    let fide_players = state.fide_players.read().await;
    let mut best_match = None;
    let mut best_match_score = 0.0;

    for fide_player in (*fide_players).iter() {
        let score = jaro_winkler(&player, &fide_player.name);
        if score > best_match_score {
            best_match = Some(fide_player);
            best_match_score = score;
        }
    }

    println!("Best match: {}", best_match_score);

    if best_match_score > 0.8 {
        Ok(best_match.cloned())
    } else {
        Err("No match found".to_string())
    }
}
