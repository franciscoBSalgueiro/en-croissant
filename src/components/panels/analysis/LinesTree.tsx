import { memo, useContext, useMemo, useRef, useState, useEffect } from "react";
import { Box, Loader, Text, Group, Slider } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { getVariationLine } from "@/utils/chess";
import { activeTabAtom } from "@/state/atoms";
import { unifiedMovesFamily } from "@/state/unifiedMoves";
import { loadable } from "jotai/utils";
import { Graph } from "react-d3-graph";
import { ANNOTATION_INFO, type Annotation } from "@/utils/annotation";

// Build a merged graph from multiple engine PV lines (SAN from current position)
function useUnifiedPVs(): {
  pvLines: string[][];
  rankedFirstSANs: string[];
  firstSanColor: Record<string, string>;
  firstSanEval: Record<string, number>;
  loading: boolean;
} {
  const store = useContext(TreeStateContext)!;
  const activeTab = useAtomValue(activeTabAtom)!;

  const rootFen = useStore(store, (s) => s.root.fen);
  const fen = useStore(store, (s) => s.currentNode().fen);
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const currentMoves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );

  const unifiedAtom = useMemo(
    () => loadable(unifiedMovesFamily({ rootFen, fen, moves: currentMoves, tab: activeTab })),
    [rootFen, fen, currentMoves, activeTab]
  );
  const unifiedLoadable = useAtomValue(unifiedAtom);
  const loading = unifiedLoadable.state === "loading";
  const unifiedMoves = unifiedLoadable.state === "hasData" ? unifiedLoadable.data : [];

  const { pvLines, rankedFirstSANs, firstSanColor, firstSanEval } = useMemo(() => {
    const lines: string[][] = [];
    const firstMoveToWin: Map<string, number> = new Map();
    const firstSanColor: Record<string, string> = {};
    const firstSanEval: Record<string, number> = {};

    let bestFirstSan: string | undefined = undefined;

    for (const m of unifiedMoves) {
      const sanMoves = (m.sanMoves && m.sanMoves.length > 0)
        ? m.sanMoves
        : (m.san ? [m.san] : (m.move ? [m.move] : []));
      if (sanMoves.length === 0) continue;
      lines.push(sanMoves);

      const first = sanMoves[0];
      if (m.isBest) {
        bestFirstSan = first;
      }
      if (m.winChance !== undefined) {
        const prev = firstMoveToWin.get(first);
        if (prev === undefined || m.winChance > prev) firstMoveToWin.set(first, m.winChance);
        // Track evaluation value per first SAN (use best seen)
        if (firstSanEval[first] === undefined || m.winChance > firstSanEval[first]) {
          firstSanEval[first] = m.winChance;
        }
      }
      if (m.annotation) {
        const info = ANNOTATION_INFO[m.annotation as Annotation];
        if (info?.color) firstSanColor[first] = info.color as string;
      }
    }

    // Ensure BEST move is colored blue in the graph
    if (bestFirstSan) {
      firstSanColor[bestFirstSan] = "var(--mantine-color-blue-6)";
    }

    const rankedFirstSANs = Array.from(firstMoveToWin.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([san]) => san);

    return { pvLines: lines, rankedFirstSANs, firstSanColor, firstSanEval };
  }, [unifiedMoves]);

  return { pvLines, rankedFirstSANs, firstSanColor, firstSanEval, loading };
}

function LinesTree() {
  const { pvLines, rankedFirstSANs, firstSanColor, firstSanEval, loading } = useUnifiedPVs();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [topN, setTopN] = useState<number>(5);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDimensions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setDimensions({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const filteredPvLines = useMemo(() => {
    if (rankedFirstSANs.length === 0) return pvLines;
    const allowed = new Set(rankedFirstSANs.slice(0, topN));
    return pvLines.filter((line) => line.length > 0 && allowed.has(line[0]));
  }, [pvLines, rankedFirstSANs, topN]);

  // Build DAG: node key is unique by (ply index starting at 1, SAN)
  const graphData = useMemo(() => {
    type Node = { id: string; label?: string; x?: number; y?: number; fx?: number; fy?: number };
    type Link = { source: string; target: string; color?: string; highlightColor?: string };

    const width = dimensions?.width ?? 600;
    const height = dimensions?.height ?? 300;
    const leftPad = 40;
    const rightPad = 20;
    const topPad = 20;
    const bottomPad = 20;

    const maxPly = filteredPvLines.reduce((m, l) => Math.max(m, l.length), 0);
    const steps = Math.max(1, maxPly);
    const xStep = (Math.max(1, width - leftPad - rightPad)) / steps;

    // Helper: parse depth from id format "d:SAN"
    const getDepth = (id: string) => {
      const idx = id.indexOf(":");
      if (idx <= 0) return 0;
      const d = Number.parseInt(id.slice(0, idx), 10);
      return Number.isFinite(d) ? d : 0;
    };

    // Compute y positions for first-ply SANs based on evaluation range
    const firstSansInUse = new Set<string>();
    for (const line of filteredPvLines) {
      if (line.length > 0) firstSansInUse.add(line[0]);
    }
    const values: number[] = [];
    for (const san of firstSansInUse) {
      const v = firstSanEval[san];
      if (typeof v === "number") values.push(v);
    }
    const minEval = values.length > 0 ? Math.min(...values) : 50;
    const maxEval = values.length > 0 ? Math.max(...values) : 50;
    const innerH = Math.max(1, height - topPad - bottomPad);
    const scaleY = (val: number) => {
      if (maxEval === minEval) return topPad + innerH / 2;
      const t = (val - minEval) / (maxEval - minEval); // 0..1
      return topPad + (1 - t) * innerH; // higher eval -> higher (towards top)
    };

    // Separation utility to avoid overlaps while preserving order
    const separateLayer = (ids: string[], yGetter: (id: string) => number, minGap: number) => {
      if (ids.length === 0) return new Map<string, number>();
      const pairs = ids.map((id) => [id, yGetter(id)] as [string, number]).sort((a, b) => a[1] - b[1]);
      // forward pass
      for (let i = 0; i < pairs.length; i++) {
        const minAllowed = i === 0 ? topPad : pairs[i - 1][1] + minGap;
        pairs[i][1] = Math.max(pairs[i][1], minAllowed);
      }
      // backward pass
      for (let i = pairs.length - 1; i >= 0; i--) {
        const maxAllowed = i === pairs.length - 1 ? height - bottomPad : pairs[i + 1][1] - minGap;
        pairs[i][1] = Math.min(pairs[i][1], maxAllowed);
      }
      return new Map<string, number>(pairs);
    };

    const nodeMap = new Map<string, Node>();
    const parentsOf = new Map<string, Set<string>>();
    const links: Link[] = [];
    const linkSet = new Set<string>();

    // Root node at depth 0
    const rootId = "(root)";
    const rootX = leftPad + 0 * xStep;
    nodeMap.set(rootId, { id: rootId, label: "(root)", x: rootX, y: height / 2, fx: rootX });

    // Create nodes (with fixed x by ply) and record parent relationships
    for (const line of filteredPvLines) {
      let prevId = rootId;
      for (let i = 0; i < line.length; i++) {
        const san = line[i];
        const id = `${i + 1}:${san}`;
        if (!nodeMap.has(id)) {
          const x = leftPad + (i + 1) * xStep;
          nodeMap.set(id, { id, label: san, x, fx: x });
        }
        // parent relation
        if (!parentsOf.has(id)) parentsOf.set(id, new Set());
        parentsOf.get(id)!.add(prevId);
        // links (with first-ply color)
        const linkKey = `${prevId}->${id}`;
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey);
          const color = i === 0 ? (firstSanColor[san] || "var(--mantine-color-dark-3)") : undefined;
          links.push({ source: prevId, target: id, color, highlightColor: color });
        }
        prevId = id;
      }
    }

    // Lay out by depth: first-ply anchored by evaluation (with separation), deeper plies initialized by parent average (with separation)
    const depthToIds = new Map<number, string[]>();
    for (const id of nodeMap.keys()) {
      const d = getDepth(id);
      if (!depthToIds.has(d)) depthToIds.set(d, []);
      depthToIds.get(d)!.push(id);
    }

    const nodeHeight = 22; // approximate visual height

    // Depth 1: set y from evaluation mapping, anchor with fy; apply separation
    const depth1 = depthToIds.get(1) || [];
    const depth1Separated = separateLayer(
      depth1,
      (id) => {
        const san = id.slice(id.indexOf(":") + 1);
        const evalVal = typeof firstSanEval[san] === "number" ? firstSanEval[san] : 50;
        return scaleY(evalVal);
      },
      nodeHeight,
    );
    for (const [id, y] of depth1Separated.entries()) {
      const n = nodeMap.get(id)!;
      n.y = y;
      n.fy = y;
    }

    // Depth >= 2: average of parent y, separated; no fy (allow force to adjust)
    const maxDepth = Math.max(...Array.from(depthToIds.keys()));
    for (let d = 2; d <= maxDepth; d++) {
      const ids = depthToIds.get(d) || [];
      const separated = separateLayer(
        ids,
        (id) => {
          const parents = Array.from(parentsOf.get(id) || []);
          const parentYs = parents.map((pid) => nodeMap.get(pid)?.y).filter((v): v is number => typeof v === "number");
          const avg = parentYs.length > 0 ? parentYs.reduce((a, b) => a + b, 0) / parentYs.length : height / 2;
          return avg;
        },
        nodeHeight,
      );
      for (const [id, y] of separated.entries()) {
        const n = nodeMap.get(id)!;
        n.y = y;
      }
    }

    return { nodes: Array.from(nodeMap.values()), links } as { nodes: Node[]; links: Link[] };
  }, [filteredPvLines, dimensions, firstSanColor, firstSanEval]);

  const config = useMemo(() => {
    return {
      directed: true,
      collapsible: false,
      height: dimensions?.height ?? 300,
      width: dimensions?.width ?? 600,
      panAndZoom: true,
      nodeHighlightBehavior: true,
      linkHighlightBehavior: true,
      staticGraph: false,
      d3: {
        gravity: -250,
        linkLength: 90,
        linkStrength: 1,
        alphaTarget: 0.15,
      },
      node: {
        color: "#343a40",
        size: 300,
        highlightStrokeColor: "#4dabf7",
        fontColor: "var(--mantine-color-gray-2)",
        labelProperty: "label",
      },
      link: {
        color: "var(--mantine-color-dark-3)",
        highlightColor: "#4dabf7",
      },
    } as any;
  }, [dimensions]);

  const sliderMax = Math.max(1, rankedFirstSANs.length || 1);
  const sliderValue = Math.min(topN, sliderMax);

  return (
    <Box style={{ width: "100%" }}>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>PV Lines Graph</Text>
        <Group gap="sm" align="center" style={{ minWidth: 220 }}>
          <Text size="xs" c="dimmed">Top moves:</Text>
          <Slider
            value={sliderValue}
            onChange={setTopN}
            min={1}
            max={sliderMax}
            step={1}
            marks={[{ value: 1 }, { value: sliderMax }]}
            style={{ width: 160 }}
          />
          <Text size="xs" c="dimmed">{topN}</Text>
        </Group>
      </Group>

      <Box ref={containerRef} style={{ width: "100%", height: "30vh", borderRadius: 8, border: "1px solid var(--mantine-color-dark-4)", position: "relative" }}>
        {loading ? (
          <Box w="100%" h="100%" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader size="sm" />
          </Box>
        ) : filteredPvLines.length === 0 || !dimensions ? (
          <Box w="100%" h="100%" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Text size="sm" c="dimmed">No engine lines yet</Text>
          </Box>
        ) : (
          <Graph id="pv-lines-graph" data={graphData as any} config={config} />
        )}
      </Box>
    </Box>
  );
}

export default memo(LinesTree); 