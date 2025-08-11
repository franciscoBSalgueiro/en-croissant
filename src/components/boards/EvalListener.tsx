import { events, type EngineOptions, type GoMode } from "@/bindings";
import {
  activeTabAtom,
  currentThreatAtom,
  engineMovesFamily,
  engineProgressFamily,
  enginesAtom,
  lastMovedAtom,
  lastMoveEvaluationFamily,
  tabEngineSettingsFamily,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { getBestMoves as chessdbGetBestMoves } from "@/utils/chessdb/api";
import { positionFromFen, swapMove } from "@/utils/chessops";
import {
  type Engine,
  type LocalEngine,
  getBestMoves as localGetBestMoves,
  stopEngine,
} from "@/utils/engines";
import { getBestMoves as lichessGetBestMoves } from "@/utils/lichess/api";
import { useThrottledEffect } from "@/utils/misc";
import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { startTransition, useContext, useEffect, useMemo } from "react";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TreeStateContext } from "../common/TreeStateContext";
import { info as logInfo } from "@tauri-apps/plugin-log";

function EvalListener() {
  const [engines] = useAtom(enginesAtom);
  const threat = useAtomValue(currentThreatAtom);
  const store = useContext(TreeStateContext)!;
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const fen = useStore(store, (s) => s.root.fen);

  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );

  const [pos, error] = positionFromFen(fen);
  if (pos) {
    for (const uci of moves) {
      const move = parseUci(uci);
      if (!move) {
        console.log("Invalid move", uci);
        break;
      }
      pos.play(move);
    }
  }

  const isGameOver = pos?.isEnd() ?? false;
  const finalFen = useMemo(() => (pos ? makeFen(pos.toSetup()) : null), [pos]);

  const { searchingFen, searchingMoves } = useMemo(
    () =>
      match(threat as boolean)
        .with(true, () => ({
          searchingFen: swapMove(finalFen || INITIAL_FEN),
          searchingMoves: [],
        }))
        .with(false, () => ({
          searchingFen: fen,
          searchingMoves: moves,
        }))
        .exhaustive(),
    [fen, moves, threat, finalFen],
  );

  // Ensure last move is kept in sync with the current move list
  const setLastMoved = useSetAtom(lastMovedAtom);
  useEffect(() => {
    const last = searchingMoves.length > 0 ? searchingMoves[searchingMoves.length - 1] : null;
    setLastMoved((prev) => (prev !== last ? last : prev));
    if (last) {
      logInfo(`lastMovedAtom set to ${last}`).catch(() => {});
    }
  }, [searchingMoves, setLastMoved]);

  return engines.map((e) => (
    <EngineListener
      key={e.name}
      engine={e}
      isGameOver={isGameOver}
      finalFen={finalFen || ""}
      searchingFen={searchingFen}
      searchingMoves={searchingMoves}
      fen={fen}
      moves={moves}
      threat={threat}
      chess960={is960}
    />
  ));
}

function EngineListener({
  engine,
  isGameOver,
  finalFen,
  searchingFen,
  searchingMoves,
  fen,
  moves,
  threat,
  chess960,
}: {
  engine: Engine;
  isGameOver: boolean;
  finalFen: string;
  searchingFen: string;
  searchingMoves: string[];
  fen: string;
  moves: string[];
  threat: boolean;
  chess960: boolean;
}) {
  const store = useContext(TreeStateContext)!;
  const setScore = useStore(store, (s) => s.setScore);
  const activeTab = useAtomValue(activeTabAtom);
  const lastMove = useAtomValue(lastMovedAtom);
  const setLastMoveEvaluation = useSetAtom(lastMoveEvaluationFamily(engine.name));

  const [, setProgress] = useAtom(
    engineProgressFamily({ engine: engine.name, tab: activeTab! }),
  );

  const [, setEngineVariation] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! }),
  );
  const [settings] = useAtom(
    tabEngineSettingsFamily({
      engineName: engine.name,
      defaultSettings: engine.settings ?? undefined,
      defaultGo: engine.go ?? undefined,
      tab: activeTab!,
    }),
  );
  useEffect(() => {
    if (!settings.enabled) return;
    const unlisten = events.bestMovesPayload.listen(({ payload }) => {
      const ev = payload.bestLines;
      if (
        payload.engine === engine.name &&
        payload.tab === activeTab &&
        payload.fen === searchingFen &&
        equal(payload.moves, searchingMoves) &&
        settings.enabled &&
        !isGameOver
      ) {
        startTransition(() => {
          setEngineVariation((prev) => {
            const newMap = new Map(prev);
            newMap.set(`${searchingFen}:${searchingMoves.join(",")}`, ev);
            if (threat) {
              newMap.delete(`${fen}:${moves.join(",")}`);
            } else if (finalFen) {
              newMap.delete(`${swapMove(finalFen)}:`);
            }
            return newMap;
          });
          setProgress(payload.progress);
          setScore(ev[0].score);
        });
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [
    activeTab,
    setScore,
    settings.enabled,
    isGameOver,
    searchingFen,
    JSON.stringify(searchingMoves),
    engine.name,
    setEngineVariation,
  ]);

  const getBestMoves = useMemo(
    () =>
      match(engine.type)
        .with(
          "local",
          () => (fen: string, goMode: GoMode, options: EngineOptions) =>
            localGetBestMoves(engine as LocalEngine, fen, goMode, options),
        )
        .with("chessdb", () => chessdbGetBestMoves)
        .with("lichess", () => lichessGetBestMoves)
        .exhaustive(),
    [engine.type, engine],
  );

  useEffect(() => {
    if (!lastMove || !settings.enabled || engine.type !== "local") return;

    const lastMoveTabId = `${activeTab}_lastmove`;

    const unlisten = events.bestMovesPayload.listen(({ payload }) => {
      if (
        payload.tab === lastMoveTabId &&
        payload.engine === engine.name &&
        payload.progress === 100
      ) {
        logInfo(
          `Received last move evaluation payload: tab=${payload.tab} progress=${payload.progress} lines=${payload.bestLines.length}`,
        ).catch(() => {});
        if (payload.bestLines.length > 0) {
          setLastMoveEvaluation(payload.bestLines[0]);
        }
      }
    });

    const options =
      settings.settings?.map((s) => ({
        name: s.name,
        value: s.value?.toString() || "",
      })) ?? [];
    if (chess960 && !options.find((o) => o.name === "UCI_Chess960")) {
      options.push({ name: "UCI_Chess960", value: "true" });
    }

    const lastMoveGoMode: GoMode =
      settings.go.t === "Infinite" ? { t: "Depth", c: 15 } : settings.go;

    // capture current search inputs to avoid effect re-running churn
    const capturedFen = searchingFen;
    const capturedMoves = searchingMoves;

    logInfo(
      `Requesting last move evaluation tab=${lastMoveTabId} move=${lastMove} go=${JSON.stringify(
        lastMoveGoMode,
      )} fen=${capturedFen} moves=${capturedMoves.join(",")}`,
    ).catch(() => {});

    getBestMoves(
      lastMoveTabId,
      {
        t: "SearchMoves",
        c: {
          mode: lastMoveGoMode,
          moves: [lastMove],
        },
      },
      {
        moves: capturedMoves,
        fen: capturedFen,
        extraOptions: options,
      },
    );

    return () => {
      unlisten.then((f) => f());
      stopEngine(engine as LocalEngine, lastMoveTabId);
    };
  }, [lastMove, settings.enabled, engine.name, activeTab, settings.go, chess960]);

  useThrottledEffect(
    () => {
      if (settings.enabled) {
        if (isGameOver) {
          if (engine.type === "local") {
            stopEngine(engine, activeTab!);
          }
        } else {
          const options =
            settings.settings?.map((s) => ({
              name: s.name,
              value: s.value?.toString() || "",
            })) ?? [];
          if (chess960 && !options.find((o) => o.name === "UCI_Chess960")) {
            options.push({ name: "UCI_Chess960", value: "true" });
          }
          getBestMoves(activeTab!, settings.go, {
            moves: searchingMoves,
            fen: searchingFen,
            extraOptions: options,
          }).then((moves) => {
            if (moves) {
              const [progress, bestMoves] = moves;
              setEngineVariation((prev) => {
                const newMap = new Map(prev);
                newMap.set(
                  `${searchingFen}:${searchingMoves.join(",")}`,
                  bestMoves,
                );
                return newMap;
              });
              setProgress(progress);
            }
          });
        }
      } else {
        if (engine.type === "local") {
          stopEngine(engine, activeTab!);
        }
      }
    },
    50,
    [
      settings.enabled,
      JSON.stringify(settings.settings),
      settings.go,
      searchingFen,
      JSON.stringify(searchingMoves),
      isGameOver,
      activeTab,
      getBestMoves,
      setEngineVariation,
      engine,
    ],
  );
  return null;
}

export default EvalListener;
