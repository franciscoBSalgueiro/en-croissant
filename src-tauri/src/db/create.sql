CREATE TABLE Info (
    Name TEXT UNIQUE NOT NULL,
    Value TEXT
);

CREATE TABLE Events (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT UNIQUE
);

CREATE TABLE Sites (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT UNIQUE
);

CREATE TABLE Players (
    ID INTEGER PRIMARY KEY,
    Name TEXT UNIQUE,
    Elo INTEGER
);

CREATE TABLE Games (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    EventID INTEGER,
    SiteID INTEGER,
    Date TEXT,
    UTCTime TEXT,
    Round INTEGER,
    WhiteID INTEGER,
    WhiteElo INTEGER,
    BlackID INTEGER,
    BlackElo INTEGER,
    WhiteMaterial INTEGER,
    BlackMaterial INTEGER,
    Result INTEGER,
    TimeControl TEXT,
    ECO TEXT,
    PlyCount INTEGER,
    FEN TEXT,
    Moves BLOB,
    PawnHome BLOB,
    FOREIGN KEY(EventID) REFERENCES Events,
    FOREIGN KEY(SiteID) REFERENCES Sites,
    FOREIGN KEY(WhiteID) REFERENCES Players,
    FOREIGN KEY(BlackID) REFERENCES Players
);

-- New table for caching UCI engine analysis results
CREATE TABLE EngineCache (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CacheKey TEXT UNIQUE NOT NULL,  -- Hash of position + engine + options
    FEN TEXT NOT NULL,
    Moves TEXT NOT NULL,           -- JSON array of moves leading to position
    EnginePath TEXT NOT NULL,
    EngineOptions TEXT NOT NULL,   -- JSON serialized engine options
    GoMode TEXT NOT NULL,          -- JSON serialized go mode
    BestMoves TEXT NOT NULL,       -- JSON serialized analysis results
    Depth INTEGER NOT NULL,
    Nodes INTEGER NOT NULL,
    CreatedAt INTEGER NOT NULL,    -- Unix timestamp
    LastAccessed INTEGER NOT NULL  -- Unix timestamp for LRU cleanup
);

-- Index for fast cache lookups
CREATE INDEX idx_engine_cache_key ON EngineCache(CacheKey);
CREATE INDEX idx_engine_cache_accessed ON EngineCache(LastAccessed);

INSERT INTO Players (ID, Name, Elo) VALUES (0, 'Unknown', NULL);
INSERT INTO Events (ID, Name) VALUES (0, 'Unknown');
INSERT INTO Sites (ID, Name) VALUES (0, 'Unknown');