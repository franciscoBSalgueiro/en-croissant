import { memo, useContext, useMemo, useRef, useState, useEffect } from "react";
import { Box, Loader, Text, Group, Slider } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { makeSan } from "chessops/san";
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
  const store = useContext(TreeStateContext)!;
  const rootFen = useStore(store, (s) => s.root.fen);
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const currentMoves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [topN, setTopN] = useState<number>(5);

  // Persistent graph across moves
  type PersistNode = { id: string; label: string; x?: number; y?: number; fx?: number; fy?: number };
  type PersistLink = { source: string; target: string; color?: string };
  const persistentRef = useRef<{
    nodes: Map<string, PersistNode>;
    links: Map<string, PersistLink>;
    firstEval: Map<string, number>;
    firstColor: Map<string, string>;
  }>({ nodes: new Map(), links: new Map(), firstEval: new Map(), firstColor: new Map() });
  const [version, setVersion] = useState(0);

  // Merge current suggestions and path into persistent graph
  useEffect(() => {
    const rootId = "(root)";
    const p = persistentRef.current;
    if (!p.nodes.has(rootId)) p.nodes.set(rootId, { id: rootId, label: "(root)" });

    // Update persistent first SAN eval/colors
    for (const [san, c] of Object.entries(firstSanColor)) {
      if (!p.firstColor.has(san)) p.firstColor.set(san, c);
    }
    for (const [san, v] of Object.entries(firstSanEval)) {
      const prev = p.firstEval.get(san);
      if (prev === undefined || v > prev) p.firstEval.set(san, v);
    }

    // Compute SAN path from root for the actual moves played
    const pathSans: string[] = [];
    const [pos0] = positionFromFen(rootFen);
    if (pos0) {
      for (const uci of currentMoves) {
        const m = parseUci(uci);
        if (!m) break;
        const san = makeSan(pos0, m);
        pathSans.push(san);
        pos0.play(m);
      }
    }

    // Add path nodes and links up to current ply
    let prevId = rootId;
    for (let i = 0; i < pathSans.length; i++) {
      const san = pathSans[i];
      const id = `${i + 1}:${san}`;
      if (!p.nodes.has(id)) p.nodes.set(id, { id, label: san });
      const key = `${prevId}->${id}`;
      if (!p.links.has(key)) p.links.set(key, { source: prevId, target: id });
      prevId = id;
    }

    // Offset depth for current suggestions and merge
    const baseDepth = pathSans.length; // absolute ply offset from root
    const parentForFirst = baseDepth === 0 ? rootId : `${baseDepth}:${pathSans[baseDepth - 1]}`;

    // Respect Top-N for immediate next moves at current node
    const allowedFirstSet = new Set(rankedFirstSANs.slice(0, topN));

    for (const line of pvLines) {
      let parent = parentForFirst;
      for (let i = 0; i < line.length; i++) {
        const san = line[i];
        if (i === 0 && allowedFirstSet.size > 0 && !allowedFirstSet.has(san)) {
          // Skip entire branch if first move not allowed this render
          break;
        }
        const depth = baseDepth + i + 1;
        const id = `${depth}:${san}`;
        if (!p.nodes.has(id)) p.nodes.set(id, { id, label: san });
        const key = `${parent}->${id}`;
        if (!p.links.has(key)) {
          const color = i === 0 ? (firstSanColor[san] || p.firstColor.get(san)) : undefined;
          p.links.set(key, { source: parent, target: id, color });
        }
        parent = id;
      }
    }

    setVersion((v) => v + 1);
  }, [pvLines, currentMoves, rootFen, firstSanColor, firstSanEval, rankedFirstSANs, topN]);

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

  const graphData = useMemo(() => {
    type Node = { id: string; label?: string; x?: number; y?: number; fx?: number; fy?: number };
    type Link = { source: string; target: string; color?: string; highlightColor?: string; strokeWidth?: number };

    const width = dimensions?.width ?? 600;
    const height = dimensions?.height ?? 300;
    const leftPad = 40;
    const rightPad = 20;
    const topPad = 20;
    const bottomPad = 20;

    const getDepth = (id: string) => {
      const idx = id.indexOf(":");
      if (idx <= 0) return 0;
      const d = Number.parseInt(id.slice(0, idx), 10);
      return Number.isFinite(d) ? d : 0;
    };

    // Separate layers to avoid overlap while preserving order
    const separateLayer = (ids: string[], yGetter: (id: string) => number, minGap: number) => {
      if (ids.length === 0) return new Map<string, number>();
      const pairs = ids.map((id) => [id, yGetter(id)] as [string, number]).sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < pairs.length; i++) {
        const minAllowed = i === 0 ? topPad : pairs[i - 1][1] + minGap;
        pairs[i][1] = Math.max(pairs[i][1], minAllowed);
      }
      for (let i = pairs.length - 1; i >= 0; i--) {
        const maxAllowed = i === pairs.length - 1 ? height - bottomPad : pairs[i + 1][1] - minGap;
        pairs[i][1] = Math.min(pairs[i][1], maxAllowed);
      }
      return new Map<string, number>(pairs);
    };

    const p = persistentRef.current;

    // Ensure a persistent node object exists for a given id
    const ensure = (id: string) => {
      let pn = p.nodes.get(id);
      if (!pn) {
        const label = id === "(root)" ? "(root)" : id.slice(id.indexOf(":") + 1);
        pn = { id, label };
        p.nodes.set(id, pn);
      }
      return pn;
    };

    // Build adjacency by source
    const bySource = new Map<string, Array<{ key: string; target: string; color?: string }>>();
    for (const [key, { source, target, color }] of p.links.entries()) {
      if (!bySource.has(source)) bySource.set(source, []);
      bySource.get(source)!.push({ key, target, color });
    }

    // Construct SAN path and link keys for current position
    const pathSans: string[] = [];
    const pathNodes: string[] = [];
    const pathLinkKeys = new Set<string>();
    const [pos0] = positionFromFen(rootFen);
    if (pos0) {
      let prevId = "(root)";
      pathNodes.push(prevId);
      for (const uci of currentMoves) {
        const m = parseUci(uci);
        if (!m) break;
        const san = makeSan(pos0, m);
        pathSans.push(san);
        const id = `${pathSans.length}:${san}`;
        pathLinkKeys.add(`${prevId}->${id}`);
        pos0.play(m);
        prevId = id;
        pathNodes.push(prevId);
      }
    }

    const lastPathKey = (() => {
      if (pathSans.length === 0) return null;
      const lastId = `${pathSans.length}:${pathSans[pathSans.length - 1]}`;
      const prevId = pathSans.length === 1 ? "(root)" : `${pathSans.length - 1}:${pathSans[pathSans.length - 2]}`;
      return `${prevId}->${lastId}`;
    })();

    // Allowed first moves for the current node
    const allowedFirstSet = new Set(rankedFirstSANs.slice(0, topN));
    const currentParentId = pathSans.length === 0 ? "(root)" : `${pathSans.length}:${pathSans[pathSans.length - 1]}`;

    // Build visible subgraph: include traversed path, and BFS from currentParentId respecting Top-N for depth+1
    const includeLinkKeys = new Set<string>();
    const includeNodes = new Set<string>();
    for (const key of pathLinkKeys) { if (p.links.has(key)) includeLinkKeys.add(key); }
    for (const id of pathNodes) includeNodes.add(id);

    const queue: string[] = [currentParentId];
    const visitedSources = new Set<string>();
    while (queue.length > 0) {
      const src = queue.shift()!;
      if (visitedSources.has(src)) continue;
      visitedSources.add(src);
      const outs = bySource.get(src) || [];
      for (const { key, target, color } of outs) {
        const onPath = pathLinkKeys.has(key);
        if (src === currentParentId) {
          const targetSan = target.slice(target.indexOf(":") + 1);
          if (!allowedFirstSet.has(targetSan) && !onPath) continue; // enforce Top-N at current frontier
        }
        includeLinkKeys.add(key);
        if (!includeNodes.has(target)) {
          includeNodes.add(target);
          queue.push(target);
        }
        // also ensure the source node is included
        includeNodes.add(src);
      }
    }

    // Compute first-ply eval scaling among included nodes
    const firstIds = Array.from(includeNodes).filter((id) => getDepth(id) === 1);
    const firstSans = firstIds.map((id) => id.slice(id.indexOf(":") + 1));
    const evalValues: number[] = firstSans
      .map((san) => p.firstEval.get(san))
      .filter((v): v is number => typeof v === "number");
    const minEval = evalValues.length > 0 ? Math.min(...evalValues) : 50;
    const maxEval = evalValues.length > 0 ? Math.max(...evalValues) : 50;
    const innerH = Math.max(1, height - topPad - bottomPad);
    const scaleY = (val: number) => {
      if (maxEval === minEval) return topPad + innerH / 2;
      const t = (val - minEval) / (maxEval - minEval);
      return topPad + (1 - t) * innerH;
    };
    const clampY = (y: number) => Math.max(topPad, Math.min(height - bottomPad, y));

    // Determine max depth among included nodes for iterating plies
    const maxDepth = Math.max(0, ...Array.from(includeNodes).map((id) => getDepth(id)));
    const plyWidth = 100; // px per ply (fixed spacing)

    // Prepare parents map from included links
    const parentsOf = new Map<string, Set<string>>();
    for (const key of includeLinkKeys) {
      const link = p.links.get(key);
      if (!link) continue;
      if (!parentsOf.has(link.target)) parentsOf.set(link.target, new Set());
      parentsOf.get(link.target)!.add(link.source);
    }

    // Assign coordinates only for nodes that don't have them yet, by depth
    const nodeMap = new Map<string, Node>();
    const byDepth = new Map<number, string[]>();
    for (const id of includeNodes) {
      const d = getDepth(id);
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(id);
    }

    const nodeHeight = 22;

    // Depth 0 (root)
    {
      const id = "(root)";
      const pn = ensure(id);
      if (pn && pn.y === undefined) {
        pn.x = leftPad; pn.fx = leftPad;
        pn.y = clampY(height / 2); pn.fy = pn.y;
      }
      nodeMap.set(id, { id, label: pn.label, x: pn.x, y: pn.y, fx: pn.fx, fy: pn.fy });
    }

    // Depth 1: compute y from eval for missing only, apply separation on missing set
    const d1Ids = (byDepth.get(1) || []);
    const missingD1 = d1Ids.filter((id) => (p.nodes.get(id)?.y === undefined));
    if (missingD1.length > 0) {
      const separated = separateLayer(
        missingD1,
        (id) => {
          const san = id.slice(id.indexOf(":") + 1);
          const v = p.firstEval.get(san) ?? 50;
          return scaleY(v);
        },
        nodeHeight,
      );
      for (const [id, y] of separated) {
        const pn = ensure(id);
        const depth = 1;
        const x = leftPad + depth * plyWidth;
        pn.x = x; pn.fx = x;
        const cy = clampY(y);
        pn.y = cy; pn.fy = cy;
      }
    }
    // Fill nodeMap for depth 1 (use existing coords if present)
    for (const id of d1Ids) {
      const pn = ensure(id);
      if (pn.x === undefined) { const x = leftPad + 1 * plyWidth; pn.x = x; pn.fx = x; }
      if (pn.y === undefined) { pn.y = clampY(height / 2); pn.fy = pn.y; }
      nodeMap.set(id, { id, label: pn.label, x: pn.x, y: pn.y, fx: pn.fx, fy: pn.fy });
    }

    // Depth >= 2: for missing only, y = avg(parent y); fill nodeMap
    for (let d = 2; d <= maxDepth; d++) {
      const ids = byDepth.get(d) || [];
      const missing = ids.filter((id) => (p.nodes.get(id)?.y === undefined));
      if (missing.length > 0) {
        const separated = separateLayer(
          missing,
          (id) => {
            const parents = Array.from(parentsOf.get(id) || []);
            const parentYs = parents.map((pid) => (p.nodes.get(pid)?.y)).filter((v): v is number => typeof v === "number");
            const avg = parentYs.length > 0 ? parentYs.reduce((a, b) => a + b, 0) / parentYs.length : height / 2;
            return avg;
          },
          nodeHeight,
        );
        for (const [id, y] of separated) {
          const pn = ensure(id);
          const x = leftPad + d * plyWidth;
          pn.x = x; pn.fx = x;
          const cy = clampY(y);
          pn.y = cy; pn.fy = cy;
        }
      }
      for (const id of ids) {
        const pn = ensure(id);
        if (pn.x === undefined) { const x = leftPad + d * plyWidth; pn.x = x; pn.fx = x; }
        if (pn.y === undefined) { pn.y = clampY(height / 2); pn.fy = pn.y; }
        nodeMap.set(id, { id, label: pn.label, x: pn.x, y: pn.y, fx: pn.fx, fy: pn.fy });
      }
    }

    // Ensure any nodes not filled (e.g., only root) are in nodeMap
    for (const id of includeNodes) {
      if (!nodeMap.has(id)) {
        const pn = ensure(id);
        nodeMap.set(id, { id, label: pn.label, x: pn.x, y: pn.y, fx: pn.fx, fy: pn.fy });
      }
    }

    // Build final links from included keys with widths
    const links: Link[] = [];
    for (const key of includeLinkKeys) {
      const link = p.links.get(key);
      if (!link) continue;
      const { source, target, color } = link;
      const onPath = pathLinkKeys.has(key);
      const isLast = lastPathKey === key;
      const strokeWidth = isLast ? 3 : onPath ? 2 : 1;
      links.push({ source, target, color, highlightColor: color, strokeWidth });
    }

    return { nodes: Array.from(nodeMap.values()), links } as { nodes: Node[]; links: Link[] };
  }, [dimensions, version, rootFen, currentMoves, rankedFirstSANs, topN]);

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
        strokeWidth: 1,
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
        ) : !dimensions ? (
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