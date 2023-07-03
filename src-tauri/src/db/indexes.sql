CREATE INDEX IF NOT EXISTS games_date_idx ON Games(Date);
CREATE INDEX IF NOT EXISTS games_white_idx ON Games(WhiteID);
CREATE INDEX IF NOT EXISTS games_black_idx ON Games(BlackID);
CREATE INDEX IF NOT EXISTS games_result_idx ON Games(Result);
CREATE INDEX IF NOT EXISTS games_white_elo_idx ON Games(WhiteElo);
CREATE INDEX IF NOT EXISTS games_black_elo_idx ON Games(BlackElo);
CREATE INDEX IF NOT EXISTS games_plycount_idx ON Games(PlyCount);
