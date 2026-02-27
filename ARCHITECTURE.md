# En Croissant Architecture Primer

**Date:** 2026-02-27
**App Version:** v0.14.2 (fork: DarrellThomas/en-croissant)
**Stack:** Tauri v2 (Rust) + React 19 (TypeScript) + Vite

---

## What Is Tauri?

Tauri is a framework for building desktop apps. Instead of shipping a full browser like Electron does, Tauri uses the OS's built-in webview for the UI and a Rust process for the backend. The result is a small, fast binary.

The two halves communicate over IPC (inter-process communication):

```
+---------------------------+       IPC        +---------------------------+
|       Rust Backend        | <--------------> |    React/TS Frontend      |
|                           |   (commands +    |                           |
|  - Chess engines (UCI)    |    events)       |  - Chessboard UI          |
|  - SQLite database        |                  |  - Analysis panels        |
|  - File I/O               |                  |  - Settings               |
|  - PGN parsing            |                  |  - Game tree navigation   |
|  - Position search index  |                  |  - TTS narration          |
+---------------------------+                  +---------------------------+
        src-tauri/src/                                   src/
```

---

## The Rust Side: src-tauri/src/

Rust handles everything that needs to be fast or needs system access.

### Entry Point: main.rs

Registers ~50 commands that the frontend can call, initializes plugins (filesystem, dialog, HTTP, shell, logging, updater), and starts the app window.

Commands are defined with a macro:

```rust
#[tauri::command]
async fn get_best_moves(id: String, engine: String, ...) -> Result<...> {
    // spawn UCI engine, return analysis
}
```

The `specta` crate auto-generates TypeScript type definitions from these Rust functions, so the frontend gets full type safety with zero manual effort.

### Key Modules

| Module | Size | What It Does |
|--------|------|-------------|
| `db/mod.rs` | 55KB | SQLite database via Diesel ORM — game queries, player stats, imports, position search |
| `game.rs` | 34KB | Live game engine — manages engine-vs-human and engine-vs-engine games, time controls, move validation |
| `chess.rs` | 24KB | Engine analysis — spawns UCI engines, streams best-move results back to frontend via events |
| `engine/` | ~15KB | UCI protocol implementation — process spawning, stdin/stdout pipes, multi-PV support |
| `pgn.rs` | 7KB | PGN file reading/writing/tokenizing |
| `opening.rs` | 5KB | Opening name lookup from FEN (binary data baked into the app) |
| `puzzle.rs` | 5KB | Lichess puzzle database — memory-mapped random access |
| `fs.rs` | 4KB | File downloads with resume, executable permission setting |
| `sound.rs` | 5KB | Local HTTP server for audio streaming (Linux audio workaround) |
| `oauth.rs` | | OAuth2 flow for Lichess/Chess.com account linking |

### Design Patterns

- **Async everywhere:** Tokio runtime, non-blocking I/O
- **Concurrent state:** `DashMap` (concurrent HashMap) for engine processes, DB connections, caches
- **Connection pooling:** r2d2 manages SQLite connection pools
- **Memory-mapped search:** Position lookup via mmap'd binary index for instant results
- **Event streaming:** Rust emits events (best moves, clock ticks, game over) that React listens to in real-time

---

## The React/TypeScript Side: src/

### Build Pipeline: Vite

`vite.config.ts` configures:
- **React plugin** with Babel compiler
- **TanStack Router plugin** — auto-generates route tree from the `routes/` folder
- **Vanilla Extract** — zero-runtime CSS-in-JS
- **Path alias:** `@` maps to `./src`
- **Dev server** on port 1420

Build flow:
```
pnpm dev   → Vite on :1420 + Tauri opens webview pointing to it
pnpm build → tsc (typecheck) → vite build (bundle to dist/) → tauri build (native binary)
```

### Entry: App.tsx

The root component:
- Initializes Tauri plugins (log, process, updater)
- Loads user preferences from persistent atoms
- Sets up Mantine UI theme
- Registers the router
- Checks for app updates

### State Management

**Jotai atoms** (`src/state/atoms.ts`, 21.5KB) — lightweight reactive state:

| Category | Examples |
|----------|---------|
| Tabs | `tabsAtom`, `activeTabAtom` (multi-document interface) |
| Directories | `storedDocumentDirAtom`, `storedDatabasesDirAtom` |
| UI prefs | `primaryColorAtom`, `fontSizeAtom`, `pieceSetAtom` |
| Engine | `engineMovesFamily`, `engineProgressFamily` (per-tab via atomFamily) |
| TTS | `ttsEnabledAtom`, `ttsApiKeyAtom`, `ttsVoiceIdAtom`, `ttsVolumeAtom`, `ttsSpeedAtom`, `ttsAutoNarrateAtom` |

Atoms with `atomWithStorage()` persist to localStorage automatically.

**Zustand stores** for complex domain state:
- `src/state/store/tree.ts` (22KB) — game tree navigation, move branching, annotations, comments. Uses Immer for immutable updates.
- `src/state/store/database.ts` — database view filters, selected game, pagination

### Routing: TanStack Router

File-based routing in `src/routes/`:
```
routes/
  __root.tsx          # Root layout (AppShell, menu bar)
  index.tsx           # Home/dashboard
  databases/          # Database browsing
  accounts.tsx        # Lichess/Chess.com accounts
  settings.tsx        # App preferences
  engines.tsx         # Engine management
```

### Components: src/components/

| Group | Files | Purpose |
|-------|-------|---------|
| `boards/` | 19 files | Chessboard (chessground), move input, eval bar, analysis display, promotion modal, arrow drawing |
| `panels/` | ~20 files | Side panels: engine analysis (BestMoves), database position search, annotation editing, game info, practice mode |
| `databases/` | 14 files | Database UI: game table, player table, detail cards, filtering |
| `settings/` | ~10 files | Preference forms, engine paths, TTS settings |
| `home/` | 9 files | Account cards, import UI |
| `common/` | 4 files | Shared: TreeStateContext, material display |
| `tabs/` | 2 files | Multi-tab bar |

### Utilities: src/utils/

| File | Purpose |
|------|---------|
| `chess.ts` (18KB) | Move formatting, PGN serialization, coordinate flipping |
| `treeReducer.ts` | Game tree data structure (TreeNode with children, annotations, comments) |
| `chessops.ts` | FEN manipulation via chessops library |
| `engines.ts` | Engine detection and validation |
| `db.ts` | Database query helpers, Tauri invoke wrappers |
| `tts.ts` (13KB) | ElevenLabs TTS — SAN-to-spoken, comment preprocessing, caching, precache |
| `score.ts` | Eval score formatting (centipawns, mate-in-N) |
| `directories.ts` | Tauri path resolution for all app directories |
| `lichess/`, `chess.com/` | Online platform integration (OAuth, game import, explorer API) |

---

## How Frontend Calls Rust

### Commands (request/response)

Specta generates TypeScript bindings in `src/bindings/generated.ts`:

```typescript
// Auto-generated from Rust #[tauri::command] functions
export const commands = {
  async getBestMoves(id, engine, tab, goMode, options) {
    return await TAURI_INVOKE("get_best_moves", { id, engine, tab, goMode, options });
  },
  // ~50 more commands...
}
```

React components call them like normal async functions:

```typescript
import { commands } from "@/bindings";
const result = await commands.getBestMoves(id, engine, tab, goMode, options);
```

### Events (streaming, Rust to React)

For real-time data (engine analysis, clock ticks, game moves):

```
Rust:  app.emit("best_moves_payload", BestMovesPayload { depth: 24, ... })
         ↓
React: listen("best_moves_payload", (event) => updateBestMoves(event.payload))
```

### Tauri Plugins

The app uses several official plugins for system access:

| Plugin | Purpose |
|--------|---------|
| `@tauri-apps/plugin-fs` | Read/write files |
| `@tauri-apps/plugin-dialog` | File pickers, message boxes |
| `@tauri-apps/plugin-http` | HTTP client (engine downloads) |
| `@tauri-apps/plugin-shell` | Execute UCI engines |
| `@tauri-apps/plugin-updater` | Auto-update checks |
| `@tauri-apps/plugin-log` | Structured logging |
| `@tauri-apps/plugin-os` | CPU/RAM detection |

---

## Data Flow Examples

### Engine Analysis

```
User clicks "Analyze"
  → React calls commands.getBestMoves(position, engine, settings)
  → Rust spawns UCI engine process, sends position via stdin
  → Engine writes "info depth 18 score cp 45 pv e2e4 ..." to stdout
  → Rust parses UCI output, emits BestMovesPayload event
  → React's EvalListener receives event, updates atoms
  → UI re-renders: eval bar moves, best move arrows appear
  → User clicks "Stop" → commands.stopEngine() → Rust sets AtomicBool flag
```

### Database Position Search

```
User reaches a position on the board
  → React calls commands.searchPosition(fen, gameQuery)
  → Rust queries memory-mapped binary search index
  → Returns: PositionStats (wins/losses/draws) + matching games
  → React renders DatabasePanel with results table
```

### TTS Narration (our feature)

```
User steps forward with arrow key
  → tree.ts dispatches MAKE_MOVE, checks isAutoNarrateEnabled()
  → Calls speakMoveNarration(san, comment, annotations, halfMoves)
  → tts.ts: buildNarration() assembles text
       sanToSpoken("Nf3+") → "Knight f3, check"
       cleanCommentForTTS(comment) → strips [%eval], expands inline SAN
  → speakText() checks audioCache
       HIT  → play blob URL instantly
       MISS → fetch from ElevenLabs API → cache → play
  → HTMLAudioElement.play() with volume and playbackRate from atoms
```

---

## Directory Map

```
en-croissant/
├── src-tauri/                    # RUST BACKEND
│   ├── src/
│   │   ├── main.rs              # Entry, command registration, plugins
│   │   ├── chess.rs             # Engine analysis
│   │   ├── game.rs              # Live game management
│   │   ├── db/                  # SQLite database (largest module)
│   │   ├── engine/              # UCI protocol
│   │   ├── pgn.rs               # PGN parsing
│   │   ├── puzzle.rs            # Puzzle database
│   │   └── opening.rs           # Opening lookup
│   ├── Cargo.toml               # Rust dependencies
│   ├── tauri.conf.json          # Tauri config
│   └── capabilities/main.json   # Security permissions
│
├── src/                          # REACT/TS FRONTEND
│   ├── App.tsx                  # Root component
│   ├── state/
│   │   ├── atoms.ts             # Jotai atoms (all app state)
│   │   └── store/tree.ts        # Game tree (Zustand)
│   ├── routes/                  # TanStack Router (file-based)
│   ├── components/
│   │   ├── boards/              # Chessboard + analysis
│   │   ├── panels/              # Side panels
│   │   ├── databases/           # DB browsing UI
│   │   └── settings/            # Preferences + TTS settings
│   ├── utils/
│   │   ├── chess.ts             # Game logic
│   │   ├── tts.ts               # TTS narration (our addition)
│   │   └── treeReducer.ts       # Tree data structure
│   ├── bindings/                # Auto-generated TS from Rust
│   └── translation/             # i18n (13 languages)
│
├── vite.config.ts               # Build config
├── package.json                 # Frontend deps
└── TTS_README.md                # Our TTS documentation
```

---

## Key Takeaways

1. **Rust does the heavy lifting** — engines, database, file I/O, PGN parsing. React never touches the filesystem or spawns processes directly.

2. **Type safety across the boundary** — Specta generates TypeScript types from Rust structs, so if a Rust command changes its signature, the TypeScript build breaks immediately. No runtime surprises.

3. **Two state systems** — Jotai for simple reactive state (settings, UI prefs, per-tab engine state), Zustand for complex domain state (game tree with branching and immutable updates).

4. **Our TTS feature fits the pattern** — it's purely frontend (React + ElevenLabs API), stored in Jotai atoms, with minimal hooks into existing components. When TTS is off, the app is identical to upstream.

5. **The build produces a single binary** at `src-tauri/target/release/en-croissant` that bundles the Rust backend + the Vite-built frontend assets.
