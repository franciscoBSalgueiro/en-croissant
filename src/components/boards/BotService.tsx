import { useAtom, useAtomValue, useSetAtom, atom } from "jotai";
import { loadable } from "jotai/utils";
import { useContext, useEffect, useMemo, useRef } from "react";
import { TreeStateContext } from "../common/TreeStateContext";
import { useStore } from "zustand";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci, squareFile, squareRank } from "chessops";
import { parseSan } from "chessops/san";
import { unifiedMovesFamily, type UnifiedMove } from "@/state/unifiedMoves";
import { activeTabAtom, currentEnginePausedAtom, currentGameStateAtom, currentPlayersAtom, lastMovedAtom, currentBotSuggestionAtom } from "@/state/atoms";
import { selectUnifiedMove, computeBotDelay } from "@/utils/bots";

export default function BotService() {
  const activeTab = useAtomValue(activeTabAtom);
  const [gameState] = useAtom(currentGameStateAtom);
  const [enginePaused] = useAtom(currentEnginePausedAtom);
  const [players] = useAtom(currentPlayersAtom);
  const setLastMove = useSetAtom(lastMovedAtom);
  const setBotSuggestion = useSetAtom(currentBotSuggestionAtom);
  // engines no longer needed for unified-only bot

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const position = useStore(store, (s) => s.position);
  const makeMove = useStore(store, (s) => s.makeMove);
  const setResult = useStore(store, (s) => s.setResult);

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
  const lastLogKeyRef = useRef<string>("");
  const lastPlayerSigRef = useRef<string>("");

  // Clear on position turn/fen change
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // clear current suggestion on fen/turn change
    setBotSuggestion(null as any);
    try {
      const turn = pos?.turn;
      const key = `${currentNode.fen}:${turn}`;
      if (key !== lastLogKeyRef.current) {
        // eslint-disable-next-line no-console
        console.info("[BotService] position changed", { fen: currentNode.fen, turn });
        lastLogKeyRef.current = key;
      }
    } catch {}
  }, [currentNode.fen, pos?.turn, setBotSuggestion]);

  // no engine path needed in unified-only mode

  // Unified-only Bot: when it's the bot's turn and analyzed moves are available, pick and play
  useEffect(() => {
    if (!pos) return;
    if (gameState !== "playing") return;
    if (enginePaused) return;
    if (headers.result !== "*") return;
    const currentTurn = pos.turn;
    const player = currentTurn === "white" ? players.white : players.black;
    const isBot = player?.type === "engine" && (player as any).engine == null;
    if (!isBot) return;

    // Log player state when it changes
    try {
      const sig = JSON.stringify({ turn: currentTurn, type: player?.type, botId: (player as any)?.botId, paused: enginePaused, state: gameState, result: headers.result });
      if (sig !== lastPlayerSigRef.current) {
        // eslint-disable-next-line no-console
        console.info("[BotService] player state", JSON.parse(sig));
        lastPlayerSigRef.current = sig;
      }
    } catch {}

    if ((unifiedLoadable as any)?.state === "hasData") {
      try {
        const list = ((unifiedLoadable as any).data || []) as UnifiedMove[];
        if (Array.isArray(list) && list.length > 0) {
          // Early resignation check based on top win chance vs configured threshold
          try {
            const resignPct: number | undefined = (player as any)?.resignBelowWinPct;
            if (typeof resignPct === 'number' && resignPct >= 0) {
              const winChances: number[] = list
                .map((x: any) => Number.isFinite(x?.winChance) ? Number(x.winChance) : NaN)
                .filter((n) => Number.isFinite(n)) as number[];
              if (winChances.length > 0) {
                const topWin = winChances.reduce((a, b) => Math.max(a, b), -Infinity);
                if (Number.isFinite(topWin) && topWin < resignPct) {
                  // Resign on behalf of the current side
                  const outcome = currentTurn === 'white' ? '0-1' : '1-0';
                  try { console.info('[BotService] resign due to low win chance', { topWin, resignPct, outcome }); } catch {}
                  // Clear any scheduled move and suggestion
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                  }
                  setBotSuggestion(null as any);
                  setResult(outcome as any);
                  return; // stop further processing
                }
              }
            }
          } catch {}

          // Depth gating: if skillLevel set, and we have any engine depth data, wait until max depth >= skillLevel
          // Apply the same behavior in tournament as in regular games; only thinking delay differs
          const skillDepth = (player as any).skillLevel;
          if (typeof skillDepth === 'number') {
            const depths = list.map((x: any) => (Number.isFinite(x?.depth) ? Number(x.depth) : 0));
            const maxDepth = depths.reduce((a: number, b: number) => Math.max(a, b), 0);
            const hasAnyDepth = depths.some((d: number) => d > 0);
            try { console.info("[BotService] unified status", { items: list.length, maxDepth, hasAnyDepth, skillDepth }); } catch {}
            if (hasAnyDepth && maxDepth < Math.max(1, Math.min(50, Math.round(skillDepth)))) {
              return; // wait for deeper analysis only if engine depth exists
            }
          }
          const choice = selectUnifiedMove(list, (player as any).strategy, (player as any).confThreshold, (player as any).elo);
          if (choice) {
            const pickUciFromChoice = (): string | undefined => {
              if (Array.isArray((choice as any).pv) && (choice as any).pv.length > 0) return (choice as any).pv[0];
              // Derive from SAN if PV missing
              try {
                const toUciFromSan = (p: any, san: string | undefined): string | undefined => {
                  if (!p || !san) return undefined;
                  const mv: any = parseSan(p, san);
                  if (!mv) return undefined;
                  const fileToChar = (f: number) => String.fromCharCode("a".charCodeAt(0) + f);
                  const rankToChar = (r: number) => String(r + 1);
                  const from = mv.from as number | undefined;
                  const to = mv.to as number | undefined;
                  if (from === undefined || to === undefined) return undefined;
                  const ffile = squareFile(from);
                  const frank = squareRank(from);
                  const tfile = squareFile(to);
                  const trank = squareRank(to);
                  const promo = (mv.promotion && typeof mv.promotion === "string") ? (mv.promotion as string).charAt(0) : undefined;
                  return `${fileToChar(ffile)}${rankToChar(frank)}${fileToChar(tfile)}${rankToChar(trank)}${promo ? promo : ""}`;
                };
                const p = pos.clone();
                const san = (choice as any).san || (choice as any).move;
                return toUciFromSan(p, san);
              } catch { return undefined; }
            };
            const uci = pickUciFromChoice();
            if (uci && typeof uci === "string" && uci.length >= 4) {
              // Prevent multiple schedules for the same position/turn
              if (timeoutRef.current) {
                try { console.info("[BotService] move already scheduled; skipping"); } catch {}
                return;
              }
              const delayMs = computeBotDelay((player as any).thinkingDelayMinMs, (player as any).thinkingDelayMaxMs);
              try { console.info("[BotService] schedule move", { uci, delayMs }); } catch {}
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setBotSuggestion({ from: uci.slice(0, 2), to: uci.slice(2, 4) } as any);
              timeoutRef.current = window.setTimeout(() => {
                const move = parseUci(uci)!;
                makeMove({ payload: move });
                setLastMove(uci);
                setBotSuggestion(null as any);
                timeoutRef.current = null;
              }, Math.max(0, delayMs));
              return;
            }
            try { console.info("[BotService] no UCI derived from choice", { choice }); } catch {}
          }
          try { console.info("[BotService] no choice from unified"); } catch {}
        }
      } catch {}
    }
    try { console.info("[BotService] unified not ready or empty", { state: (unifiedLoadable as any)?.state }); } catch {}
  }, [pos, gameState, enginePaused, headers.result, players, unifiedLoadable.state, (unifiedLoadable as any)?.data]);

  return null;
}


