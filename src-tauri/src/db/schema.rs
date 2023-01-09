use diesel::{allow_tables_to_appear_in_same_query, table};

table! {
    players (id) {
        id -> Integer,
        name -> Nullable<Text>,
        game_count -> Integer,
    }
}

table! {
    games (id) {
        id -> Integer,
        speed -> Nullable<Integer>,
        fen -> Nullable<Text>,
        site -> Nullable<Text>,
        date -> Nullable<Text>,
        white -> Integer,
        white_rating -> Nullable<Integer>,
        black -> Integer,
        black_rating -> Nullable<Integer>,
        max_rating -> Nullable<Integer>,
        outcome -> Nullable<Integer>,
        moves -> Text,
    }
}

allow_tables_to_appear_in_same_query!(players, games,);
