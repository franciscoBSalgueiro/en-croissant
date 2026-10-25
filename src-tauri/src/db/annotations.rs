use aix_chess_compression::{Decoder, EncodedGame, GameEvent};
use serde::{Deserialize, Serialize};
use shakmaty::{san::SanPlus, Chess, Position};
use std::collections::BTreeMap;

/// Render the new format's LOW-compressed move stream. Save the previous-move
/// position in each variation frame as well as the current position: sibling
/// variations branch from the same parent even after a nested variation ends.
pub fn decode_movetext(bytes: &[u8], fen: Option<&str>) -> Result<String, String> {
    let game = EncodedGame::from_bytes(bytes).map_err(|e| e.to_string())?;
    let Decoder::Naive(mut decoder) =
        Decoder::new_with_initial_fen(&game, fen).map_err(|e| e.to_string())?
    else {
        return Err("Database move trees require LOW compression".into());
    };
    let mut position = match fen {
        Some(fen) => super::pgn::chess_from_fen(fen)?,
        None => Chess::new(),
    };
    let mut previous: Option<Chess> = None;
    let mut stack = Vec::new();
    let mut output = Vec::new();
    let mut first_in_line = true;
    while let Some(event) = decoder.next_event() {
        match event.map_err(|e| e.to_string())? {
            GameEvent::Move(chess_move) => {
                if position.turn().is_white() || first_in_line {
                    output.push(format!(
                        "{}{}",
                        position.fullmoves(),
                        if position.turn().is_white() {
                            "."
                        } else {
                            "..."
                        }
                    ));
                }
                output.push(SanPlus::from_move(position.clone(), chess_move).to_string());
                previous = Some(position.clone());
                position.play_unchecked(chess_move);
                first_in_line = false;
            }
            GameEvent::StartVariation => {
                let branch = previous.clone().ok_or("Variation before any move")?;
                stack.push((position.clone(), previous.clone()));
                position = branch;
                decoder.set_position(position.clone());
                output.push("(".into());
                first_in_line = true;
            }
            GameEvent::EndVariation => {
                (position, previous) = stack.pop().ok_or("Unmatched variation end")?;
                decoder.set_position(position.clone());
                output.push(")".into());
                first_in_line = true;
            }
        }
    }
    if !stack.is_empty() {
        return Err("Unclosed variation in move tree".into());
    }
    Ok(output.join(" "))
}

/// Event zero is the game root. Every move and variation boundary advances the
/// event counter, so annotations in sibling variations never share an anchor.
/// The payload is rebuilt and stored together with movedata on every save.
#[derive(Default, Debug, Serialize, Deserialize)]
pub struct Annotations {
    pub events: BTreeMap<usize, Vec<Annotation>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum Annotation {
    Comment(String),
    Nag(u8),
}

impl Annotations {
    pub fn push(&mut self, event: usize, annotation: Annotation) {
        self.events.entry(event).or_default().push(annotation);
    }

    pub fn encode(&self) -> Option<Vec<u8>> {
        if self.events.is_empty() {
            return None;
        }
        let json = serde_json::to_vec(self).unwrap();
        Some(zstd::bulk::compress(&json, 3).expect("Failed to compress annotations"))
    }
}

fn decode(data: &[u8]) -> Result<Annotations, String> {
    let decoder = zstd::stream::read::Decoder::new(data).map_err(|e| e.to_string())?;
    serde_json::from_reader(std::io::BufReader::new(decoder)).map_err(|e| e.to_string())
}

/// Aix returns annotation-free PGN with whitespace-delimited move numbers and
/// SAN, and parentheses for variations. Reinsert annotations without touching
/// those move numbers (including custom starting positions).
pub fn restore_movetext(moves: &str, data: Option<&[u8]>) -> Result<String, String> {
    let Some(data) = data else {
        return Ok(moves.to_owned());
    };
    let annotations = decode(data)?;
    let mut output = String::new();
    let mut event = 0;
    append_annotations(&mut output, annotations.events.get(&event));
    let separated = moves.replace('(', " ( ").replace(')', " ) ");
    for token in separated.split_whitespace() {
        output.push_str(token);
        output.push(' ');
        if token == "(" || token == ")" || !token.ends_with('.') {
            event += 1;
            append_annotations(&mut output, annotations.events.get(&event));
        }
    }
    if annotations.events.keys().any(|anchor| *anchor > event) {
        return Err("Annotation anchor exceeds the encoded move tree".into());
    }
    Ok(output.trim().to_owned())
}

fn append_annotations(output: &mut String, annotations: Option<&Vec<Annotation>>) {
    for annotation in annotations.into_iter().flatten() {
        match annotation {
            Annotation::Comment(text) => {
                output.push('{');
                output.push_str(text);
                output.push_str("} ");
            }
            Annotation::Nag(nag) => output.push_str(&format!("${nag} ")),
        }
    }
}

pub fn write_tags(tags: &BTreeMap<String, String>) -> String {
    let mut output = String::new();
    // Keep the Seven Tag Roster first, then all optional tags.
    const ROSTER: [&str; 7] = ["Event", "Site", "Date", "Round", "White", "Black", "Result"];
    for name in ROSTER {
        if let Some(value) = tags.get(name) {
            write_tag(&mut output, name, value);
        }
    }
    for (name, value) in tags {
        if !ROSTER.contains(&name.as_str()) {
            write_tag(&mut output, name, value);
        }
    }
    output
}

fn write_tag(output: &mut String, name: &str, value: &str) {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    output.push_str(&format!("[{name} \"{escaped}\"]\n"));
}
