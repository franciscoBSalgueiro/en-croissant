use std::ops::ControlFlow;

use pgn_reader::{Nag, RawTag, Reader, SanPlus, Skip, Visitor};
use serde::Serialize;
use specta::Type;

use crate::error::Error;

struct Lexer;

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
    type Tags = Vec<Token>;
    type Movetext = Vec<Token>;
    type Output = Vec<Token>;

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        ControlFlow::Continue(Vec::new())
    }

    fn tag(
        &mut self,
        tags: &mut Self::Tags,
        name: &[u8],
        value: RawTag<'_>,
    ) -> ControlFlow<Self::Output> {
        tags.push(Token::Header {
            tag: String::from_utf8_lossy(name).to_string(),
            value: String::from_utf8_lossy(value.as_bytes()).to_string(),
        });
        ControlFlow::Continue(())
    }

    fn begin_movetext(
        &mut self,
        tags: Self::Tags,
    ) -> ControlFlow<Self::Output, Self::Movetext> {
        ControlFlow::Continue(tags)
    }

    fn san(
        &mut self,
        movetext: &mut Self::Movetext,
        san: SanPlus,
    ) -> ControlFlow<Self::Output> {
        movetext.push(Token::San(san.to_string()));
        ControlFlow::Continue(())
    }

    fn nag(&mut self, movetext: &mut Self::Movetext, nag: Nag) -> ControlFlow<Self::Output> {
        movetext.push(Token::Nag(nag.to_string()));
        ControlFlow::Continue(())
    }

    fn begin_variation(
        &mut self,
        movetext: &mut Self::Movetext,
    ) -> ControlFlow<Self::Output, Skip> {
        movetext.push(Token::ParenOpen);
        ControlFlow::Continue(Skip(false))
    }

    fn end_variation(&mut self, movetext: &mut Self::Movetext) -> ControlFlow<Self::Output> {
        movetext.push(Token::ParenClose);
        ControlFlow::Continue(())
    }

    fn comment(
        &mut self,
        movetext: &mut Self::Movetext,
        comment: pgn_reader::RawComment<'_>,
    ) -> ControlFlow<Self::Output> {
        movetext.push(Token::Comment(
            String::from_utf8_lossy(comment.as_bytes()).to_string(),
        ));
        ControlFlow::Continue(())
    }

    fn outcome(
        &mut self,
        movetext: &mut Self::Movetext,
        outcome: pgn_reader::Outcome,
    ) -> ControlFlow<Self::Output> {
        movetext.push(Token::Outcome(outcome.to_string()));
        ControlFlow::Continue(())
    }

    fn end_game(&mut self, movetext: Self::Movetext) -> Self::Output {
        movetext
    }
}

#[tauri::command]
#[specta::specta]
pub async fn lex_pgn(pgn: String) -> Result<Vec<Token>, Error> {
    let mut reader = Reader::new(pgn.as_bytes());
    let mut lexer = Lexer;
    let tokens = reader.read_game(&mut lexer)?.unwrap_or_default();
    Ok(tokens)
}
