use crate::error::Error;
use shakmaty::{
    fen::Fen, san::SanPlus, CastlingMode, Chess, FromSetup, Move, Position, PositionError,
};
use std::io::{self, ErrorKind};

pub const VARIATION_START_MARKER: u8 = 255;
pub const VARIATION_END_MARKER: u8 = 254;
pub const COMMENT_MARKER: u8 = 253;
pub const NAG_MARKER: u8 = 252;

pub fn encode_move(m: &Move, chess: &Chess) -> Result<u8, Error> {
    let moves = chess.legal_moves();
    Ok(moves.iter().position(|x| x == m).unwrap() as u8)
}

pub fn decode_move(byte: u8, chess: &Chess) -> Option<Move> {
    let legal_moves = chess.legal_moves();
    legal_moves.get(byte as usize).cloned()
}

pub fn encode_comment(comment: &str, output: &mut Vec<u8>) {
    for chunk in comment.as_bytes().chunks(u16::MAX as usize) {
        output.push(COMMENT_MARKER);
        output.extend_from_slice(&(chunk.len() as u16).to_le_bytes());
        output.extend_from_slice(chunk);
    }
}

pub fn encode_nag(nag: &str, output: &mut Vec<u8>) {
    for chunk in nag.as_bytes().chunks(u16::MAX as usize) {
        output.push(NAG_MARKER);
        output.extend_from_slice(&(chunk.len() as u16).to_le_bytes());
        output.extend_from_slice(chunk);
    }
}

pub struct MainlineMoveBytesIter<'a> {
    bytes: &'a [u8],
    cursor: usize,
    variation_depth: usize,
}

impl<'a> MainlineMoveBytesIter<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self {
            bytes,
            cursor: 0,
            variation_depth: 0,
        }
    }
}

impl Iterator for MainlineMoveBytesIter<'_> {
    type Item = u8;

    fn next(&mut self) -> Option<Self::Item> {
        while self.cursor < self.bytes.len() {
            let byte = self.bytes[self.cursor];
            self.cursor += 1;

            match byte {
                VARIATION_START_MARKER => {
                    self.variation_depth = self.variation_depth.saturating_add(1);
                }
                VARIATION_END_MARKER => {
                    self.variation_depth = self.variation_depth.saturating_sub(1);
                }
                COMMENT_MARKER => {
                    if self.cursor + 2 > self.bytes.len() {
                        return None;
                    }
                    let len = u16::from_le_bytes([
                        self.bytes[self.cursor],
                        self.bytes[self.cursor + 1],
                    ]) as usize;
                    self.cursor += 2;
                    self.cursor = self.cursor.saturating_add(len).min(self.bytes.len());
                }
                NAG_MARKER => {
                    if self.cursor + 2 > self.bytes.len() {
                        return None;
                    }
                    let len = u16::from_le_bytes([
                        self.bytes[self.cursor],
                        self.bytes[self.cursor + 1],
                    ]) as usize;
                    self.cursor += 2;
                    self.cursor = self.cursor.saturating_add(len).min(self.bytes.len());
                }
                _ if self.variation_depth == 0 => return Some(byte),
                _ => {}
            }
        }

        None
    }
}

pub fn iter_mainline_move_bytes(bytes: &[u8]) -> MainlineMoveBytesIter<'_> {
    MainlineMoveBytesIter::new(bytes)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodedGameNode {
    Move(String),
    Nag(String),
    Comment(String),
    Variation(Vec<DecodedGameNode>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedGame {
    pub nodes: Vec<DecodedGameNode>,
}

struct DecodeFrame {
    nodes: Vec<DecodedGameNode>,
    chess: Chess,
    pre_move_positions: Vec<Chess>,
}

fn invalid_data(message: &str) -> Error {
    Error::Io(io::Error::new(ErrorKind::InvalidData, message.to_string()))
}

pub fn decode_game(moves_bytes: &[u8], initial_fen: Fen) -> Result<DecodedGame, Error> {
    let root_position = Chess::from_setup(initial_fen.into(), CastlingMode::Chess960)
        .or_else(PositionError::ignore_too_much_material)
        .unwrap();

    let mut stack = vec![DecodeFrame {
        nodes: Vec::new(),
        chess: root_position,
        pre_move_positions: Vec::new(),
    }];

    let mut cursor = 0usize;
    while cursor < moves_bytes.len() {
        let byte = moves_bytes[cursor];
        cursor += 1;

        match byte {
            VARIATION_START_MARKER => {
                let parent_position = stack
                    .last()
                    .map(|frame| {
                        frame
                            .pre_move_positions
                            .last()
                            .cloned()
                            .unwrap_or_else(|| frame.chess.clone())
                    })
                    .ok_or_else(|| invalid_data("Missing parent frame while opening variation"))?;
                stack.push(DecodeFrame {
                    nodes: Vec::new(),
                    chess: parent_position,
                    pre_move_positions: Vec::new(),
                });
            }
            VARIATION_END_MARKER => {
                if stack.len() == 1 {
                    return Err(invalid_data("Unbalanced variation end marker"));
                }
                let frame = stack.pop().ok_or_else(|| {
                    invalid_data("Missing variation frame while closing variation")
                })?;
                if let Some(parent) = stack.last_mut() {
                    parent.nodes.push(DecodedGameNode::Variation(frame.nodes));
                }
            }
            COMMENT_MARKER => {
                if cursor + 2 > moves_bytes.len() {
                    return Err(invalid_data("Truncated comment length marker"));
                }
                let len = u16::from_le_bytes([moves_bytes[cursor], moves_bytes[cursor + 1]])
                    as usize;
                cursor += 2;
                if cursor + len > moves_bytes.len() {
                    return Err(invalid_data("Truncated comment payload"));
                }
                let payload = &moves_bytes[cursor..cursor + len];
                cursor += len;

                let comment = String::from_utf8_lossy(payload).to_string();
                if let Some(frame) = stack.last_mut() {
                    frame.nodes.push(DecodedGameNode::Comment(comment));
                }
            }
            NAG_MARKER => {
                if cursor + 2 > moves_bytes.len() {
                    return Err(invalid_data("Truncated NAG length marker"));
                }
                let len = u16::from_le_bytes([moves_bytes[cursor], moves_bytes[cursor + 1]])
                    as usize;
                cursor += 2;
                if cursor + len > moves_bytes.len() {
                    return Err(invalid_data("Truncated NAG payload"));
                }
                let payload = &moves_bytes[cursor..cursor + len];
                cursor += len;

                let nag = String::from_utf8_lossy(payload).to_string();
                if let Some(frame) = stack.last_mut() {
                    frame.nodes.push(DecodedGameNode::Nag(nag));
                }
            }
            move_idx => {
                let frame = stack
                    .last_mut()
                    .ok_or_else(|| invalid_data("Missing frame while decoding move"))?;
                let pre_move_position = frame.chess.clone();
                let m = decode_move(move_idx, &frame.chess)
                    .ok_or_else(|| invalid_data("Invalid move index for current position"))?;
                let san = SanPlus::from_move_and_play_unchecked(&mut frame.chess, &m).to_string();
                frame.pre_move_positions.push(pre_move_position);
                frame.nodes.push(DecodedGameNode::Move(san));
            }
        }
    }

    if stack.len() != 1 {
        return Err(invalid_data("Unclosed variation markers in encoded game"));
    }

    let root = stack
        .pop()
        .ok_or_else(|| invalid_data("Missing root decode frame at end of parsing"))?;
    Ok(DecodedGame { nodes: root.nodes })
}

fn render_nodes(nodes: &[DecodedGameNode]) -> String {
    let mut out = String::new();
    let mut prev_was_move = false;
    for node in nodes {
        match node {
            DecodedGameNode::Move(san) => {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push_str(san);
                prev_was_move = true;
            }
            DecodedGameNode::Nag(nag) => {
                let rendered_nag = match nag.as_str() {
                    "$1" => "!",
                    "$2" => "?",
                    "$3" => "!!",
                    "$4" => "??",
                    "$5" => "!?",
                    "$6" => "?!",
                    _ => nag,
                };

                if rendered_nag.starts_with('$') {
                    if !out.is_empty() {
                        out.push(' ');
                    }
                    out.push_str(rendered_nag);
                } else if prev_was_move {
                    out.push_str(rendered_nag);
                } else {
                    if !out.is_empty() {
                        out.push(' ');
                    }
                    out.push_str(rendered_nag);
                }
                prev_was_move = false;
            }
            DecodedGameNode::Comment(comment) => {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push('{');
                out.push_str(comment);
                out.push('}');
                prev_was_move = false;
            }
            DecodedGameNode::Variation(children) => {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push('(');
                out.push_str(&render_nodes(children));
                out.push(')');
                prev_was_move = false;
            }
        }
    }
    out
}

pub fn decode_game_to_movetext(moves_bytes: &[u8], initial_fen: Fen) -> Result<String, Error> {
    let decoded = decode_game(moves_bytes, initial_fen)?;
    Ok(render_nodes(&decoded.nodes))
}

pub fn decode_moves(moves_bytes: Vec<u8>, initial_fen: Fen) -> Result<Vec<String>, Error> {
    let mut chess = Chess::from_setup(initial_fen.into(), CastlingMode::Chess960)
        .or_else(PositionError::ignore_too_much_material)
        .unwrap();
    let mut moves = Vec::new();
    for byte in iter_mainline_move_bytes(&moves_bytes) {
        let Some(m) = decode_move(byte, &chess) else {
            break;
        };
        let san = SanPlus::from_move_and_play_unchecked(&mut chess, &m);
        moves.push(san.to_string());
    }
    Ok(moves)
}

#[cfg(test)]
mod tests {
    use super::*;

    use shakmaty::{Role, Square};

    #[test]
    fn test_encoding() {
        let mut chess = Chess::default();
        let m = Move::Normal {
            role: Role::Pawn,
            from: Square::E2,
            to: Square::E4,
            capture: None,
            promotion: None,
        };

        let byte = encode_move(&m, &chess).unwrap();
        let m2 = decode_move(byte, &chess).unwrap();
        assert_eq!(m, m2);

        chess.play_unchecked(&m);

        let m = Move::Normal {
            role: Role::Pawn,
            from: Square::E7,
            to: Square::E5,
            capture: None,
            promotion: None,
        };
        let byte = encode_move(&m, &chess).unwrap();
        let m2 = decode_move(byte, &chess).unwrap();
        assert_eq!(m, m2);
    }

    #[test]
    fn test_mainline_iterator_ignores_variations_and_comments() {
        let bytes = vec![
            1,
            NAG_MARKER,
            2,
            0,
            b'!',
            b'!',
            VARIATION_START_MARKER,
            2,
            VARIATION_START_MARKER,
            3,
            VARIATION_END_MARKER,
            COMMENT_MARKER,
            3,
            0,
            b'f',
            b'o',
            b'o',
            4,
            VARIATION_END_MARKER,
            COMMENT_MARKER,
            3,
            0,
            b'b',
            b'a',
            b'r',
            5,
        ];

        let result: Vec<u8> = iter_mainline_move_bytes(&bytes).collect();
        assert_eq!(result, vec![1, 5]);
    }

    #[test]
    fn test_decode_game_with_nags() {
        let mut bytes = Vec::new();
        let mut chess = Chess::default();
        let m = decode_move(12, &chess).unwrap();
        bytes.push(encode_move(&m, &chess).unwrap());
        chess.play_unchecked(&m);

        encode_nag("!", &mut bytes);
        bytes.push(VARIATION_START_MARKER);

        let mut variation = Chess::default();
        let v = decode_move(12, &variation).unwrap();
        bytes.push(encode_move(&v, &variation).unwrap());
        variation.play_unchecked(&v);
        encode_nag("$2", &mut bytes);
        bytes.push(VARIATION_END_MARKER);

        let m2 = decode_move(12, &chess).unwrap();
        bytes.push(encode_move(&m2, &chess).unwrap());
        encode_nag("$1", &mut bytes);

        let movetext = decode_game_to_movetext(&bytes, Fen::default()).unwrap();
        assert_eq!(movetext, "e4! (e4?) e5!");
    }

    #[test]
    fn test_decode_game_nested_variations_and_comments() {
        let mut bytes = Vec::new();

        let mut root = Chess::default();
        let branch_root = root.clone();
        let m_e4 = decode_move(12, &root).unwrap();
        bytes.push(encode_move(&m_e4, &root).unwrap());
        root.play_unchecked(&m_e4);

        encode_comment("hello", &mut bytes);

        bytes.push(VARIATION_START_MARKER);
        let mut var = branch_root.clone();
        let var_branch_root = var.clone();
        let m_var_first = decode_move(12, &var).unwrap();
        bytes.push(encode_move(&m_var_first, &var).unwrap());
        var.play_unchecked(&m_var_first);

        bytes.push(VARIATION_START_MARKER);
        let m_var_nested = decode_move(0, &var_branch_root).unwrap();
        bytes.push(encode_move(&m_var_nested, &var_branch_root).unwrap());
        bytes.push(VARIATION_END_MARKER);

        encode_comment("nest", &mut bytes);
        bytes.push(VARIATION_END_MARKER);

        let m_mainline_second = decode_move(12, &root).unwrap();
        bytes.push(encode_move(&m_mainline_second, &root).unwrap());

        let decoded = decode_game(&bytes, Fen::default()).unwrap();

        let expected_first = SanPlus::from_move(Chess::default(), &m_e4).to_string();
        let expected_var_first = SanPlus::from_move(root.clone(), &m_var_first).to_string();
        let expected_nested = SanPlus::from_move(var_branch_root, &m_var_nested).to_string();
        let expected_mainline_second = SanPlus::from_move(root, &m_mainline_second).to_string();

        assert_eq!(
            decoded.nodes,
            vec![
                DecodedGameNode::Move(expected_first),
                DecodedGameNode::Comment("hello".to_string()),
                DecodedGameNode::Variation(vec![
                    DecodedGameNode::Move(expected_var_first),
                    DecodedGameNode::Variation(vec![DecodedGameNode::Move(expected_nested)]),
                    DecodedGameNode::Comment("nest".to_string()),
                ]),
                DecodedGameNode::Move(expected_mainline_second),
            ]
        );
    }
}
