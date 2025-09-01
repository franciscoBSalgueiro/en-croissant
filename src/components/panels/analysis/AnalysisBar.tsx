import { memo, useContext, useMemo, useState, useEffect } from "react";
import { Box, Group, Paper, Progress, Text, Tabs, useMantineTheme } from "@mantine/core";
import UnifiedMovesTable from "./UnifiedMovesTable";
import LinesTree from "./LinesTree";
import GameNotation from "@/components/common/GameNotation";
 import { atom, useAtomValue } from "jotai";
import { activeTabAtom, engineMovesFamily, engineProgressFamily, enginesAtom } from "@/state/atoms";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { makeFen } from "chessops/fen";
import { currentThreatAtom } from "@/state/atoms";
import { swapMove } from "@/utils/chessops";
import { parseSan } from "chessops/san";
import { getNodeAtPath } from "@/utils/treeReducer";
import { loadable } from "jotai/utils";
import { unifiedMovesFamily } from "@/state/unifiedMoves";
import type { UnifiedMove } from "@/state/unifiedMoves";
import { Chessground } from "@/chessground/Chessground";
import { ANNOTATION_INFO, type Annotation } from "@/utils/annotation";
import { normalizeScore } from "@/utils/score";
import PlayedMovesTable from "@/components/panels/analysis/PlayedMovesTable";

function AnalysisBar({ height = 380 }: { height?: number | string }) {
  const theme = useMantineTheme();
  const [activeTab, setActiveTab] = useState<string | null>("notation");
  const engines = useAtomValue(enginesAtom);
  const appTab = useAtomValue(activeTabAtom);
  const primary = engines[0];
  // Read progress for primary engine (most UIs prefer the first engine)
  const progress = useAtomValue(
    engineProgressFamily({ engine: primary?.name || "", tab: appTab || "" }),
  ) || 0;
  // Derive the current depth from the current position only
  const varMap = useAtomValue(
    engineMovesFamily({ engine: primary?.name || "", tab: appTab || "" }),
  );
  const store = useContext(TreeStateContext)!;
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const root = useStore(store, (s) => s.root);
  const rootFen = root.fen;
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );
  const positionPath = useStore(store, (s) => s.position);
  const threat = useAtomValue(currentThreatAtom);
  const depthHint = useMemo(() => {
    // Compute search key exactly as EvalListener uses
    let searchingFen = rootFen;
    let searchingMoves = moves;
    if (threat) {
      try {
        const [p0] = positionFromFen(rootFen);
        if (p0) {
          for (const u of moves) {
            const mv = parseUci(u);
            if (!mv) break;
            p0.play(mv);
          }
          const finalFen = makeFen(p0.toSetup());
          searchingFen = swapMove(finalFen);
          searchingMoves = [];
        }
      } catch {}
    }
    const key = `${searchingFen}:${searchingMoves.join(",")}`;
    const arr: any[] = varMap?.get?.(key) || [];
    let maxDepth = 0;
    if (Array.isArray(arr)) {
      for (const line of arr) {
        const d = typeof (line as any)?.depth === "number" ? (line as any).depth : 0;
        if (d > maxDepth) maxDepth = d;
      }
    }
    return maxDepth;
  }, [varMap, rootFen, JSON.stringify(moves), threat]);

  // Build insight view for previously played move vs best move
  const currentNode = useStore(store, (s) => s.currentNode());
  const prevNode = positionPath.length > 0 ? getNodeAtPath(root, positionPath.slice(0, -1)) : null;
  const fallbackAtom = useMemo(() => atom({ state: "loading" } as any), []);
  const unifiedPrevBase = useMemo(() => {
    if (!prevNode) return null;
    const currentMoves = getVariationLine(root, positionPath.slice(0, -1), is960, false);
    return unifiedMovesFamily({ rootFen: root.fen, fen: prevNode.fen, moves: currentMoves, tab: appTab || "" });
  }, [prevNode?.fen, root, positionPath, is960, appTab]);
  const unifiedPrevAtomMemo = useMemo(() => (unifiedPrevBase ? loadable(unifiedPrevBase as any) : fallbackAtom), [unifiedPrevBase, fallbackAtom]);
  const unifiedPrevLoadable: any = useAtomValue(unifiedPrevAtomMemo as any);

  const prevMoveInsight = useMemo(() => {
    try {
      if (!unifiedPrevLoadable || unifiedPrevLoadable.state !== "hasData") return null;
      const list: UnifiedMove[] = (unifiedPrevLoadable.data || []) as any;
      const san = (currentNode as any)?.san as string | undefined;
      const half = (currentNode as any)?.halfMoves as number | undefined;
      if (!san || typeof half !== "number" || half <= 0) return null;
      const colorPlayed: "white" | "black" = half % 2 === 1 ? "white" : "black";
      const actual = list.find((m) => (m.san || m.move) === san);
      const best = list.find((m) => (m as any)?.isBest) || list.find((m) => (m as any)?.score);
      const toSq = (sq: number | undefined) => {
        if (typeof sq !== "number") return undefined as unknown as string;
        const f = (sq % 8);
        const r = Math.floor(sq / 8);
        return `${String.fromCharCode("a".charCodeAt(0) + f)}${r + 1}`;
      };
      const buildPreview = (prevFen: string, moveSan: string | undefined) => {
        if (!moveSan) return undefined as any;
        const [p0] = positionFromFen(prevFen);
        if (!p0) return undefined as any;
        const mv: any = parseSan(p0 as any, moveSan);
        if (!mv) return undefined as any;
        const from: any = mv.from;
        const to: any = mv.to;
        (p0 as any).play(mv as any);
        const fenAfter = makeFen((p0 as any).toSetup());
        const lastMove = [toSq(from), toSq(to)].filter(Boolean) as string[];
        const isCheck = (p0 as any).isCheck();
        const turnColor: "white" | "black" = (p0 as any).turn;
        return { fen: fenAfter, lastMove, isCheck, turnColor };
      };
      const prevFen = (prevNode as any)?.fen as string | undefined;
      const actualPreview = prevFen ? buildPreview(prevFen, san) : undefined;
      const bestPreview = prevFen ? buildPreview(prevFen, best ? ((best as any).san || (best as any).move) : undefined) : undefined;
      return { color: colorPlayed, san, actual, best, actualPreview, bestPreview } as const;
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unifiedPrevLoadable?.state, JSON.stringify(unifiedPrevLoadable?.data || []), (currentNode as any)?.san, (currentNode as any)?.halfMoves, (prevNode as any)?.fen]);

  // Continuous gradient: 0 -> red (h=0), 50 -> yellow (h=60), 100 -> green (h=120)
  const pctBestToHsl = (pct: number, opts?: { saturation?: number; lightness?: number }) => {
    const v = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
    const hue = 1.2 * v; // 0..120
    const saturation = typeof opts?.saturation === 'number' ? opts!.saturation : 85;
    const lightness = typeof opts?.lightness === 'number' ? opts!.lightness : 90;
    return `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
  };

  const styleFromMove = (move: any): React.CSSProperties => {
    const ann = (move?.annotation ?? "") as Annotation;
    const colorName = ANNOTATION_INFO[ann]?.color as any;
    const darkText = (theme.colors as any)?.dark?.[9] ?? "#111";
    // Prefer %Best-based continuous coloring when available
    if (typeof move?.pctBest === 'number') {
      const bg = pctBestToHsl(move.pctBest, { saturation: 85, lightness: 92 });
      const border = pctBestToHsl(move.pctBest, { saturation: 70, lightness: 55 });
      return { backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 6, padding: 6, color: darkText } as React.CSSProperties;
    }
    // Fallback to annotation-based coloring if provided
    if (colorName) {
      const bg = (theme.colors as any)[colorName]?.[0] ?? theme.colors.gray[0];
      const border = (theme.colors as any)[colorName]?.[4] ?? theme.colors.gray[4];
      return { backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 6, padding: 6, color: darkText } as React.CSSProperties;
    }
    // Neutral fallback
    const lightBg = theme.colors.gray[0];
    const lightBorder = theme.colors.gray[3];
    return { backgroundColor: lightBg, border: `1px solid ${lightBorder}`, borderRadius: 6, padding: 6, color: darkText } as React.CSSProperties;
  };

  const describeMove = (move: any, opts: { color: 'white' | 'black'; labelForFirstSentence?: string; compareTo?: any; includeAnnotationPrefix?: boolean; }): Array<React.ReactNode> => {
    if (!move) return ["No data."];
    const sentences: Array<React.ReactNode> = [];
    const san = move?.san || move?.move;
    const hasScore = move?.score && (move.score as any).value !== undefined;
    const cp = hasScore ? normalizeScore((move.score as any).value, 'white') : undefined;
    const evalStr = typeof cp === 'number' ? `${(cp/100).toFixed(2)}p` : undefined;
    const engine = move?.engineName;
    const depth = move?.depth;
    const firstLabel = opts.labelForFirstSentence || 'Move';
    const engineDepth = engine ? `${engine}${typeof depth === 'number' ? ` (d${depth})` : ''}` : '';
    let isSameAsBest = false;
    if (opts.compareTo) {
      const best = opts.compareTo;
      const bestSan = best?.san || best?.move;
      if (san && bestSan && san === bestSan) isSameAsBest = true;
    }
    if (opts.includeAnnotationPrefix !== false && !isSameAsBest) {
      const ann = (move?.annotation ?? '') as string;
      const label = ann && ANNOTATION_INFO[ann as Annotation]?.name ? (ANNOTATION_INFO[ann as Annotation]?.name || '').trim() : '';
      if (label) sentences.push(`${label}.`);
    }
    if (san) sentences.push(<>{firstLabel + ' '}<Text span fw={700}>{san}</Text>{`, evaluated by ${engineDepth || 'Engine'} at ${evalStr || 'unknown'}.`}</>);
    if (opts.compareTo) {
      const best = opts.compareTo;
      const bestSan = best?.san || best?.move;
      const bestHasScore = best?.score && (best.score as any).value !== undefined;
      const bestCp = bestHasScore ? normalizeScore((best.score as any).value, 'white') : undefined;
      const bestEvalStr = typeof bestCp === 'number' ? `${(bestCp/100).toFixed(2)}p` : undefined;
      const pctBest = typeof move?.pctBest === 'number' ? move.pctBest.toFixed(1) : undefined;
      const isSame = san && bestSan && san === bestSan;
      if (isSame) sentences.push('This is the best move.');
      else if (pctBest) sentences.push(<>{`This is `}<Text span td="underline">{pctBest}%</Text>{` as good as the best move, `}{bestSan ? <><Text span fw={700}>{bestSan}</Text>{bestEvalStr ? ` (${bestEvalStr})` : ''}</> : null}{`.`}</>);
      else if (bestSan) sentences.push(<>{`Compared to the best move, `}<Text span fw={700}>{bestSan}</Text>{bestEvalStr ? ` (${bestEvalStr})` : ''}{`.`}</>);
    }
    const tags: string[] = [];
    if (move?.isOnlyMove) tags.push('This was the only move.');
    if (move?.punishesMistake) tags.push("It punishes the opponent's mistake.");
    if (move?.isSacrifice) tags.push('It is a sacrifice.');
    if (move?.isThreat) tags.push('Evaluated in a threat context.');
    if (tags.length > 0) sentences.push(tags.join(' '));
    let md = typeof move?.materialDelta === 'number' ? move.materialDelta : 0;
    if (opts.color === 'black') md = -md;
    const parts: string[] = [];
    if (md !== 0) parts.push(`Over the principal variation, material changes by ${(md > 0 ? '+' : '') + md}`);
    if (parts.length > 0) sentences.push(parts.join('; ') + '.');
    return sentences;
  };

  // Persist last known insights per side so they remain visible until that side moves again
  const [insightWhite, setInsightWhite] = useState<any | null>(null);
  const [insightBlack, setInsightBlack] = useState<any | null>(null);
  useEffect(() => {
    if (!prevMoveInsight) return;
    if (prevMoveInsight.color === 'white') setInsightWhite(prevMoveInsight as any);
    else setInsightBlack(prevMoveInsight as any);
  }, [prevMoveInsight?.color, prevMoveInsight?.san, prevMoveInsight?.actual, prevMoveInsight?.best]);

  return (
    <Paper
      withBorder
      p="xs"
      h={height}
      style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
    >
      <Tabs 
        value={activeTab} 
        onChange={setActiveTab}
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <Tabs.List>
          <Tabs.Tab value="notation">Notation</Tabs.Tab>
          <Tabs.Tab value="linesTree">Lines Tree</Tabs.Tab>
          <Tabs.Tab value="unifiedMoves">Unified Moves</Tabs.Tab>
          <Tabs.Tab value="insights">Insights</Tabs.Tab>
          <Tabs.Tab value="played">Played Moves</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel 
          value="linesTree" 
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          <Box style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
            <LinesTree />
          </Box>
        </Tabs.Panel>
        <Tabs.Panel 
          value="played" 
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          <Box style={{ height: "100%", minHeight: 0, overflow: "hidden", display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Group gap="md">
              <Text size="sm" c="dimmed">Avg Eval</Text>
              {/* These aggregates are computed in PlayerPanel; for now, leave placeholders or compute later */}
              <Text size="sm" fw={600}>—</Text>
              <Text size="sm" c="dimmed">Avg %Best</Text>
              <Text size="sm" fw={600}>—</Text>
              <Text size="sm" c="dimmed">Avg Rank</Text>
              <Text size="sm" fw={600}>—</Text>
            </Group>
            <Group grow align="stretch" gap="sm" style={{ flex: 1, minHeight: 0 }}>
              <Box style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                <Text size="sm" fw={600} mb={4}>White</Text>
                <PlayedMovesTable color="white" />
              </Box>
              <Box style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                <Text size="sm" fw={600} mb={4}>Black</Text>
                <PlayedMovesTable color="black" />
              </Box>
            </Group>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel 
          value="unifiedMoves" 
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          <Box style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
            <UnifiedMovesTable />
          </Box>
        </Tabs.Panel>

        <Tabs.Panel 
          value="notation" 
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          <Box style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
            <GameNotation topBar />
          </Box>
        </Tabs.Panel>

        <Tabs.Panel 
          value="insights" 
          style={{ flex: 1, minHeight: 0, overflow: "auto" }}
        >
          <Group align="stretch" gap="sm" grow>
            <Box style={{ flex: 1, minHeight: 0 }}>
              <Text size="sm" fw={600} mb={4}>White</Text>
              {insightWhite ? (
                <Box style={styleFromMove((insightWhite as any).actual)}>
                  <Text size="xs" fw={700} mb={4}>Your move</Text>
                  <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
                    {(insightWhite as any).actualPreview && (
                      <Box w={140} h={140} className="mini-cg" style={{ flexShrink: 0 }}>
                        <Chessground
                          fen={(insightWhite as any).actualPreview.fen}
                          coordinates={false}
                          viewOnly
                          orientation={(insightWhite as any).color}
                          lastMove={(insightWhite as any).actualPreview.lastMove as any}
                          turnColor={(insightWhite as any).actualPreview.turnColor}
                          check={(insightWhite as any).actualPreview.isCheck}
                          highlight={{ lastMove: true, check: true }}
                        >
                          {(insightWhite as any).bestPreview?.lastMove?.length === 2 && (
                            <>
                              <div slot={(insightWhite as any).bestPreview.lastMove[0]} style={{ backgroundColor: 'rgba(0, 255, 0, 0.3)', height: '100%' }}></div>
                              <div slot={(insightWhite as any).bestPreview.lastMove[1]} style={{ backgroundColor: 'rgba(0, 255, 0, 0.3)', height: '100%' }}></div>
                            </>
                          )}
                          {(insightWhite as any).actualPreview?.lastMove?.length === 2 && (() => {
                            const actualMove = (insightWhite as any).actualPreview.lastMove;
                            const bestMove = (insightWhite as any).bestPreview?.lastMove;
                            const isSame = bestMove && actualMove[0] === bestMove[0] && actualMove[1] === bestMove[1];
                            const color = isSame ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                            return (
                              <>
                                <div slot={actualMove[0]} style={{ backgroundColor: color, height: '100%' }}></div>
                                <div slot={actualMove[1]} style={{ backgroundColor: color, height: '100%' }}></div>
                              </>
                            );
                          })()}
                        </Chessground>
                      </Box>
                    )}
                    <Box style={{ flex: '1 1 0', minWidth: '200px' }}>
                      <Text size="xs">
                        {(() => {
                          const lines = describeMove((insightWhite as any).actual, { color: (insightWhite as any).color, labelForFirstSentence: 'You played', compareTo: (insightWhite as any).best, includeAnnotationPrefix: true });
                          return lines.map((line, i) => (<span key={i}>{line}{i < lines.length - 1 ? ' ' : ''}</span>));
                        })()}
                      </Text>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Text size="xs" c="dimmed">No previous white move to analyze.</Text>
              )}
            </Box>
            <Box style={{ flex: 1, minHeight: 0 }}>
              <Text size="sm" fw={600} mb={4}>Black</Text>
              {insightBlack ? (
                <Box style={styleFromMove((insightBlack as any).actual)}>
                  <Text size="xs" fw={700} mb={4}>Your move</Text>
                  <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
                    {(insightBlack as any).actualPreview && (
                      <Box w={140} h={140} className="mini-cg" style={{ flexShrink: 0 }}>
                        <Chessground
                          fen={(insightBlack as any).actualPreview.fen}
                          coordinates={false}
                          viewOnly
                          orientation={(insightBlack as any).color}
                          lastMove={(insightBlack as any).actualPreview.lastMove as any}
                          turnColor={(insightBlack as any).actualPreview.turnColor}
                          check={(insightBlack as any).actualPreview.isCheck}
                          highlight={{ lastMove: true, check: true }}
                        >
                          {(insightBlack as any).bestPreview?.lastMove?.length === 2 && (
                            <>
                              <div slot={(insightBlack as any).bestPreview.lastMove[0]} style={{ backgroundColor: 'rgba(0, 255, 0, 0.3)', height: '100%' }}></div>
                              <div slot={(insightBlack as any).bestPreview.lastMove[1]} style={{ backgroundColor: 'rgba(0, 255, 0, 0.3)', height: '100%' }}></div>
                            </>
                          )}
                          {(insightBlack as any).actualPreview?.lastMove?.length === 2 && (() => {
                            const actualMove = (insightBlack as any).actualPreview.lastMove;
                            const bestMove = (insightBlack as any).bestPreview?.lastMove;
                            const isSame = bestMove && actualMove[0] === bestMove[0] && actualMove[1] === bestMove[1];
                            const color = isSame ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                            return (
                              <>
                                <div slot={actualMove[0]} style={{ backgroundColor: color, height: '100%' }}></div>
                                <div slot={actualMove[1]} style={{ backgroundColor: color, height: '100%' }}></div>
                              </>
                            );
                          })()}
                        </Chessground>
                      </Box>
                    )}
                    <Box style={{ flex: '1 1 0', minWidth: '200px' }}>
                      <Text size="xs">
                        {(() => {
                          const lines = describeMove((insightBlack as any).actual, { color: (insightBlack as any).color, labelForFirstSentence: 'You played', compareTo: (insightBlack as any).best, includeAnnotationPrefix: true });
                          return lines.map((line, i) => (<span key={i}>{line}{i < lines.length - 1 ? ' ' : ''}</span>));
                        })()}
                      </Text>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Text size="xs" c="dimmed">No previous black move to analyze.</Text>
              )}
            </Box>
          </Group>
        </Tabs.Panel>
      </Tabs>
      <Box style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: 4, background: "transparent", zIndex: 1000 }}>
        <Group justify="space-between" gap="xs" mb={2} style={{ padding: "0 8px" }}>
          <Text size="xs" c="dimmed">{depthHint ? `d${depthHint}` : ""}</Text>
          <Text size="xs" c="dimmed">{progress ? `${progress}%` : ""}</Text>
        </Group>
        <Progress value={progress} size={2} radius={0} color="blue" style={{ height: 2 }} />
      </Box>
    </Paper>
  );
}

export default memo(AnalysisBar);


