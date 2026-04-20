use pgn_reader::{Nag, RawComment, RawTag, Reader, SanPlus, Skip, Visitor};
use serde::Serialize;
use specta::Type;
use std::ops::ControlFlow;

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
    type Output = Result<Vec<Token>, String>;
    type Tags = ();
    type Movetext = ();

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        ControlFlow::Continue(())
    }

    fn tag(
        &mut self,
        _tags: &mut Self::Tags,
        key: &[u8],
        value: RawTag<'_>,
    ) -> ControlFlow<Self::Output> {
        self.tokens.push(Token::Header {
            tag: String::from_utf8_lossy(key).to_string(),
            value: String::from_utf8_lossy(value.as_bytes()).to_string(),
        });
        ControlFlow::Continue(())
    }

    fn begin_movetext(&mut self, _tags: Self::Tags) -> ControlFlow<Self::Output, Self::Movetext> {
        ControlFlow::Continue(())
    }

    fn san(&mut self, _movetext: &mut Self::Movetext, san: SanPlus) -> ControlFlow<Self::Output> {
        self.tokens.push(Token::San(san.to_string()));
        ControlFlow::Continue(())
    }

    fn nag(&mut self, _movetext: &mut Self::Movetext, nag: Nag) -> ControlFlow<Self::Output> {
        self.tokens.push(Token::Nag(nag.to_string()));
        ControlFlow::Continue(())
    }

    fn begin_variation(
        &mut self,
        _movetext: &mut Self::Movetext,
    ) -> ControlFlow<Self::Output, Skip> {
        self.tokens.push(Token::ParenOpen);
        ControlFlow::Continue(Skip(false))
    }

    fn end_variation(&mut self, _movetext: &mut Self::Movetext) -> ControlFlow<Self::Output> {
        self.tokens.push(Token::ParenClose);
        ControlFlow::Continue(())
    }

    fn comment(
        &mut self,
        _movetext: &mut Self::Movetext,
        comment: RawComment<'_>,
    ) -> ControlFlow<Self::Output> {
        self.tokens.push(Token::Comment(
            String::from_utf8_lossy(comment.as_bytes()).to_string(),
        ));
        ControlFlow::Continue(())
    }

    fn outcome(
        &mut self,
        _movetext: &mut Self::Movetext,
        outcome: pgn_reader::Outcome,
    ) -> ControlFlow<Self::Output> {
        self.tokens.push(Token::Outcome(outcome.to_string()));
        ControlFlow::Continue(())
    }

    fn end_game(&mut self, _movetext: Self::Movetext) -> Self::Output {
        Ok(self.tokens.clone())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn lex_pgn(pgn: String) -> Result<Vec<Token>, Error> {
    let mut reader = Reader::new(std::io::Cursor::new(pgn.as_bytes()));

    let mut lexer = Lexer { tokens: Vec::new() };

    reader.read_game(&mut lexer)?;

    Ok(lexer.tokens)
}
