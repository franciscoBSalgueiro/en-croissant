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
    #[sql_name = "Players"]
    players (id) {
        #[sql_name = "ID"]
        id -> Integer,
        #[sql_name = "Name"]
        name -> Nullable<Text>,
        #[sql_name = "Elo"]
        elo -> Nullable<Integer>,
    }
}

diesel::table! {
    #[sql_name = "Games"]
    games (id) {
        #[sql_name = "ID"]
        id -> Integer,
        #[sql_name = "EventID"]
        event_id -> Integer,
        #[sql_name = "SiteID"]
        site_id -> Integer,
        #[sql_name = "Date"]
        date -> Nullable<Text>,
        #[sql_name = "UTCTime"]
        time -> Nullable<Text>,
        #[sql_name = "Round"]
        round -> Nullable<Text>,
        #[sql_name = "WhiteID"]
        white_id -> Integer,
        #[sql_name = "WhiteElo"]
        white_elo -> Nullable<Integer>,
        #[sql_name = "BlackID"]
        black_id -> Integer,
        #[sql_name = "BlackElo"]
        black_elo -> Nullable<Integer>,
        #[sql_name = "WhiteMaterial"]
        white_material -> Integer,
        #[sql_name = "BlackMaterial"]
        black_material -> Integer,
        #[sql_name = "Result"]
        result -> Nullable<Text>,
        #[sql_name = "TimeControl"]
        time_control -> Nullable<Text>,
        #[sql_name = "ECO"]
        eco -> Nullable<Text>,
        #[sql_name = "PlyCount"]
        ply_count -> Nullable<Integer>,
        #[sql_name = "FEN"]
        fen -> Nullable<Text>,
        #[sql_name = "Moves"]
        moves -> Binary,
        #[sql_name = "PawnHome"]
        pawn_home -> Integer,
    }
}

diesel::table! {
    #[sql_name = "Comments"]
    comments (id) {
        #[sql_name = "ID"]
        id -> Integer,
        #[sql_name = "GameID"]
        game_id -> Integer,
        #[sql_name = "Ply"]
        ply -> Nullable<Integer>,
        #[sql_name = "Comment"]
        comment -> Nullable<Text>,
    }
}

diesel::table! {
    #[sql_name = "Events"]
    events (id) {
        #[sql_name = "ID"]
        id -> Integer,
        #[sql_name = "Name"]
        name -> Nullable<Text>,
    }
}

diesel::table! {
    #[sql_name = "Info"]
    info (name) {
        #[sql_name = "Name"]
        name -> Text,
        #[sql_name = "Value"]
        value -> Nullable<Text>,
    }
}

diesel::table! {
    #[sql_name = "Sites"]
    sites (id) {
        #[sql_name = "ID"]
        id -> Integer,
        #[sql_name = "Name"]
        name -> Nullable<Text>,
    }
}

diesel::joinable!(games -> events (event_id));
diesel::joinable!(games -> sites (site_id));

diesel::allow_tables_to_appear_in_same_query!(comments, events, games, info, players, sites,);
