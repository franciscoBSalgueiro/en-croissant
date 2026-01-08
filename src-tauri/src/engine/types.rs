use serde::{Deserialize, Serialize};
use specta::Type;

#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Deserialize, Serialize, Debug, Clone, Type, PartialEq, Eq)]
pub struct EngineOption {
    pub name: String,
    pub value: String,
}

#[derive(Deserialize, Serialize, Debug, Clone, Type, PartialEq, Eq)]
#[serde(tag = "t", content = "c")]
pub enum GoMode {
    PlayersTime(PlayersTime),
    Depth(u32),
    Time(u32),
    Nodes(u32),
    Infinite,
}

impl GoMode {
    pub fn to_uci_string(&self) -> String {
        match self {
            GoMode::Depth(d) => format!("go depth {}", d),
            GoMode::Time(t) => format!("go movetime {}", t),
            GoMode::Nodes(n) => format!("go nodes {}", n),
            GoMode::PlayersTime(pt) => {
                format!(
                    "go wtime {} btime {} winc {} binc {}",
                    pt.white, pt.black, pt.winc, pt.binc
                )
            }
            GoMode::Infinite => "go infinite".to_string(),
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone, Type, PartialEq, Eq)]
pub struct PlayersTime {
    pub white: u32,
    pub black: u32,
    pub winc: u32,
    pub binc: u32,
}

impl PlayersTime {
    pub fn new(white: u32, black: u32, winc: u32, binc: u32) -> Self {
        Self {
            white,
            black,
            winc,
            binc,
        }
    }
}
