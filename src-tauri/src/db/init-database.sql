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

  result VARCHAR,
  time_control VARCHAR,

  ply_count USMALLINT,
  utc_timestamp TIMESTAMP,
  movedata BLOB,
  -- JSON text keyed by move/variation event in movedata traversal order.
  -- VARCHAR avoids requiring DuckDB's separately installed JSON extension.
  annotations VARCHAR,
  -- Preserve all original headers, including unknown tags and partial dates.
  pgn_tags VARCHAR NOT NULL
);
