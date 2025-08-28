import { memo, useContext, useMemo, useState } from "react";
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

  const styleFromMove = (move: any): React.CSSProperties => {
    const ann = (move?.annotation ?? "") as Annotation;
    const colorName = ANNOTATION_INFO[ann]?.color as any;
    const darkText = (theme.colors as any)?.dark?.[9] ?? "#111";
    if (colorName) {
      const bg = (theme.colors as any)[colorName]?.[0] ?? theme.colors.gray[0];
      const border = (theme.colors as any)[colorName]?.[4] ?? theme.colors.gray[4];
      return { backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 6, padding: 6, color: darkText } as React.CSSProperties;
    }
    const lightBg = theme.colors.gray[0];
    const lightBorder = theme.colors.gray[3];
    return { backgroundColor: lightBg, border: `1px solid ${lightBorder}`, borderRadius: 6, padding: 6, color: darkText } as React.CSSProperties;
  };

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
          <Box style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
            <Group grow align="stretch" gap="sm" style={{ height: "100%" }}>
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
          {prevMoveInsight ? (
            <Group align="stretch" gap="xs" grow>
              <Box style={styleFromMove(prevMoveInsight.actual)}>
                <Text size="xs" fw={700} mb={4}>Your move</Text>
                {prevMoveInsight.actualPreview && (
                  <Box w={140} h={140} className="mini-cg" style={{ float: 'left', marginRight: 6 }}>
                    <Chessground
                      fen={prevMoveInsight.actualPreview.fen}
                      coordinates={false}
                      viewOnly
                      orientation={prevMoveInsight.color}
                      lastMove={prevMoveInsight.actualPreview.lastMove as any}
                      turnColor={prevMoveInsight.actualPreview.turnColor}
                      check={prevMoveInsight.actualPreview.isCheck}
                      highlight={{ lastMove: true, check: true }}
                      drawable={{ enabled: false, visible: true }}
                    />
                  </Box>
                )}
                <Text size="xs">{prevMoveInsight.san}</Text>
              </Box>
              {(() => {
                const a = prevMoveInsight.actual;
                const b = prevMoveInsight.best;
                const aSan = prevMoveInsight.san || (a as any)?.san || (a as any)?.move;
                const bSan = (b as any)?.san || (b as any)?.move;
                const isBestPlayed = !!a && (a as any)?.isBest === true || (aSan && bSan && aSan === bSan);
                if (isBestPlayed) return null;
                return (
                  <Box style={styleFromMove(prevMoveInsight.best)}>
                    <Text size="xs" fw={700} mb={4}>Best move</Text>
                    {prevMoveInsight.bestPreview && (
                      <Box w={140} h={140} className="mini-cg" style={{ float: 'left', marginRight: 6 }}>
                        <Chessground
                          fen={prevMoveInsight.bestPreview.fen}
                          coordinates={false}
                          viewOnly
                          orientation={prevMoveInsight.color}
                          lastMove={prevMoveInsight.bestPreview.lastMove as any}
                          turnColor={prevMoveInsight.bestPreview.turnColor}
                          check={prevMoveInsight.bestPreview.isCheck}
                          highlight={{ lastMove: true, check: true }}
                          drawable={{ enabled: false, visible: true }}
                        />
                      </Box>
                    )}
                    <Text size="xs">{bSan || "?"}</Text>
                  </Box>
                );
              })()}
            </Group>
          ) : (
            <Text size="xs" c="dimmed">No previous move to analyze.</Text>
          )}
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


