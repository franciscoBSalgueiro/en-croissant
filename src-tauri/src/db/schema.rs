diesel::table! {
    puzzles (id) {
        id -> Integer,
        fen -> Text,
        moves -> Text,
        rating -> Integer,
        rating_deviation -> Integer,
        popularity -> Integer,
        nb_plays -> Integer,
    }
}

diesel::table! {
    themes (id) {
        id -> Integer,
        name -> Text,
    }
}

diesel::table! {
    puzzle_themes (puzzle_id, theme_id) {
        puzzle_id -> Integer,
        theme_id -> Integer,
    }
}

diesel::joinable!(puzzle_themes -> puzzles (puzzle_id));
diesel::joinable!(puzzle_themes -> themes (theme_id));
diesel::allow_tables_to_appear_in_same_query!(puzzles, themes, puzzle_themes);
