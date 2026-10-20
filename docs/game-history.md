# Automatic game saving and recovery

Desktop games are saved automatically in the app data folder, under
`game-history-v1/`. Open **Game history** in the sidebar. The New Tab screen shows the five most recently saved games, with Analyze and Resume actions and a link to the full history.
The history persists across application restarts and is independent of tab
session storage. Existing games from before this feature cannot be reconstructed
if their session data has already been lost.

Each new game receives a unique archive ID, even when the same tab is reused.
Resuming updates that same archive. The saved record contains the initial FEN,
complete UCI/SAN move list and positions, both clocks at each move and at the
latest checkpoint, player names, engine paths/options/search limits, time controls,
opening-book configuration, source PGN, timestamps and the result/end reason.

The native controller commits a snapshot before publishing each accepted move,
including engine and book moves. A temporary file is flushed and synced before
atomic replacement; the containing directory is synced on Unix. An unsuccessful
move write rolls back the in-memory move rather than confirming an unsaved move.
Takebacks, resignations and game endings also update the snapshot. Running clocks
are checkpointed once per second, so a sudden shutdown can lose at most the time
since the last successful checkpoint, rather than an entire turn. Storage errors
are surfaced, and corrupt archives are not overwritten with empty games.

**Resume** rebuilds the position and repetition history, restores remaining time
and engine configuration, and starts a new runtime session for the same archive.
Time while the application is closed is not charged to either player. Already
running games are reopened in their existing session rather than started twice.
An engine binary or opening-book file that was moved or deleted may need to be
restored before resuming. **Analyze** and **Export PGN** remain available without
starting an engine. PGN exports include players, dates, time controls, clock
annotations and results; the JSON archive retains the full native configuration.

This currently applies to the desktop Play mode. The web edition has analysis
and studies but no play-against-engine mode yet.

Validation includes Rust persistence/rollback/result tests, recovery after a
subprocess exits without cleanup, PGN/clock conversion tests, and history UI tests
covering resume, returning to a live session after UI state loss, and errors.
