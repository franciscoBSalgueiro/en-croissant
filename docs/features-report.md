# Feature Investigation Report: Preparation Suite

Date: 2026-10-17 · Scope analysis for four commercial-GUI features being added to En Croissant.

## Goal

Implement the four highest-value features from paid chess GUIs (ChessBase 26,
Fritz 20, Aquarium, HIARCS) as free, local-first features:

1. **Opening Report** — per-move statistics from a reference database
   (ChessBase's flagship feature)
2. **Monte Carlo Analysis** — simulate N games from a position, aggregate
   outcomes and common piece paths (ChessBase 26 headline feature)
3. **Opponent-Style Play** — practice against a clone of a real opponent:
   their opening repertoire + an engine at their strength (Fritz 20's most
   loved feature)
4. **Persistent Analysis Tree (IDeA-style)** — background analysis that
   builds a minimaxed, resumable evaluation tree (Aquarium's flagship)

## What the codebase already gives us

| Need                                          | Existing asset                                          | Location                                                                |
| --------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Position → games scan with results/Elos/dates | `search_position` + `.ecsi` mmap index                  | `src-tauri/src/db/search.rs:235`                                        |
| Reference DB selection                        | `referenceDbAtom`, preload, mmap cache                  | `src/state/atoms.ts:242`, `db/mod.rs:1906`                              |
| Background task + shutdown + events           | `game_loop` pattern (`tokio::spawn` + `watch`)          | `src-tauri/src/game.rs:1219`                                            |
| Progress + cancel                             | `ProgressStore`, `update_progress`, `AtomicBool` flags  | `src-tauri/src/progress.rs`, `chess.rs:465`                             |
| MultiPV evaluation with scores                | `analyze_game` reader loop, `parse_uci_attrs`           | `src-tauri/src/chess.rs:530-599`                                        |
| Book-before-engine move source                | `try_polyglot_book_move` in `request_engine_move`       | `src-tauri/src/game.rs:1383`                                            |
| Human vs engine games with clocks             | `GameConfig`/`start_game`/`BoardGame.tsx`               | `src-tauri/src/game.rs:1521`, `src/components/boards/BoardGame.tsx:285` |
| Panels/UI/mantine charts/i18n/bindings flow   | AnalysisPanel sub-tabs, `@mantine/charts`, tauri-specta | see `docs/features-architecture.md`                                     |

## Gaps and risks found

1. **No one-shot "evaluate this position" helper** — each feature reuses the
   `EngineProcess` (needs `pub(crate)`) or `BaseEngine` patterns.
2. **Engine self-play is deterministic** at fixed depth — Monte Carlo must
   sample moves (softmax over MultiPV scores with temperature) to get
   diverse games, like ChessBase's "plausible games".
3. **`GameController` is private** and its draw/adjudication logic (~50 lines)
   must be extracted or reimplemented for simulation.
4. **Bindings regenerate only on debug app startup** (`main.rs:198-204`) —
   the TS side can only be written after a debug run exports
   `src/bindings/generated.ts`.
5. **i18n CI gate**: any `t()` key change without `pnpm i18n:extract` fails
   `lint:ci`; only `en-US.json` needs the key (others fall back).
6. **Lock discipline**: never hold a `GameController`/tree write lock across
   engine `.await`s; DashMap multi-entry edits need collect-then-modify.
7. **Elo `0` means "missing"** in the search index; bucketing must skip it.
8. The mmap index is not auto-refreshed after new games are added — report
   follows existing behavior (uses whatever index state exists).

## Feasibility verdict

All four features are implementable with moderate scope, reusing existing
infrastructure heavily. No database schema changes are required. Detailed
designs and API contracts: `docs/features-architecture.md`.
