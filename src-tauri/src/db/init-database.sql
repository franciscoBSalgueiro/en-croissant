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
  annotations BLOB
);
