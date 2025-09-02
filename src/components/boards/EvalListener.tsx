import { events, type EngineOptions, type GoMode } from "@/bindings";
import {
  activeTabAtom,
  currentThreatAtom,
  currentGameStateAtom,
  engineMovesFamily,
  engineProgressFamily,
  engineMovesByDepthFamily,
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
import { startTransition, useContext, useEffect, useMemo, useRef } from "react";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TreeStateContext } from "../common/TreeStateContext";
import { info as logInfo } from "@tauri-apps/plugin-log";
import { buildAnalysisCacheKey, getCachedAnalysis, storeAnalysis } from "@/utils/analysisCache";

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
          // Always analyze by final FEN with no moves to avoid growing UCI strings
          searchingFen: finalFen || INITIAL_FEN,
          searchingMoves: [],
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

  return engines.map((e, idx) => {
    const id = (e as any)?.path || (e as any)?.url || String(idx);
    const key = `${e.type}:${e.name}:${id}`;
    return (
      <EngineListener
        key={key}
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
    );
  });
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
  const gameState = useAtomValue(currentGameStateAtom);

  const [, setProgress] = useAtom(
    engineProgressFamily({ engine: engine.name, tab: activeTab! }),
  );
  // Throttle bursty engine events to reduce React transition churn
  const lastEventTsRef = useRef<number>(0);
  const lastSigRef = useRef<string>("");
  const lastMapUpdateTsRef = useRef<number>(0);

  const [, setEngineVariation] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! }),
  );
  const [, setEngineVariationByDepth] = useAtom(
    engineMovesByDepthFamily({ engine: engine.name, tab: activeTab! }) as any,
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
    const isTauri = typeof (globalThis as any).__TAURI__ !== "undefined";
    if (!settings.enabled) return;
    if (!isTauri) return;
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
        const now = Date.now();
        const top = ev?.[0];
        const sig = `${payload.progress}:${top?.depth || 0}:${top?.nodes || 0}:${top?.uciMoves?.[0] || ""}`;

        // Always report progress, but throttle heavy state writes
        setProgress(payload.progress);

        const timeSinceLast = now - (lastEventTsRef.current || 0);
        const sameSig = sig === lastSigRef.current;
        const shouldUpdateMap = payload.progress === 100 || now - (lastMapUpdateTsRef.current || 0) > 200 || !sameSig;

        if (shouldUpdateMap) {
          lastMapUpdateTsRef.current = now;
          // Avoid flooding React with transitions; write synchronously
          setEngineVariation((prev) => {
            const newMap = new Map(prev);
            const key = `${searchingFen}:`;
            const prevVal = newMap.get(key);
            // Shallow compare top line to skip no-op updates
            const prevTop = prevVal?.[0];
            const changed = !prevTop || prevTop.depth !== top?.depth || prevTop.nodes !== top?.nodes || prevTop.uciMoves?.[0] !== top?.uciMoves?.[0] || prevVal.length !== ev.length;
            if (changed) {
              newMap.set(key, ev);
            }
            if (threat) {
              // Remove the normal-key entry (final FEN) when in threat mode
              newMap.delete(`${finalFen || ""}:`);
            } else if (finalFen) {
              newMap.delete(`${swapMove(finalFen)}:`);
            }
            return newMap;
          });
          // Also store per-depth snapshot for exact-depth consumers
          try {
            setEngineVariationByDepth((prev: Map<string, Map<number, any[]>>) => {
              const next = new Map(prev);
              const k = `${searchingFen}:`;
              const depthMap = new Map(next.get(k) || new Map());
              const d = Number(top?.depth || 0);
              if (d > 0) depthMap.set(d, ev as any);
              next.set(k, depthMap);
              return next as any;
            });
          } catch {}
          // Update score sparingly
          if (top?.score) setScore(top.score);
        }

        // Update throttling refs
        lastEventTsRef.current = now;
        lastSigRef.current = sig;
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

  // Web-mode streaming: listen for partial WASM updates and mirror the tauri event flow
  useEffect(() => {
    const isTauri = typeof (globalThis as any).__TAURI__ !== "undefined";
    if (!settings.enabled) return;
    if (isTauri) return;
    // Dynamically import to avoid bundling in tauri
    let off: (() => void) | undefined;
    import("@/utils/webEvents").then(({ listenBestMoves }) => {
      off = listenBestMoves(({ engine: evEngine, tab: evTab, fen: evFen, moves: evMoves, bestLines, progress }) => {
        if (
          evEngine === engine.name &&
          evTab === activeTab &&
          evFen === searchingFen &&
          JSON.stringify(evMoves) === JSON.stringify(searchingMoves) &&
          settings.enabled &&
          !isGameOver
        ) {
          const now = Date.now();
          const top = bestLines?.[0];
          const sig = `${progress}:${top?.depth || 0}:${top?.nodes || 0}:${top?.uciMoves?.[0] || ""}`;
          setProgress(progress);
          const timeSinceLast = now - (lastEventTsRef.current || 0);
          const sameSig = sig === lastSigRef.current;
          const shouldUpdateMap = progress === 100 || now - (lastMapUpdateTsRef.current || 0) > 200 || !sameSig;
          if (shouldUpdateMap) {
            lastMapUpdateTsRef.current = now;
            setEngineVariation((prev) => {
              const newMap = new Map(prev);
              const key = `${searchingFen}:`;
              const prevVal = newMap.get(key);
              const prevTop = prevVal?.[0];
              const changed = !prevTop || prevTop.depth !== top?.depth || prevTop.nodes !== top?.nodes || prevTop.uciMoves?.[0] !== top?.uciMoves?.[0] || prevVal.length !== bestLines.length;
              if (changed) {
                newMap.set(key, bestLines);
              }
              if (threat) {
                newMap.delete(`${finalFen || ""}:`);
              } else if (finalFen) {
                newMap.delete(`${swapMove(finalFen)}:`);
              }
              return newMap;
            });
            // Per-depth snapshot
            try {
              setEngineVariationByDepth((prev: Map<string, Map<number, any[]>>) => {
                const next = new Map(prev);
                const k = `${searchingFen}:`;
                const depthMap = new Map(next.get(k) || new Map());
                const d = Number(top?.depth || 0);
                if (d > 0) depthMap.set(d, bestLines as any);
                next.set(k, depthMap);
                return next as any;
              });
            } catch {}
            if (top?.score) setScore(top.score);
          }
          lastEventTsRef.current = now;
          lastSigRef.current = sig;
        }
      });
    });
    return () => { try { off?.(); } catch {} };
  }, [
    activeTab,
    setScore,
    settings.enabled,
    isGameOver,
    searchingFen,
    JSON.stringify(searchingMoves),
    engine.name,
    setEngineVariation,
    threat,
    fen,
    moves,
    finalFen,
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
          // Stop previous engine search for this engine/tab before starting a new one (WASM concurrency guard)
          if (engine.type === "local") {
            try { stopEngine(engine, activeTab!); } catch {}
          }

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
                const capped = gameState === 'playing' ? Math.min(legalCount, 10) : legalCount;
                adjustedOptions[multiPVIndex].value = capped.toString();
              } else {
                const capped = gameState === 'playing' ? Math.min(legalCount, 10) : legalCount;
                adjustedOptions.push({ name: "MultiPV", value: capped.toString() });
              }
            }
          }

          // Try IndexedDB cache first (only for finite modes or always if enabled)
          (async () => {
            try {
              if (settings.useCache) {
                const engineId = (engine as any).path || (engine as any).url || engine.name;
                const key = await buildAnalysisCacheKey({
                  fen: searchingFen,
                  moves: searchingMoves,
                  engineId,
                  goMode: settings.go as any,
                  options: adjustedOptions,
                });
                const cached = await getCachedAnalysis(key);
                if (cached) {
                  // eslint-disable-next-line no-console
                  console.info("[CACHE] hit", { key, depth: cached.depth, nodes: cached.nodes });
                  const mode = settings.go as any;
                  const accept =
                    mode?.t === "Depth" ? (cached.depth || 0) >= (mode?.c || 0) : mode?.t !== "Infinite";
                  if (accept) {
                    setEngineVariation((prev) => {
                      const newMap = new Map(prev);
                      newMap.set(
                        `${searchingFen}:${searchingMoves.join(",")}`,
                        cached.bestMoves,
                      );
                      if (engine.type === "local" && settings.allMoves) {
                        const limited = cached.bestMoves.slice(0, originalMultiPV);
                        newMap.set(
                          `${searchingFen}:${searchingMoves.join(",")}_display`,
                          limited,
                        );
                      }
                      return newMap;
                    });
                    setProgress(100);
                    return; // do not start engine
                  }
                }
              }
            } catch (_) {
              // ignore cache errors
            }

            // Run analysis with adjusted MultiPV
            // eslint-disable-next-line no-console
            console.info("[ANALYZE] start", { engine: engine.name, go: settings.go, options: adjustedOptions });
            getBestMoves(activeTab!, settings.go, {
              moves: searchingMoves,
              fen: searchingFen,
              extraOptions: adjustedOptions,
              useCache: settings.useCache,
            }).then(async (moves) => {
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

                // Persist to IndexedDB cache on completion
                try {
                  if (settings.useCache && progress === 100) {
                    const engineId = (engine as any).path || (engine as any).url || engine.name;
                    const key = await buildAnalysisCacheKey({
                      fen: searchingFen,
                      moves: searchingMoves,
                      engineId,
                      goMode: settings.go as any,
                      options: adjustedOptions,
                    });
                    const depth = bestMoves.reduce((m, b) => Math.max(m, b.depth || 0), 0);
                    const nodes = bestMoves.reduce((m, b) => Math.max(m, b.nodes || 0), 0);
                    await storeAnalysis(key, { bestMoves, depth, nodes });
                    // eslint-disable-next-line no-console
                    console.info("[CACHE] store", { key, depth, nodes, count: bestMoves.length });
                  }
                } catch (_) {
                  // ignore cache errors
                }
              }
            });
          })();
        }
      } else {
        if (engine.type === "local") {
          stopEngine(engine, activeTab!);
        }
      }
    },
    150,
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
      gameState,
    ],
  );
  return null;
}

export default EvalListener;
