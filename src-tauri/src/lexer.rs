use std::ops::ControlFlow;

use pgn_reader::{Nag, RawComment, RawTag, Reader, SanPlus, Skip, Visitor};
use serde::Serialize;
use specta::Type;

use crate::error::Error;

struct Lexer {
    tokens: Vec<Token>,
    pending_comment: String,
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
    type Tags = ();
    type Movetext = ();
    type Output = Result<Vec<Token>, String>;

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        self.tokens.clear();
        self.pending_comment.clear();
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
            value: value.decode_utf8_lossy().into_owned(),
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

    fn partial_comment(
        &mut self,
        _movetext: &mut Self::Movetext,
        comment: RawComment<'_>,
    ) -> ControlFlow<Self::Output> {
        self.pending_comment
            .push_str(&String::from_utf8_lossy(comment.as_bytes()));
        ControlFlow::Continue(())
    }

    fn comment(
        &mut self,
        _movetext: &mut Self::Movetext,
        comment: RawComment<'_>,
    ) -> ControlFlow<Self::Output> {
        let mut text = std::mem::take(&mut self.pending_comment);
        text.push_str(&String::from_utf8_lossy(comment.as_bytes()));
        self.tokens.push(Token::Comment(text));
        ControlFlow::Continue(())
    }

    fn end_game(&mut self, _movetext: Self::Movetext) -> Self::Output {
        Ok(self.tokens.clone())
    }

    fn outcome(
        &mut self,
        _movetext: &mut Self::Movetext,
        outcome: shakmaty::Outcome,
    ) -> ControlFlow<Self::Output> {
        self.tokens.push(Token::Outcome(outcome.to_string()));
        ControlFlow::Continue(())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn lex_pgn(pgn: String) -> Result<Vec<Token>, Error> {
    let mut reader = Reader::new(pgn.as_bytes());

    let mut lexer = Lexer {
        tokens: Vec::new(),
        pending_comment: String::new(),
    };

    reader.read_game(&mut lexer)?;

    Ok(lexer.tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn lexer_preserves_long_comments_and_unescapes_tag_values() {
        let comment = "é".repeat(20_000);
        let pgn = format!("[Annotator \"Ana \\\"Quoted\\\" \\\\ Name\"]\n\n1. e4 {{{comment}}} *");
        let tokens = lex_pgn(pgn).await.unwrap();
        assert!(
            matches!(&tokens[0], Token::Header { value, .. } if value == "Ana \"Quoted\" \\ Name")
        );
        let comments: Vec<_> = tokens
            .iter()
            .filter_map(|token| match token {
                Token::Comment(text) => Some(text),
                _ => None,
            })
            .collect();
        assert_eq!(comments, vec![&comment]);
    }
}
