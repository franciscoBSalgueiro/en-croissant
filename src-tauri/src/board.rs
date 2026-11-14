//! Smart chess board support (Bluetooth Low Energy).
//!
//! The Rust side is a pure transport layer: it connects to a Chessnut Air
//! (or compatible "Smart Chess") board over BLE, subscribes to the position
//! notification characteristic, decodes the 32-byte board layout and emits a
//! [`BoardPositionEvent`] (the placement part of a FEN) whenever the physical
//! position changes. The frontend is responsible for chess logic: it compares
//! the received placement with the position currently shown and applies the
//! resulting move (or treats it as a position setup) with chessops.
//!
//! Protocol reference: https://github.com/rmarabini/chessnutair
//! - Initialization: write `21 01 00` to the write characteristic.
//! - Position frame: `01 24` + 32 layout bytes (+ 4 trailing bytes), sent on
//!   the notification characteristic roughly every 200 ms.
//! - Layout: byte `i` covers two squares of FEN row `i / 4` (row 0 = rank 8);
//!   for `j = i % 4` the pair of files starts at column `(3 - j) * 2`, the
//!   high nibble is the even file of the pair and the low nibble the odd one.
//! - Nibbles: 0=empty, 1=q, 2=k, 3=b, 4=p, 5=n, 6=R, 7=P, 8=r, 9=B, 10=N,
//!   11=Q, 12=K.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::StreamExt;
use log::{error, info, warn};
use serde::Serialize;
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;

use crate::error::Error;

/// How long to scan for the board before giving up.
const SCAN_TIMEOUT: Duration = Duration::from_secs(15);

/// GATT characteristic that carries the position notifications.
const READ_DATA_UUID: &str = "1B7E8262-2877-41C3-B46E-CF057C562023";
/// GATT characteristic used to send commands (initialization, LEDs).
const WRITE_UUID: &str = "1B7E8272-2877-41C3-B46E-CF057C562023";

/// Code written to the write characteristic after connecting to enable
/// position notifications.
const INIT_CODE: [u8; 3] = [0x21, 0x01, 0x00];
/// Header of a position notification frame.
const FRAME_HEADER: [u8; 2] = [0x01, 0x24];

/// LED command header: `0A 08` followed by one byte per rank.
const LED_HEADER: [u8; 2] = [0x0A, 0x08];
/// Number of rank bytes in an LED command.
const LED_RANKS: usize = 8;
/// Length of the layout part of a position frame (after the 2-byte header).
const LAYOUT_LEN: usize = 32;

/// Nibble values in board encoding order. Index 0 means an empty square.
const PIECE_CHARS: [&str; 13] = [
    "",
    "q",
    "k",
    "b",
    "p",
    "n",
    "R",
    "P",
    "r",
    "B",
    "N",
    "Q",
    "K",
];

#[derive(Clone, Copy, Debug, Serialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BoardStatusKind {
    Disconnected,
    Scanning,
    Connecting,
    Connected,
    Error,
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BoardStatus {
    pub status: BoardStatusKind,
    pub device: Option<String>,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct BoardPositionEvent {
    /// The board placement (first FEN field) currently on the smart board.
    pub placement: String,
}

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct BoardStatusEvent {
    pub status: BoardStatus,
}

/// Managed state for the smart board connection.
pub struct BoardManager {
    inner: Arc<Mutex<BoardState>>,
}

struct BoardState {
    status: BoardStatus,
    device: Option<bluest::Device>,
    write_characteristic: Option<bluest::Characteristic>,
    read_characteristic: Option<bluest::Characteristic>,
    /// Handle of the notification reader task (while connected).
    task: Option<tauri::async_runtime::JoinHandle<()>>,
    /// Layout of the last forwarded position frame, to filter duplicates
    /// (the board re-sends the same frame roughly every 200 ms).
    last_layout: [u8; LAYOUT_LEN],
}

impl Default for BoardManager {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(BoardState {
                status: BoardStatus {
                    status: BoardStatusKind::Disconnected,
                    device: None,
                    message: None,
                },
                device: None,
                write_characteristic: None,
                read_characteristic: None,
                task: None,
                last_layout: [0; LAYOUT_LEN],
            })),
        }
    }
}

impl BoardManager {
    pub fn status(&self) -> BoardStatus {
        self.inner
            .lock()
            .expect("board state mutex poisoned")
            .status
            .clone()
    }

    fn set_status(&self, status: BoardStatus, app: &AppHandle) {
        self.inner
            .lock()
            .expect("board state mutex poisoned")
            .status = status.clone();
        let event = BoardStatusEvent { status };
        if let Err(err) = event.emit(app) {
            warn!("Failed to emit board status event: {err}");
        }
    }
}

fn disconnected_status(message: Option<String>) -> BoardStatus {
    BoardStatus {
        status: BoardStatusKind::Disconnected,
        device: None,
        message,
    }
}

/// Returns the FEN placement (first field) for a 32-byte board layout.
///
/// Byte `i` covers two squares of FEN row `i / 4` (row 0 = rank 8); for
/// `j = i % 4` the pair of files starts at column `(3 - j) * 2`, the high
/// nibble is the even file of the pair and the low nibble the odd one.
fn layout_to_placement(layout: &[u8; LAYOUT_LEN]) -> String {
    let mut placement = String::with_capacity(68);
    // Row 0 = rank 8 .. row 7 = rank 1. Within a row the four bytes are
    // stored h/g .. a/b, so they must be emitted in reverse order (byte 3
    // first) to obtain files a..h; within each byte the high nibble is the
    // even file and the low nibble the odd one.
    for (row, chunk) in layout.chunks_exact(4).enumerate() {
        if row > 0 {
            placement.push('/');
        }
        let mut empty = 0;
        for j in (0..4).rev() {
            let byte = chunk[j];
            for nibble in [byte >> 4, byte & 0x0F] {
                let piece = PIECE_CHARS
                    .get(nibble as usize)
                    .expect("valid piece value");
                if piece.is_empty() {
                    // Empty square: FEN counts consecutive empties.
                    empty += 1;
                } else {
                    if empty > 0 {
                        placement.push_str(&empty.to_string());
                        empty = 0;
                    }
                    placement.push_str(piece);
                }
            }
        }
        if empty > 0 {
            placement.push_str(&empty.to_string());
        }
    }
    placement
}

/// Parses a position notification frame. Returns the 32-byte layout when the
/// frame header matches and the payload is long enough.
fn parse_frame(data: &[u8]) -> Option<[u8; LAYOUT_LEN]> {
    if data.len() < 2 + LAYOUT_LEN || data[..2] != FRAME_HEADER {
        return None;
    }
    let mut layout = [0u8; LAYOUT_LEN];
    layout.copy_from_slice(&data[2..2 + LAYOUT_LEN]);
    Some(layout)
}

fn uuid_from_str(s: &str) -> bluest::Uuid {
    let hex = s.to_ascii_lowercase().replace(['-', ' ', '{', '}'], "");
    let value = u128::from_str_radix(&hex, 16).unwrap_or(u128::MAX);
    bluest::Uuid::from_u128(value)
}

fn is_smartboard_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("chessnut") || lower.contains("smart chess")
}

/// Finds the smart board: first among devices already connected to the
/// system, then by scanning. If `name` is given, matches it exactly;
/// otherwise matches any name containing "chessnut" or "smart chess".
async fn find_device(
    adapter: &bluest::Adapter,
    name: Option<&str>,
) -> Result<bluest::Device, Error> {
    let wanted = name.filter(|n| !n.trim().is_empty());

    if let Ok(devices) = adapter.connected_devices().await {
        for device in devices {
            let Ok(dev_name) = device.name_async().await else {
                continue;
            };
            if wanted.map_or(is_smartboard_name(&dev_name), |n| n == &dev_name) {
                return Ok(device);
            }
        }
    }

    let mut scan = adapter.scan(&[]).await?;
    let deadline = tokio::time::Instant::now() + SCAN_TIMEOUT;
    while let Some(adv) = scan.next().await {
        if tokio::time::Instant::now() >= deadline {
            return Err(Error::BoardNotFound);
        }
        let Some(dev_name) = &adv.adv_data.local_name else {
            continue;
        };
        if wanted.map_or(is_smartboard_name(dev_name), |n| n == dev_name) {
            return Ok(adv.device);
        }
    }
    Err(Error::BoardNotFound)
}

/// Connects to the device, discovers the read-data and write characteristics
/// (they live in different services, so they are matched by UUID across all
/// services) and writes the initialization code.
async fn setup_connection(
    adapter: &bluest::Adapter,
    device: &bluest::Device,
) -> Result<(bluest::Characteristic, bluest::Characteristic), Error> {
    adapter.connect_device(device).await?;

    let read_uuid = uuid_from_str(READ_DATA_UUID);
    let write_uuid = uuid_from_str(WRITE_UUID);
    let services = device.discover_services().await?;
    let mut read_char = None;
    let mut write_char = None;
    for service in &services {
        let Ok(chars) = service.discover_characteristics().await else {
            continue;
        };
        for c in chars {
            let Ok(uuid) = c.uuid_async().await else {
                continue;
            };
            if read_char.is_none() && uuid == read_uuid {
                read_char = Some(c);
            } else if write_char.is_none() && uuid == write_uuid {
                write_char = Some(c);
            }
        }
    }

    let (Some(read_char), Some(write_char)) = (read_char, write_char) else {
        let _ = adapter.disconnect_device(device).await;
        return Err(Error::BoardNotConnected);
    };

    // Ask the board to start sending position data.
    write_char.write(&INIT_CODE).await?;

    Ok((read_char, write_char))
}

/// Subscribes to the position notifications and forwards each new board
/// layout as a [`BoardPositionEvent`]. Runs until the stream ends, errors or
/// the task is aborted.
async fn notify_loop(
    app: AppHandle,
    inner: Arc<Mutex<BoardState>>,
    read_char: bluest::Characteristic,
) {
    let mut stream = match read_char.notify().await {
        Ok(stream) => stream,
        Err(err) => {
            error!("Failed to subscribe to board notifications: {err}");
            let mut state = inner.lock().expect("board state mutex poisoned");
            state.task = None;
            state.device = None;
            state.write_characteristic = None;
            state.read_characteristic = None;
            state.status = disconnected_status(Some(err.to_string()));
            drop(state);
            let _ = BoardStatusEvent {
                status: disconnected_status(Some(err.to_string())),
            }
            .emit(&app);
            return;
        }
    };

    while let Some(frame) = stream.next().await {
        let Ok(data) = frame else {
            break;
        };
        let Some(layout) = parse_frame(&data) else {
            continue;
        };
        let mut state = inner.lock().expect("board state mutex poisoned");
        if layout == state.last_layout {
            // The board re-sends the same frame roughly every 200 ms.
            continue;
        }
        state.last_layout = layout;
        drop(state);

        let placement = layout_to_placement(&layout);
        info!("Smart board position: {placement}");
        let event = BoardPositionEvent { placement };
        if let Err(err) = event.emit(&app) {
            warn!("Failed to emit board position event: {err}");
        }
    }

    // The stream ended (disconnection, dropped subscription or app exit).
    let mut state = inner.lock().expect("board state mutex poisoned");
    state.task = None;
    state.device = None;
    state.write_characteristic = None;
    state.read_characteristic = None;
    state.last_layout = [0; LAYOUT_LEN];
    state.status = disconnected_status(None);
    drop(state);
    let _ = BoardStatusEvent {
        status: disconnected_status(None),
    }
    .emit(&app);
}

#[tauri::command]
#[specta::specta]
pub async fn smartboard_status(
    manager: tauri::State<'_, BoardManager>,
) -> Result<BoardStatus, Error> {
    Ok(manager.status())
}

/// Writes an LED command to the board.
///
/// `ranks` must hold one byte per rank, far rank first (`ranks[0]` = rank 8,
/// `ranks[7]` = rank 1). For a rank byte, the file bit for file `f`
/// (`f = 0` is the `a` file) is `1 << (7 - f)`. All-zero bytes clear the LEDs.
#[tauri::command]
#[specta::specta]
pub async fn smartboard_set_leds(
    ranks: Vec<u8>,
    manager: tauri::State<'_, BoardManager>,
) -> Result<(), Error> {
    if ranks.len() != LED_RANKS {
        return Err(Error::InvalidLedCommand);
    }
    let write_char = {
        let state = manager
            .inner
            .lock()
            .expect("board state mutex poisoned");
        if state.status.status != BoardStatusKind::Connected {
            return Err(Error::BoardNotConnected);
        }
        state.write_characteristic.clone()
    };
    let Some(write_char) = write_char else {
        return Err(Error::BoardNotConnected);
    };

    let mut command = Vec::with_capacity(2 + LED_RANKS);
    command.extend_from_slice(&LED_HEADER);
    command.extend_from_slice(&ranks);
    write_char.write(&command).await?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn smartboard_connect(
    name: Option<String>,
    app: AppHandle,
    manager: tauri::State<'_, BoardManager>,
) -> Result<BoardStatus, Error> {
    // Only one board connection at a time: stop any previous reader.
    {
        let mut state = manager
            .inner
            .lock()
            .expect("board state mutex poisoned");
        if let Some(task) = state.task.take() {
            task.abort();
        }
    }

    let Some(adapter) = bluest::Adapter::default().await else {
        manager.set_status(
            BoardStatus {
                status: BoardStatusKind::Error,
                device: None,
                message: Some("Bluetooth adapter not found".into()),
            },
            &app,
        );
        return Err(Error::BluetoothUnavailable);
    };
    if let Err(err) = adapter.wait_available().await {
        manager.set_status(
            BoardStatus {
                status: BoardStatusKind::Error,
                device: None,
                message: Some(format!("Bluetooth unavailable: {err}")),
            },
            &app,
        );
        return Err(Error::BluetoothUnavailable);
    }

    manager.set_status(
        BoardStatus {
            status: BoardStatusKind::Scanning,
            device: None,
            message: None,
        },
        &app,
    );

    let device = match find_device(&adapter, name.as_deref()).await {
        Ok(device) => device,
        Err(err) => {
            manager.set_status(
                BoardStatus {
                    status: BoardStatusKind::Error,
                    device: None,
                    message: Some(err.to_string()),
                },
                &app,
            );
            return Err(err);
        }
    };

    let device_name = device
        .name_async()
        .await
        .unwrap_or_else(|_| "Smart board".to_string());

    manager.set_status(
        BoardStatus {
            status: BoardStatusKind::Connecting,
            device: Some(device_name.clone()),
            message: None,
        },
        &app,
    );

    let (read_char, write_char) = match setup_connection(&adapter, &device).await {
        Ok(pair) => pair,
        Err(err) => {
            manager.set_status(
                BoardStatus {
                    status: BoardStatusKind::Error,
                    device: Some(device_name),
                    message: Some(err.to_string()),
                },
                &app,
            );
            return Err(err);
        }
    };

    let inner = manager.inner.clone();
    let state_read_char = read_char.clone();
    let task = tauri::async_runtime::spawn(notify_loop(app.clone(), inner, read_char));

    let mut state = manager.inner.lock().expect("board state mutex poisoned");
    state.device = Some(device);
    state.write_characteristic = Some(write_char);
    state.read_characteristic = Some(state_read_char);
    state.task = Some(task);
    state.status = BoardStatus {
        status: BoardStatusKind::Connected,
        device: Some(device_name.clone()),
        message: None,
    };
    let status = state.status.clone();
    drop(state);

    info!("Smart board connected: {device_name}");
    let event = BoardStatusEvent {
        status: status.clone(),
    };
    if let Err(err) = event.emit(&app) {
        warn!("Failed to emit board status event: {err}");
    }
    Ok(status)
}

#[tauri::command]
#[specta::specta]
pub async fn smartboard_disconnect(
    app: AppHandle,
    manager: tauri::State<'_, BoardManager>,
) -> Result<BoardStatus, Error> {
    let (task, device) = {
        let mut state = manager
            .inner
            .lock()
            .expect("board state mutex poisoned");
        (state.task.take(), state.device.take())
    };
    if let Some(task) = task {
        task.abort();
    }
    if let Some(device) = device {
        if let Some(adapter) = bluest::Adapter::default().await {
            let _ = adapter.disconnect_device(&device).await;
        }
    }

    let mut state = manager
        .inner
        .lock()
        .expect("board state mutex poisoned");
    state.write_characteristic = None;
    state.read_characteristic = None;
    state.last_layout = [0; LAYOUT_LEN];
    state.status = disconnected_status(None);
    let status = state.status.clone();
    drop(state);

    let event = BoardStatusEvent {
        status: status.clone(),
    };
    if let Err(err) = event.emit(&app) {
        warn!("Failed to emit board status event: {err}");
    }
    Ok(status)
}

/// Aborts any active board connection task. Called when the app exits.
pub fn teardown(manager: &BoardManager) {
    let mut state = manager.inner.lock().expect("board state mutex poisoned");
    if let Some(task) = state.task.take() {
        task.abort();
    }
    state.device = None;
    state.write_characteristic = None;
    state.read_characteristic = None;
    state.last_layout = [0; LAYOUT_LEN];
    state.status = disconnected_status(None);
}

#[cfg(test)]
mod tests {
    use super::*;

    const START_PLACEMENT: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

    /// The 32 layout bytes of the standard starting position (from the
    /// protocol documentation; row 0 = rank 8, first byte covers h8/g8).
    const START_LAYOUT: [u8; 32] = [
        0x58, 0x23, 0x31, 0x85, 0x44, 0x44, 0x44, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x77, 0x77, 0x77, 0x77,
        0xA6, 0xC9, 0x9B, 0x6A,
    ];

    #[test]
    fn start_position_layout_to_placement() {
        assert_eq!(layout_to_placement(&START_LAYOUT), START_PLACEMENT);
    }

    #[test]
    fn placement_after_e2e4() {
        // e2 -> e4. A file `f` (0=a..7=h) on FEN row `row` (0=rank 8) is
        // encoded in byte `row * 4 + (3 - f / 2)`: high nibble for even
        // files, low nibble for odd files.
        let mut layout = START_LAYOUT;
        // e2: f=4, rank 2 -> row 6: byte 6*4+1 = 25, high nibble.
        layout[25] &= 0x0F;
        // e4: f=4, rank 4 -> row 4: byte 4*4+1 = 17, high nibble = 0x7
        // (white pawn).
        layout[17] |= 0x70;
        assert_eq!(
            layout_to_placement(&layout),
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR"
        );
    }

    #[test]
    fn empty_board_placement() {
        let layout = [0u8; 32];
        assert_eq!(layout_to_placement(&layout), "8/8/8/8/8/8/8/8");
    }

    #[test]
    fn frame_parsing() {
        let frame = {
            let mut v = Vec::new();
            v.extend_from_slice(&FRAME_HEADER);
            v.extend_from_slice(&START_LAYOUT);
            v.extend_from_slice(&[0u8; 4]);
            v
        };
        assert_eq!(parse_frame(&frame), Some(START_LAYOUT));
        let mut bad = frame.clone();
        bad[0] = 0x02;
        assert_eq!(parse_frame(&bad), None);
        assert_eq!(parse_frame(&frame[..30]), None);
        assert_eq!(parse_frame(&[]), None);
    }

    #[test]
    fn uuid_parsing() {
        let read = uuid_from_str(READ_DATA_UUID);
        let write = uuid_from_str(WRITE_UUID);
        assert_eq!(format!("{read}"), "1b7e8262-2877-41c3-b46e-cf057c562023");
        assert_eq!(format!("{write}"), "1b7e8272-2877-41c3-b46e-cf057c562023");
    }

    #[test]
    fn device_name_matching() {
        assert!(is_smartboard_name("Chessnut Air"));
        assert!(is_smartboard_name("SMART CHESS"));
        assert!(is_smartboard_name("chessnut air 2"));
        assert!(!is_smartboard_name("Other Device"));
    }

    /// Smoke test against a physical Chessnut Air: scans for the board,
    /// connects and prints every position change for 15 seconds.
    ///
    /// ```sh
    /// cargo test board::tests::smoke_connect_real_board -- --ignored --nocapture
    /// ```
    #[tokio::test(flavor = "multi_thread")]
    #[ignore]
    async fn smoke_connect_real_board() {
        let adapter = bluest::Adapter::default().await.expect("adapter");
        adapter.wait_available().await.expect("adapter available");
        let device = find_device(&adapter, None)
            .await
            .expect("board found");
        let name = device.name_async().await.unwrap_or_default();
        let t0 = std::time::Instant::now();
        println!("Connecting to {name}");
        let (read_char, write_char) = setup_connection(&adapter, &device)
            .await
            .expect("connected");
        let t1 = std::time::Instant::now();
        println!("connect+discover+init = {}ms", t1.duration_since(t0).as_millis());
        let stream = read_char.notify().await.expect("notify");
        println!("notify = {}ms", t1.elapsed().as_millis());
        tokio::pin!(stream);
        let start = std::time::Instant::now();
        let mut last = [0u8; LAYOUT_LEN];
        while let Some(frame) = stream.next().await {
            if start.elapsed() > Duration::from_secs(15) {
                break;
            }
            let Ok(data) = frame else {
                continue;
            };
            if let Some(layout) = parse_frame(&data) {
                if layout != last {
                    last = layout;
                    println!("{}", layout_to_placement(&layout));
                }
            }
        }
        let _ = write_char;
    }
}
