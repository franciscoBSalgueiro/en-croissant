CREATE TABLE games (
  event VARCHAR,
  site VARCHAR,
  round VARCHAR,
  fen VARCHAR,

  white VARCHAR,
  black VARCHAR,
  white_rating SMALLINT,
  black_rating SMALLINT,
  white_title VARCHAR,
  black_title VARCHAR,

  -- clocks_white USMALLINT[],
  -- clocks_black USMALLINT[],
  -- evals SMALLINT[],
  -- time_initial USMALLINT,
  -- time_increment UTINYINT,

  result VARCHAR,
  -- termination VARCHAR,

  ply_count USMALLINT,
  utc_timestamp TIMESTAMP,
  movedata BLOB
);