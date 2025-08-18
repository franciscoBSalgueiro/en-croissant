import { useAtom, useAtomValue, useSetAtom, atom } from "jotai";
import { loadable } from "jotai/utils";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { TreeStateContext } from "../common/TreeStateContext";
import { useStore } from "zustand";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { parseSan } from "chessops/san";
import { unifiedMovesFamily, type UnifiedMove } from "@/state/unifiedMoves";
import { activeTabAtom, currentEnginePausedAtom, currentGameStateAtom, currentPlayersAtom, lastMovedAtom, currentBotSuggestionAtom, enginesAtom } from "@/state/atoms";
import { selectUnifiedMove, computeBotDelay } from "@/utils/bots";
import { commands, events, type EngineOptions, type GoMode } from "@/bindings";
import type { LocalEngine } from "@/utils/engines";
import { getBundledStockfishPath } from "@/utils/engines";

export default function BotService() {
  const activeTab = useAtomValue(activeTabAtom);
  const [gameState] = useAtom(currentGameStateAtom);
  const [enginePaused] = useAtom(currentEnginePausedAtom);
  const [players] = useAtom(currentPlayersAtom);
  const setLastMove = useSetAtom(lastMovedAtom);
  const setBotSuggestion = useSetAtom(currentBotSuggestionAtom);
  const engines = useAtomValue(enginesAtom);

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const position = useStore(store, (s) => s.position);
  const makeMove = useStore(store, (s) => s.makeMove);

  const currentNode = useStore(store, (s) => s.currentNode());
  const [pos] = useMemo(() => positionFromFen(currentNode.fen), [currentNode.fen]);

  const unifiedAtom = useMemo(() => {
    const is960 = headers.variant === "Chess960";
    const currentMoves = getVariationLine(root, position, is960, false);
    const base = pos
      ? unifiedMovesFamily({ rootFen: root.fen, fen: currentNode.fen, moves: currentMoves, tab: activeTab! })
      : atom<UnifiedMove[]>([]);
    return loadable(base as any);
  }, [pos, headers.variant, root, position, currentNode.fen, activeTab]);
  const unifiedLoadable = useAtomValue(unifiedAtom);

  const timeoutRef = useRef<number | null>(null);
  const [botEnginePath, setBotEnginePath] = useState<string | null>(null);

  // Clear on position turn/fen change
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // clear current suggestion on fen/turn change
    setBotSuggestion(null as any);
  }, [currentNode.fen, pos?.turn, setBotSuggestion]);

  // Choose an engine path for bot use: prefer first loaded local engine, else bundled Stockfish
  useEffect(() => {
    let cancelled = false;
    const pick = async () => {
      // prefer a loaded local engine
      const local = (engines || []).find((e) => (e as any).type === "local" && (e as any).loaded);
      if (local && (local as any).path) {
        if (!cancelled) setBotEnginePath((local as any).path as string);
        return;
      }
      const bundled = await getBundledStockfishPath();
      if (!cancelled) setBotEnginePath(bundled);
    };
    pick();
    return () => { cancelled = true; };
  }, [engines]);

  // Run a dedicated engine for Bot to select a move according to skill level and thinking delay
  useEffect(() => {
    if (!pos) return;
    if (gameState !== "playing") return;
    if (enginePaused) return;
    if (headers.result !== "*") return;
    if (!botEnginePath) return;

    const currentTurn = pos.turn;
    const player = currentTurn === "white" ? players.white : players.black;
    // Only handle our Bot (engine type with null engine path)
    if (!(player?.type === "engine" && (player as any).engine == null)) return;

    // Compute a go time from bot's configured delays
    const delayMs = computeBotDelay((player as any).thinkingDelayMinMs, (player as any).thinkingDelayMaxMs);

    const tabKey = `${activeTab}${currentTurn}:bot`;
    const id = currentTurn; // used by event payload matcher
    const is960 = headers.variant === "Chess960";
    const movesFromRoot = getVariationLine(root, position, is960, false);

    // Build engine options with MultiPV=1 and optional Skill Level / UCI_Elo limit
    const extraOptions: EngineOptions["extraOptions"] = [];
    // Constrain bot engine resources to amplify strength differences
    extraOptions.push({ name: "Threads", value: "1" });
    extraOptions.push({ name: "Hash", value: "16" });
    // Only one PV needed for a bot move
    extraOptions.push({ name: "MultiPV", value: "1" });
    const skill = (player as any).skillLevel as number | undefined;
    if (typeof skill === "number") {
      // Prefer Skill Level when provided
      extraOptions.push({ name: "Skill Level", value: String(Math.max(0, Math.min(20, Math.round(skill)))) });
      // Additional knobs sometimes required by certain builds/ports to enforce weaker play
      // Reference: https://stackoverflow.com/questions/66425952/setting-stockfish-skill-level-uci-javascript
      // extraOptions.push({ name: "Skill Level Maximum Error", value: "5000" });
      // extraOptions.push({ name: "Skill Level Probability", value: "128" });
    } else {
      // Fallback: if no Skill Level set, allow limiting by UCI_Elo when a bot ELO exists
      const displayElo = (player as any).elo as number | undefined;
      if (typeof displayElo === "number") {
        extraOptions.push({ name: "UCI_LimitStrength", value: "true" });
        // Clamp broadly; engine will clamp to its supported range
        const eloClamped = Math.max(600, Math.min(3600, Math.round(displayElo)));
        extraOptions.push({ name: "UCI_Elo", value: String(eloClamped) });
      }
    }
    if (headers.variant === "Chess960") {
      extraOptions.push({ name: "UCI_Chess960", value: "true" });
    }

    // Choose go mode: if skill set, use Depth = skill; otherwise use movetime derived from delay
    const goMode: GoMode = (typeof skill === "number")
      ? ({ t: "Depth", c: Math.max(1, Math.min(20, Math.round(skill))) } as any)
      : ({ t: "Time", c: delayMs } as any);

    // Start engine search for this bot move
    // Debug: log parameters used to drive the bot engine
    try {
      // eslint-disable-next-line no-console
      console.info("[BotService] start bot engine", { id, tabKey, engine: botEnginePath, go: goMode, extraOptions });
    } catch {}

    commands.getBestMoves(id, botEnginePath, tabKey, goMode, {
      fen: root.fen,
      moves: movesFromRoot,
      extraOptions,
      useCache: false,
    }).then(() => {}).catch(() => {});

    // stop any previous timeout-based flow
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pos, gameState, enginePaused, headers.result, players, botEnginePath, currentNode.fen, root.fen, position, activeTab, headers.variant]);

  // Listen to engine best-move events to update suggestion and play move for Bot
  useEffect(() => {
    const unlisten = events.bestMovesPayload.listen(({ payload }) => {
      try {
        const isOurTurn = pos?.turn;
        if (!isOurTurn) return;
        const tabKey = `${activeTab}${isOurTurn}:bot`;
        const player = isOurTurn === "white" ? players.white : players.black;
        // Only react if current player is a Bot (engine null)
        const isBotPlayer = player?.type === "engine" && (player as any).engine == null;
        if (!isBotPlayer) return;
        if (payload.engine !== isOurTurn) return;
        if (payload.tab !== tabKey) return;
        if (payload.fen !== root.fen) return;
        const is960 = headers.variant === "Chess960";
        const movesFromRoot = getVariationLine(root, position, is960, false);
        if (JSON.stringify(payload.moves) !== JSON.stringify(movesFromRoot)) return;
        if (pos?.isEnd()) return;

        const lines = payload.bestLines || [];
        const first = lines[0];
        const firstUci = first?.uciMoves?.[0];
        if (firstUci && typeof firstUci === "string" && firstUci.length >= 4) {
          setBotSuggestion({ from: firstUci.slice(0, 2), to: firstUci.slice(2, 4) } as any);
        }
        if (payload.progress === 100) {
          if (firstUci) {
            const move = parseUci(firstUci)!;
            // Cosmetic thinking delay: wait before playing, independent of engine go mode
            const cosmeticDelay = computeBotDelay((player as any).thinkingDelayMinMs, (player as any).thinkingDelayMaxMs);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => {
              makeMove({ payload: move });
              setLastMove(firstUci);
              setBotSuggestion(null as any);
              timeoutRef.current = null;
            }, Math.max(0, cosmeticDelay));
          }
        }
      } catch {}
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [pos, activeTab, players, root.fen, headers.variant, position, makeMove, setLastMove, setBotSuggestion]);

  return null;
}


