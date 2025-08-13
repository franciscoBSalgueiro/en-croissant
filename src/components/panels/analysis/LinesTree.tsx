import { memo, useContext, useMemo, useRef, useState, useEffect } from "react";
import { Box, Loader, Text, Group, Slider, Select } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { makeSan } from "chessops/san";
import { makeFen } from "chessops/fen";
import { activeTabAtom } from "@/state/atoms";
import { unifiedMovesFamily } from "@/state/unifiedMoves";
import { loadable } from "jotai/utils";
import { Graph } from "react-d3-graph";
import { ANNOTATION_INFO, type Annotation } from "@/utils/annotation";
import { formatScore, normalizeScore } from "@/utils/score";

// Build a merged graph from multiple engine PV lines (SAN from current position)
function useUnifiedPVs(): {
  pvLines: string[][];
  rankedFirstSANs: string[];
  firstSanColor: Record<string, string>;
  firstSanEval: Record<string, number>;
  firstSanMeta: Record<string, { winChance?: number; score?: any; engineName?: string; annotation?: string; confidence?: number; pctBest?: number }>;
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

  const { pvLines, rankedFirstSANs, firstSanColor, firstSanEval, firstSanMeta } = useMemo(() => {
    const lines: string[][] = [];
    const firstMoveToWin: Map<string, number> = new Map();
    const firstSanColor: Record<string, string> = {};
    const firstSanEval: Record<string, number> = {};
    const firstSanMeta: Record<string, { winChance?: number; score?: any; engineName?: string; annotation?: string; confidence?: number; pctBest?: number }> = {};

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
      // store meta for first move, include confidence
      const prevMeta = firstSanMeta[first];
      const prevConf = prevMeta?.confidence ?? -1;
      const curConf = m.confidence ?? -1;
             if (!prevMeta || curConf > prevConf) {
        firstSanMeta[first] = {
          winChance: m.winChance,
          score: m.score,
          engineName: m.engineName,
          annotation: m.annotation,
          confidence: m.confidence,
          pctBest: (m as any).pctBest,
        };
      }
    }

    // Ensure BEST move is colored blue in the graph
    if (bestFirstSan) {
      firstSanColor[bestFirstSan] = "var(--mantine-color-blue-6)";
    }

    const rankedFirstSANs = Array.from(firstMoveToWin.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([san]) => san);

    return { pvLines: lines, rankedFirstSANs, firstSanColor, firstSanEval, firstSanMeta };
  }, [unifiedMoves]);

  return { pvLines, rankedFirstSANs, firstSanColor, firstSanEval, firstSanMeta, loading };
}

function LinesTree() {
  const { pvLines, rankedFirstSANs, firstSanColor, firstSanEval, firstSanMeta, loading } = useUnifiedPVs();
  const store = useContext(TreeStateContext)!;
  const rootFen = useStore(store, (s) => s.root.fen);
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const currentMoves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );
  const activeTab = useAtomValue(activeTabAtom)!;

  // Previous position (parent of current) unified moves to enrich last path link
  const prevMoves = useMemo(() => currentMoves.slice(0, -1), [currentMoves]);
  const prevFen = useMemo(() => {
    const [p0] = positionFromFen(rootFen);
    if (!p0) return rootFen;
    for (const u of prevMoves) {
      const mm = parseUci(u);
      if (!mm) break;
      p0.play(mm);
    }
    try {
      return makeFen(p0.toSetup());
    } catch {
      return rootFen;
    }
  }, [rootFen, prevMoves]);
  const prevUnifiedAtom = useMemo(
    () => loadable(unifiedMovesFamily({ rootFen, fen: prevFen, moves: prevMoves, tab: activeTab })),
    [rootFen, prevFen, prevMoves, activeTab]
  );
  const prevUnifiedLoadable = useAtomValue(prevUnifiedAtom);
  const prevUnifiedMoves = prevUnifiedLoadable.state === "hasData" ? prevUnifiedLoadable.data : [];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [topN, setTopN] = useState<number>(5);
  const [depthLimit, setDepthLimit] = useState<number>(5);
  // Horizontal panning state (x-only)
  const [panX, setPanX] = useState<number>(0);
  const [yMode, setYMode] = useState<'cp' | 'pctBest' | 'confidence'>('pctBest');
  const [colorMode, setColorMode] = useState<'cp' | 'pctBest' | 'confidence'>('pctBest');
  const [labelMode, setLabelMode] = useState<'cp' | 'pctBest' | 'confidence'>('cp');
  const dragRef = useRef<{ dragging: boolean; startX: number }>({ dragging: false, startX: 0 });

  // Persistent graph across moves
  type PersistNode = { id: string; label: string; x?: number; y?: number; fx?: number; fy?: number };
  type PersistLink = { source: string; target: string; color?: string; winChance?: number; score?: any; engineName?: string; annotation?: string; confidence?: number; pctBest?: number };
  const persistentRef = useRef<{
    nodes: Map<string, PersistNode>;
    links: Map<string, PersistLink>;
    firstEval: Map<string, number>;
    firstColor: Map<string, string>;
    firstConfidence: Map<string, number>;
    pvKeys: Set<string>;
  }>({ nodes: new Map(), links: new Map(), firstEval: new Map(), firstColor: new Map(), firstConfidence: new Map(), pvKeys: new Set() });
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
    // Update persistent first SAN confidence (keep max)
    for (const [san, meta] of Object.entries(firstSanMeta)) {
      const conf = meta.confidence;
      if (typeof conf === "number") {
        const prev = p.firstConfidence.get(san);
        if (prev === undefined || conf > prev) p.firstConfidence.set(san, conf);
      }
    }

    // Compute SAN path from root for the actual moves played
    const pathSans: string[] = [];
    const [pos0] = positionFromFen(rootFen);
    if (pos0) {
      let prevId = rootId;
      for (const uci of currentMoves) {
        const m = parseUci(uci);
        if (!m) break;
        const san = makeSan(pos0, m);
        pathSans.push(san);
        const id = `${pathSans.length}:${san}`;
        if (!p.nodes.has(id)) p.nodes.set(id, { id, label: san });
        const key = `${prevId}->${id}`;
        // Merge or create path link with best-known meta so it's fully styled and placed
        const existing = p.links.get(key) as any;
        const meta = (firstSanMeta as any)[san] as any;
        const color = (firstSanColor as any)[san] || p.firstColor.get(san);
        const winChance = meta?.winChance ?? p.firstEval.get(san);
        const confidence = meta?.confidence ?? p.firstConfidence.get(san);
        const nextLink = {
          source: prevId,
          target: id,
          color: existing?.color ?? color,
          // enrich metrics so edge color/label and y-positioning work even if it wasn't in Top-N
          winChance: existing?.winChance ?? winChance,
          score: existing?.score ?? meta?.score,
          engineName: existing?.engineName ?? meta?.engineName,
          annotation: existing?.annotation ?? meta?.annotation,
          confidence: existing?.confidence ?? confidence,
          pctBest: existing?.pctBest ?? meta?.pctBest,
        } as any;
        p.links.set(key, nextLink);
        pos0.play(m);
        prevId = id;
      }
    }

    // Add path nodes and links up to current ply
    // Already handled while building path above

    const baseDepth = pathSans.length; // absolute ply offset from root
    const parentForFirst = baseDepth === 0 ? rootId : `${baseDepth}:${pathSans[baseDepth - 1]}`;

    // Respect Top-N for immediate next moves at current node when merging (still persist only allowed first moves to reduce noise)
    const allowedFirstSet = new Set(rankedFirstSANs.slice(0, topN));

    // Remove and replace the set: outgoing links from the current node to any future depths (>= n+1)
    const toDelete: string[] = [];
    for (const [key, link] of p.links.entries()) {
      const idx = link.source.indexOf(":");
      const sourceDepth = idx > 0 ? Number.parseInt(link.source.slice(0, idx), 10) : (link.source === rootId ? 0 : 0);
      if (sourceDepth >= baseDepth) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) p.links.delete(key);
    p.pvKeys.clear();

    // Recalculate immediate future links (n+1) from current top lines; also add subsequent depths for those PVs
    const seenFirst = new Set<string>();
    for (const line of pvLines) {
      const san = line[0];
      if (!san) continue;
      if (allowedFirstSet.size > 0 && !allowedFirstSet.has(san)) continue;
      if (seenFirst.has(san)) continue;
      seenFirst.add(san);

      const depth = baseDepth + 1;
      const id = `${depth}:${san}`;
      if (!p.nodes.has(id)) p.nodes.set(id, { id, label: san });

      const key = `${parentForFirst}->${id}`;
      const color = firstSanColor[san] || p.firstColor.get(san);
      const meta = firstSanMeta[san];

      p.links.set(key, {
        source: parentForFirst,
        target: id,
        color,
        winChance: meta?.winChance,
        score: meta?.score,
        engineName: meta?.engineName,
        annotation: meta?.annotation,
        // attach confidence and pctBest for sizing/labeling and color
        confidence: meta?.confidence,
        pctBest: meta?.pctBest,
      } as any);
      p.pvKeys.add(key);

      // Add subsequent depths for this PV line by chaining SAN moves
      let prevId = id;
      for (let i = 1; i < Math.min(line.length, depthLimit); i++) {
        const nextSan = line[i];
        if (!nextSan) break;
        const d = baseDepth + 1 + i;
        const nextId = `${d}:${nextSan}`;
        if (!p.nodes.has(nextId)) p.nodes.set(nextId, { id: nextId, label: nextSan });
        const key2 = `${prevId}->${nextId}`;
        p.links.set(key2, {
          source: prevId,
          target: nextId,
          // propagate styling/meta from first move to keep consistent visuals
          color,
          winChance: meta?.winChance,
          score: meta?.score,
          engineName: meta?.engineName,
          annotation: meta?.annotation,
          confidence: meta?.confidence,
          pctBest: meta?.pctBest,
        } as any);
        p.pvKeys.add(key2);
        prevId = nextId;
      }
    }

    // Enrich the last path link using unified moves from the previous position (parent of current)
    if (pathSans.length > 0) {
      const lastSan = pathSans[pathSans.length - 1];
      const lastDepth = pathSans.length;
      const lastTarget = `${lastDepth}:${lastSan}`;
      const lastSource = lastDepth === 1 ? rootId : `${lastDepth - 1}:${pathSans[lastDepth - 2]}`;
      const lastKey = `${lastSource}->${lastTarget}`;
      const link = p.links.get(lastKey) as any;
      if (link) {
        const u = prevUnifiedMoves.find((m: any) => (m.san ?? m.move) === lastSan);
        if (u) {
          if (link.score == null && u.score) link.score = u.score;
          if (link.winChance == null && typeof u.winChance === 'number') link.winChance = u.winChance;
          if (link.confidence == null && typeof u.confidence === 'number') link.confidence = u.confidence;
          if (link.pctBest == null && typeof u.pctBest === 'number') link.pctBest = u.pctBest;
          if (link.engineName == null && u.engineName) link.engineName = u.engineName;
        }
        // Fallbacks from persistent maps if still missing
        if (link.confidence == null) link.confidence = p.firstConfidence.get(lastSan);
        if (link.color == null) link.color = p.firstColor.get(lastSan);
        if (link.winChance == null) link.winChance = p.firstEval.get(lastSan);
      }
    }

    setVersion((v) => v + 1);
  }, [pvLines, currentMoves, rootFen, firstSanColor, firstSanEval, rankedFirstSANs, topN, firstSanMeta, prevUnifiedMoves, depthLimit]);

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

  // Add CSS to prevent D3 graph dragging while allowing clicks
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add CSS to prevent dragging on SVG elements
    const style = document.createElement('style');
    style.textContent = `
      #pv-lines-graph svg {
        pointer-events: auto !important;
      }
      #pv-lines-graph svg * {
        pointer-events: none !important;
      }
      #pv-lines-graph svg .node {
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      #pv-lines-graph svg .link {
        pointer-events: auto !important;
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const graphData = useMemo(() => {
    type Node = { id: string; label?: string; x?: number; y?: number; fx?: number; fy?: number; color?: string };
    type Link = { source: string; target: string; color?: string; highlightColor?: string; strokeWidth?: number; opacity?: number; strokeDasharray?: string; label?: string };

    const width = dimensions?.width ?? 600;
    const height = dimensions?.height ?? 300;
    let leftPad = 40;
    const rightPad = 150;
    const topPad = 20;
    const bottomPad = 20;
    // Fixed spacing between plies

    // Determine starting side to move from root FEN
    const [startPos] = positionFromFen(rootFen);
    const startTurn = startPos?.turn ?? "white";
    const nodeColorForDepth = (depth: number) => {
      const isWhiteToMove = startTurn === "white" ? depth % 2 === 0 : depth % 2 !== 0;
      return isWhiteToMove ? "var(--mantine-color-dark-6)" : "var(--mantine-color-dark-2)";
    };

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
    const bySource = new Map<string, Array<{ key: string; target: string; color?: string; winChance?: number; confidence?: number }>>();
    for (const [key, link] of p.links.entries()) {
      const { source, target, color } = link as any;
      const winChance = (link as any).winChance as number | undefined;
      const confidence = (link as any).confidence as number | undefined;
      const pctBest = (link as any).pctBest as number | undefined;
      if (!bySource.has(source)) bySource.set(source, []);
      bySource.get(source)!.push({ key, target, color, winChance, confidence, pctBest } as any);
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
    const baseDepth = pathSans.length;

    // Select links: always include path; include all PV-chained links for current node
    const selectedLinkKeys = new Set<string>();
    for (const key of pathLinkKeys) if (p.links.has(key)) selectedLinkKeys.add(key);
    // Preserve historical links up to current ply (target depth <= baseDepth)
    for (const [hKey, hLink] of p.links.entries()) {
      const t = (hLink as any).target as string;
      const idx = t.indexOf(":");
      const tDepth = idx > 0 ? Number.parseInt(t.slice(0, idx), 10) : 0;
      if (Number.isFinite(tDepth) && tDepth <= baseDepth) selectedLinkKeys.add(hKey);
    }
    for (const key of p.pvKeys) if (p.links.has(key)) selectedLinkKeys.add(key);

    // Nodes visible are endpoints of selected links plus root and path nodes
    const includeNodes = new Set<string>();
    includeNodes.add("(root)");
    for (const id of pathNodes) includeNodes.add(id);
    for (const key of selectedLinkKeys) {
      const link = p.links.get(key);
      if (!link) continue;
      includeNodes.add(link.source);
      includeNodes.add(link.target);
    }

    // Compute first-ply eval scaling among included nodes
    const clampY = (y: number) => Math.max(topPad, Math.min(height - bottomPad, y));
    const innerH = Math.max(1, height - topPad - bottomPad);

    // Determine max depth among included nodes for iterating plies
    const maxDepth = Math.max(0, ...Array.from(includeNodes).map((id) => getDepth(id)));

    // Use fixed ply width and left-align, but ensure maxDepth nodes are visible
    const plyWidth = 150;
    // Predict final max depth to avoid pan "jerk" across the two-phase render (path → PV)
    const predictedMaxDepth = Math.max(maxDepth, baseDepth + depthLimit);
    const maxDepthX = leftPad + predictedMaxDepth * plyWidth + rightPad;
    const minPanToShowMax = width - maxDepthX;

    // Auto-pan to place the just-played move at the left edge padding (or root at start)
    const currentDepth = baseDepth;
    const targetPan = -currentDepth * plyWidth; // align current ply at left padding
    const adjustedPanX = Math.min(0, Math.max(minPanToShowMax, targetPan));
    leftPad = leftPad + adjustedPanX;

    // Prepare parents map from included links
    const parentsOf = new Map<string, Set<string>>();
    for (const key of selectedLinkKeys) {
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
      // Always update X to follow panning; keep Y stable
      pn.x = leftPad; pn.fx = leftPad;
      if (pn.y === undefined) {
        pn.y = clampY(height / 2); pn.fy = pn.y;
      }
      const color = nodeColorForDepth(0);
      nodeMap.set(id, { id, label: pn.label, x: pn.x, y: pn.y, fx: pn.fx, fy: pn.fy, color });
    }

    // Helper: position nodes by selected metric mapped to graph height, then separate to avoid overlaps
    const assignByMetric = (
      ids: string[],
      getConfidence: (id: string) => number,
      getPctBest: (id: string) => number,
      getCP: (id: string) => number,
    ) => {
      if (ids.length === 0) return;
      const yMap = separateLayer(
        ids,
        (id) => {
          if (yMode === 'confidence') {
            const raw = getConfidence(id);
            const v = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
            return clampY(topPad + innerH * (1 - v / 100));
          }
          if (yMode === 'pctBest') {
            const raw = getPctBest(id);
            const v = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
            return clampY(topPad + innerH * (1 - v / 100));
          }
          // cp mode: map -10..+10 to 0..1 (clamped)
          const rawCp = getCP(id);
          const cp = Number.isFinite(rawCp) ? Math.max(-10, Math.min(10, rawCp)) : 0;
          const t = (cp + 10) / 20; // 0..1
          const yDesired = topPad + innerH * (1 - t);
          return clampY(yDesired);
        },
        nodeHeight + 8,
      );
      ids.forEach((id) => {
        const pn = ensure(id);
        const d = getDepth(id);
        const x = leftPad + d * plyWidth;
        pn.x = x; pn.fx = x;
        const y = yMap.get(id) ?? clampY(topPad + innerH / 2);
        pn.y = y; pn.fy = y;
        const color = nodeColorForDepth(d);
        nodeMap.set(id, { id, label: pn.label, x: pn.x, y: pn.y, fx: pn.fx, fy: pn.fy, color });
      });
    };

    // Depth 1: map by selected metric
    const d1Ids = (byDepth.get(1) || []);
    assignByMetric(
      d1Ids,
      (id) => {
        const san = id.slice(id.indexOf(":") + 1);
        return p.firstConfidence.get(san) ?? 0;
      },
      (id) => {
        // pctBest for first layer links
        const san = id.slice(id.indexOf(":") + 1);
        const key = `(root)->1:${san}`;
        const link = p.links.get(key) as any;
        return typeof link?.pctBest === 'number' ? link.pctBest : 0;
      },
      (id) => {
        // cp score from link score.value (centipawns -> /100)
        const san = id.slice(id.indexOf(":") + 1);
        const key = `(root)->1:${san}`;
        const link = p.links.get(key) as any;
        const sv = link?.score?.value;
        if (!sv) return 0;
        // Normalize to current side to move from root
        const [startPos] = positionFromFen(rootFen);
        const turn = startPos?.turn ?? 'white';
        const cp = normalizeScore(sv, turn) / 100; // convert to pawn units
        return cp;
      },
    );

    // Depth >= 2: map by selected metric using max incoming per node
    for (let d = 2; d <= maxDepth; d++) {
      const ids = byDepth.get(d) || [];
      const confByNode = new Map<string, number>();
      const pctByNode = new Map<string, number>();
      const cpByNode = new Map<string, number>();
      for (const key of selectedLinkKeys) {
        const link = p.links.get(key) as any;
        if (!link) continue;
        const tgt = link.target as string;
        const tgtDepth = getDepth(tgt);
        if (tgtDepth !== d) continue;
        const conf = typeof link.confidence === 'number' ? link.confidence : (typeof link.winChance === 'number' ? link.winChance : 0);
        confByNode.set(tgt, Math.max(conf, confByNode.get(tgt) ?? -Infinity));
        const pct = typeof link.pctBest === 'number' ? link.pctBest : 0;
        pctByNode.set(tgt, Math.max(pct, pctByNode.get(tgt) ?? -Infinity));
        const sv = link?.score?.value;
        if (sv) {
          const [startPos] = positionFromFen(rootFen);
          const turn = startPos?.turn ?? 'white';
          const cp = normalizeScore(sv, turn) / 100; // pawns
          cpByNode.set(tgt, Math.max(cp, cpByNode.get(tgt) ?? -Infinity));
        }
      }
      assignByMetric(
        ids,
        (id) => confByNode.get(id) ?? 0,
        (id) => pctByNode.get(id) ?? 0,
        (id) => cpByNode.get(id) ?? 0,
      );
    }

    const valueToColor = (val: number | undefined, mode: 'confidence' | 'pctBest' | 'cp') => {
      if (mode === 'cp') {
        if (typeof val !== 'number' || !Number.isFinite(val)) return "var(--mantine-color-dark-3)";
        const cp = Math.max(-10, Math.min(10, val)); // pawns
        const t = (cp + 10) / 20; // 0..1
        const hue = Math.max(0, Math.min(120, t * 120));
        return `hsl(${hue}, 85%, 50%)`;
      }
      if (typeof val !== 'number' || !Number.isFinite(val)) return "var(--mantine-color-dark-3)";
      const t = Math.max(0, Math.min(100, val)) / 100;
      const hue = Math.max(0, Math.min(120, t * 120));
      return `hsl(${hue}, 85%, 50%)`;
    };

    // Build final links from selected keys with widths and confidence colors
    const links: Link[] = [];
    for (const key of selectedLinkKeys) {
      const link = p.links.get(key) as any;
      if (!link) continue;
      const { source, target } = link;
      const onPath = pathLinkKeys.has(key);
      const conf = typeof link.confidence === "number" ? link.confidence : undefined;
      const pctBest = typeof link.pctBest === "number" ? link.pctBest : undefined;
      // compute cp in pawns if needed
      let cpPawns: number | undefined = undefined;
      if (colorMode === 'cp' && link.score?.value) {
        const [startPos] = positionFromFen(rootFen);
        const turn = startPos?.turn ?? 'white';
        cpPawns = normalizeScore(link.score.value, turn) / 100;
      }
      const edgeColor = valueToColor(
        colorMode === 'confidence' ? conf : (colorMode === 'pctBest' ? pctBest : cpPawns),
        colorMode,
      );
      const maxWidth = 3;
      const strokeWidth = onPath
        ? maxWidth
        : (conf !== undefined ? Math.max(1, 0.5 + (conf / 100) * 4) : 1);
      const scoreText = link.score && link.score.value ? formatScore(link.score.value, 2) : undefined;
      // compute cp for label if needed (pawns)
      let labelCpPawns: number | undefined;
      if (labelMode === 'cp' && link.score?.value) {
        const [startPos] = positionFromFen(rootFen);
        const turn = startPos?.turn ?? 'white';
        labelCpPawns = normalizeScore(link.score.value, turn) / 100;
      }
      const label = (() => {
        if (labelMode === 'confidence') return conf !== undefined ? `${conf.toFixed(0)}%` : "-";
        if (labelMode === 'pctBest') return pctBest !== undefined ? `${pctBest.toFixed(0)}%` : "-";
        return scoreText ?? (labelCpPawns !== undefined ? `${labelCpPawns.toFixed(2)}` : "-");
      })();
      links.push({
        source,
        target,
        color: edgeColor,
        highlightColor: edgeColor,
        strokeWidth,
        opacity: onPath ? 1 : 0.25,
        strokeDasharray: onPath ? undefined : "4,3",
        label,
      });
    }

    return { nodes: Array.from(nodeMap.values()), links } as { nodes: Node[]; links: Link[] };
  }, [dimensions?.width, dimensions?.height, version, rootFen, currentMoves.length, rankedFirstSANs.join("|"), topN, panX, yMode, colorMode, labelMode]);

  const config = useMemo(() => {
    return {
      directed: true,
      collapsible: false,
      height: dimensions?.height ?? 300,
      width: dimensions?.width ?? 600,
      panAndZoom: false, // disable built-in pan/zoom; we implement x-only pan
      nodeHighlightBehavior: true,
      linkHighlightBehavior: true,
      staticGraph: true,
      staticGraphWithDragAndDrop: false, // disable node dragging
      d3: {
        gravity: 0,
        linkLength: 70,
        linkStrength: 0,
        alphaTarget: 0,
        disableLinkForce: true, // disable all forces
      },
      node: {
        color: "#343a40",
        size: 300,
        highlightStrokeColor: "#4dabf7",
        fontColor: "var(--mantine-color-gray-2)",
        labelProperty: "label",
        fontSize: 14,
        mouseCursor: "default", // prevent drag cursor
      },
      link: {
        color: "var(--mantine-color-dark-3)",
        highlightColor: "#4dabf7",
        strokeWidth: 1,
        renderLabel: true,
        labelProperty: "label",
        fontColor: "var(--mantine-color-gray-4)",
        fontSize: 10,
        labelPosition: "mid", // supported by library to center labels
        opacity: 0.5,
        mouseCursor: "default", // prevent drag cursor
      },
    } as any;
  }, [dimensions]);

  const sliderMax = Math.max(1, rankedFirstSANs.length || 1);
  const sliderValue = Math.min(topN, sliderMax);
  // depthLimit represents number of plies to take from PV beyond the current node

  // Pointer handlers for horizontal pan only
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.startX = e.clientX;
    setPanX((x) => x + dx);
  };
  const endDrag = (e: React.PointerEvent) => {
    dragRef.current.dragging = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <Box style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>PV Lines Graph</Text>
        <Group gap="sm" align="center" style={{ minWidth: 940 }}>
          <Text size="xs" c="dimmed">Y-axis:</Text>
          <Select
            size="xs"
            value={yMode}
            onChange={(v) => setYMode((v as any) ?? 'confidence')}
            data={[
              { value: 'cp', label: 'Centipawn score (-10..+10)' },
              { value: 'pctBest', label: '%Best (0..100%)' },
              { value: 'confidence', label: 'Move Confidence (0..100%)' },
            ]}
            style={{ width: 240 }}
          />
          <Text size="xs" c="dimmed">Edge color:</Text>
          <Select
            size="xs"
            value={colorMode}
            onChange={(v) => setColorMode((v as any) ?? 'pctBest')}
            data={[
              { value: 'cp', label: 'Centipawn score (-10..+10)' },
              { value: 'pctBest', label: '%Best (0..100%)' },
              { value: 'confidence', label: 'Move Confidence (0..100%)' },
            ]}
            style={{ width: 240 }}
          />
          <Text size="xs" c="dimmed">Edge label:</Text>
          <Select
            size="xs"
            value={labelMode}
            onChange={(v) => setLabelMode((v as any) ?? 'confidence')}
            data={[
              { value: 'cp', label: 'Centipawn score (-10..+10)' },
              { value: 'pctBest', label: '%Best (0..100%)' },
              { value: 'confidence', label: 'Move Confidence (0..100%)' },
            ]}
            style={{ width: 240 }}
          />
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
          <Text size="xs" c="dimmed" ml={12}>Depth:</Text>
          <Slider
            value={depthLimit}
            onChange={setDepthLimit}
            min={1}
            max={12}
            step={1}
            marks={[{ value: 1 }, { value: 12 }]}
            style={{ width: 160 }}
          />
          <Text size="xs" c="dimmed">{depthLimit}</Text>
        </Group>
      </Group>

      <Box
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ width: "100%", flex: 1, minHeight: 0, borderRadius: 8, border: "1px solid var(--mantine-color-dark-4)", position: "relative", touchAction: "pan-x", cursor: "grab" }}
      >
        {!dimensions ? (
          <Box w="100%" h="100%" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Text size="sm" c="dimmed">No engine lines yet</Text>
          </Box>
        ) : (
          <>
            <Graph id="pv-lines-graph" data={graphData as any} config={config} />

            {loading && (
              <Box style={{ position: "absolute", right: 8, top: 8, pointerEvents: "none" }}>
                <Loader size="xs" />
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

export default memo(LinesTree); 