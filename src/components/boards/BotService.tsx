import { useAtom, useAtomValue, useSetAtom, atom } from "jotai";
import { loadable } from "jotai/utils";
import { useContext, useEffect, useMemo, useRef } from "react";
import { TreeStateContext } from "../common/TreeStateContext";
import { useStore } from "zustand";
import { getMainLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { parseSan } from "chessops/san";
import { unifiedMovesFamily, type UnifiedMove } from "@/state/unifiedMoves";
import { activeTabAtom, currentEnginePausedAtom, currentGameStateAtom, currentPlayersAtom, lastMovedAtom, currentBotSuggestionAtom } from "@/state/atoms";
import { selectUnifiedMove, computeBotDelay } from "@/utils/bots";
import { treeIteratorMainLine } from "@/utils/treeReducer";

export default function BotService() {
  const activeTab = useAtomValue(activeTabAtom);
  const [gameState] = useAtom(currentGameStateAtom);
  const [enginePaused] = useAtom(currentEnginePausedAtom);
  const [players] = useAtom(currentPlayersAtom);
  const setLastMove = useSetAtom(lastMovedAtom);
  const setBotSuggestion = useSetAtom(currentBotSuggestionAtom);

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const appendMove = useStore(store, (s) => s.appendMove);

  const mainLine = useMemo(() => Array.from(treeIteratorMainLine(root)), [root]);
  const lastNode = mainLine[mainLine.length - 1]?.node ?? root;

  const [pos] = useMemo(() => positionFromFen(lastNode.fen), [lastNode.fen]);

  const unifiedAtom = useMemo(() => {
    const is960 = headers.variant === "Chess960";
    const currentMoves = getMainLine(root, is960);
    const base = pos
      ? unifiedMovesFamily({ rootFen: root.fen, fen: lastNode.fen, moves: currentMoves, tab: activeTab! })
      : atom<UnifiedMove[]>([]);
    return loadable(base as any);
  }, [pos, headers.variant, root, lastNode.fen, activeTab]);
  const unifiedLoadable = useAtomValue(unifiedAtom);

  const timeoutRef = useRef<number | null>(null);

  // Clear on position turn/fen change
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // clear current suggestion on fen/turn change
    setBotSuggestion(null as any);
  }, [lastNode.fen, pos?.turn, setBotSuggestion]);

  useEffect(() => {
    if (!pos) return;
    if (gameState !== "playing") return;
    if (enginePaused) return;
    if (headers.result !== "*") return;

    const currentTurn = pos.turn;
    const player = currentTurn === "white" ? players.white : players.black;

    // Only handle our Bot (engine type with null engine path)
    if (!(player?.type === "engine" && (player as any).engine == null)) return;
    if (unifiedLoadable.state !== "hasData") return;
    const movesList = (unifiedLoadable.data || []) as UnifiedMove[];
    if (!movesList || movesList.length === 0) return;

    const strat = (player as any).strategy as any | undefined;
    const confThreshold: number | undefined = (player as any).confThreshold;
    const elo: number | undefined = (player as any).elo;
    const choice = selectUnifiedMove(movesList, strat, confThreshold, elo);
    if (!choice) return;

    const san = (choice as any)?.san || (choice as any)?.move;
    const firstUci: string | undefined = (choice as any)?.pv?.[0];
    if (!san && !firstUci) return;

    const delay = computeBotDelay((player as any).thinkingDelayMinMs, (player as any).thinkingDelayMaxMs);

    // update current suggestion arrow immediately
    if (firstUci && typeof firstUci === "string" && firstUci.length >= 4) {
      console.info('Bot suggestion:', { from: firstUci.slice(0, 2), to: firstUci.slice(2, 4) });
      setBotSuggestion({ from: firstUci.slice(0, 2), to: firstUci.slice(2, 4) } as any);
    } else if (san) {
      // best-effort parse SAN to a UCI for arrow: we rely on later play to set last move anyway
      // Do not compute heavy parse here; leave suggestion empty if we cannot make UCI now
      setBotSuggestion(null as any);
    }
    const playChosen = () => {
      const [p] = positionFromFen(lastNode.fen);
      if (!p) return;
      const uciMove = firstUci ? parseUci(firstUci) : null;
      const sanMove = !uciMove && san ? parseSan(p, san) : null;
      const finalMove = (uciMove || sanMove) as any;
      if (!finalMove) return;
      appendMove({ payload: finalMove });
      if (firstUci) setLastMove(firstUci);
      // clear suggestion after making move
      setBotSuggestion(null as any);
      timeoutRef.current = null;
    };

    if (delay > 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(playChosen, delay);
    } else {
      playChosen();
    }
  }, [pos, gameState, enginePaused, headers.result, players, unifiedLoadable, lastNode.fen, root.fen, activeTab]);

  return null;
}


