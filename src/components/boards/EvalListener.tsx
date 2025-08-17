import { events, type EngineOptions, type GoMode } from "@/bindings";
import {
  activeTabAtom,
  currentThreatAtom,
  engineMovesFamily,
  engineProgressFamily,
  enginesAtom,
  lastMovedAtom,
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
  scoreAllMoves as localScoreAllMoves,
} from "@/utils/engines";
import { getBestMoves as lichessGetBestMoves } from "@/utils/lichess/api";
import { useThrottledEffect } from "@/utils/misc";
import { parseUci } from "chessops";
import { chessgroundDests } from "chessops/compat";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { makeSan } from "chessops/san";
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
      // logInfo(`lastMovedAtom set to ${last}`).catch(() => {});
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
          // Ensure MultiPV has a sane default (5) so first-move arrows appear even before user tweaks
          if (!options.find((o) => o.name === "MultiPV")) {
            options.push({ name: "MultiPV", value: "5" });
          }
          if (!options.find((o) => o.name === "UCI_ShowWDL")) {
            options.push({ name: "UCI_ShowWDL", value: "true" });
          }
          if (chess960 && !options.find((o) => o.name === "UCI_Chess960")) {
            options.push({ name: "UCI_Chess960", value: "true" });
          }

          // If allMoves is enabled, temporarily increase MultiPV to legal move count
          const adjustedOptions = [...options];
          let originalMultiPV = 1;
          if (engine.type === "local" && settings.allMoves) {
            // Calculate legal moves for this position
            const [baseStart] = positionFromFen(searchingFen);
            const basePos = (() => {
              if (!baseStart) return null;
              const p = baseStart.clone();
              for (const uci of searchingMoves) {
                const m = parseUci(uci);
                if (!m) return null;
                p.play(m);
              }
              return p;
            })();
            
            if (basePos) {
              const dests = chessgroundDests(basePos);
              const legalCount = Array.from(dests.values()).reduce((total, moves) => total + moves.length, 0);
              
              // Find existing MultiPV setting
              const multiPVIndex = adjustedOptions.findIndex((o) => o.name === "MultiPV");
              if (multiPVIndex >= 0) {
                originalMultiPV = parseInt(adjustedOptions[multiPVIndex].value) || 1;
                adjustedOptions[multiPVIndex].value = legalCount.toString();
              } else {
                adjustedOptions.push({ name: "MultiPV", value: legalCount.toString() });
              }
            }
          }

          // Run analysis with adjusted MultiPV
          getBestMoves(activeTab!, settings.go, {
            moves: searchingMoves,
            fen: searchingFen,
            extraOptions: adjustedOptions,
            useCache: settings.useCache,
          }).then((moves) => {
            if (moves) {
              const [progress, bestMoves] = moves;
              
              // Store all moves (for unified table access)
              setEngineVariation((prev) => {
                const newMap = new Map(prev);
                newMap.set(
                  `${searchingFen}:${searchingMoves.join(",")}`,
                  bestMoves,
                );
                
                // If allMoves is enabled, also store limited moves for display
                if (engine.type === "local" && settings.allMoves) {
                  const limitedMoves = bestMoves.slice(0, originalMultiPV);
                  newMap.set(
                    `${searchingFen}:${searchingMoves.join(",")}_display`,
                    limitedMoves,
                  );
                }
                
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
      settings.allMoves,
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
