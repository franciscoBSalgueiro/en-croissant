use pgn_reader::{BufferedReader, Nag, RawHeader, SanPlus, Skip, Visitor};
use serde::Serialize;
use specta::Type;

use crate::error::Error;

struct Lexer {
    tokens: Vec<Token>,
}

#[derive(Serialize, Clone, Type)]
#[serde(tag = "type", content = "value")]
pub enum Token {
    ParenOpen,
    ParenClose,
    Comment(String),
    San(String),
    Header { tag: String, value: String },
    Nag(String),
    Outcome(String),
}

impl Visitor for Lexer {
    type Result = Result<Vec<Token>, String>;

    fn san(&mut self, san: SanPlus) {
        self.tokens.push(Token::San(san.to_string()));
    }

    fn header(&mut self, key: &[u8], value: RawHeader<'_>) {
        self.tokens.push(Token::Header {
            tag: String::from_utf8_lossy(key).to_string(),
            value: String::from_utf8_lossy(value.as_bytes()).to_string(),
        });
    }
    fn nag(&mut self, nag: Nag) {
        self.tokens.push(Token::Nag(nag.to_string()));
    }

    fn begin_variation(&mut self) -> Skip {
        self.tokens.push(Token::ParenOpen);
        Skip(false)
    }

    fn end_variation(&mut self) {
        self.tokens.push(Token::ParenClose);
    }

    fn comment(&mut self, comment: pgn_reader::RawComment<'_>) {
        self.tokens.push(Token::Comment(
            String::from_utf8_lossy(comment.as_bytes()).to_string(),
        ));
    }

    fn end_game(&mut self) -> Self::Result {
        Ok(self.tokens.clone())
    }

    fn outcome(&mut self, outcome: Option<shakmaty::Outcome>) {
        self.tokens.push(Token::Outcome(
            outcome.map(|o| o.to_string()).unwrap_or("*".to_string()),
        ));
    }
}

#[tauri::command]
#[specta::specta]
pub async fn lex_pgn(pgn: String) -> Result<Vec<Token>, Error> {
    let mut reader = BufferedReader::new(pgn.as_bytes());

    let mut lexer = Lexer { tokens: Vec::new() };

    reader.read_game(&mut lexer)?;

    Ok(lexer.tokens)
}
