import { memo, useContext, useMemo, useRef, useState, useEffect } from "react";
import { Box, Loader, Text, Group, Slider } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci, type Move } from "chessops";
import { parseSan } from "chessops/san";
import { activeTabAtom } from "@/state/atoms";
import { hierarchy, tree as d3tree, type HierarchyPointNode, type HierarchyPointLink } from "d3-hierarchy";
import { unifiedMovesFamily } from "@/state/unifiedMoves";
import { loadable } from "jotai/utils";

// Types compatible with d3-hierarchy data model
interface TreeNode {
  name: string;
  children?: TreeNode[];
}

function countLeaves(node: TreeNode | null | undefined): number {
  if (!node) return 0;
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((acc, c) => acc + countLeaves(c), 0);
}

// Build a merged tree from multiple engine PV lines (SAN from current position)
function buildMergedTree(
  rootFen: string,
  currentMoves: string[],
  pvSets: string[],
): TreeNode {
  const [rootPos] = positionFromFen(rootFen);
  if (rootPos) {
    for (const uci of currentMoves) {
      const m = parseUci(uci);
      if (!m) break;
      rootPos.play(m);
    }
  }

  const root: TreeNode = { name: "(root)", children: [] };

  for (const san of pvSets) {
    let cursor = root;
    let pos = rootPos?.clone() ?? null;

    if (!pos) break;
    const moveObj = parseSan(pos, san);
    if (!moveObj) continue;
    pos.play(moveObj);

    if (!cursor.children) cursor.children = [];
    let child = cursor.children.find((c) => c.name === san);
    if (!child) {
      child = { name: san, children: [] };
      cursor.children.push(child);
    }
    cursor = child;
  }

  if (!root.children || root.children.length === 0) {
    return { name: "(no lines)", children: [] };
  }

  return root;
}

function useUnifiedPVs(): {
  rootFen: string;
  currentMoves: string[];
  pvSets: string[];
  rankedFirstUCIs: string[];
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

  const { pvSets, rankedFirstUCIs } = useMemo(() => {
    const pv: string[] = [];
    const firstMoveToWin: Map<string, number> = new Map();

    for (const m of unifiedMoves) {
      const san0 = m.sanMoves?.[0] || m.san || m.move;
      if (!san0) continue;
      pv.push(san0);
      if (m.winChance !== undefined) {
        const prev = firstMoveToWin.get(san0);
        if (prev === undefined || m.winChance > prev) firstMoveToWin.set(san0, m.winChance);
      }
    }

    const rankedFirstUCIs = Array.from(firstMoveToWin.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([san]) => san);

    return { pvSets: pv, rankedFirstUCIs };
  }, [unifiedMoves]);

  return { rootFen, currentMoves, pvSets, rankedFirstUCIs, loading };
}

function LinesTree() {
  const { rootFen, currentMoves, pvSets, rankedFirstUCIs, loading } = useUnifiedPVs();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const maxTop = Math.max(1, rankedFirstUCIs.length || 1);
  const [topN, setTopN] = useState<number>(Math.min(3, maxTop));

  useEffect(() => {
    setTopN((n) => Math.min(Math.max(1, n), maxTop));
  }, [maxTop]);

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

  const filteredPVs = useMemo(() => {
    if (rankedFirstUCIs.length === 0) return pvSets;
    const allowed = new Set(rankedFirstUCIs.slice(0, topN));
    return pvSets.filter((san) => san && allowed.has(san));
  }, [pvSets, rankedFirstUCIs, topN]);

  const data = useMemo(
    () => buildMergedTree(rootFen, currentMoves, filteredPVs),
    [rootFen, currentMoves, filteredPVs],
  );

  // Layout with d3-hierarchy: Y from tidy tree, X from ply (depth)
  const nodeRect = { width: 60, height: 18 };
  const vGap = 8; // vertical padding between nodes
  const nodeYSpacing = nodeRect.height + vGap;
  const margin = { top: 12, right: 12, bottom: 12, left: 40 };

  const layout = useMemo(() => {
    const root = hierarchy<TreeNode>(data);
    const t = d3tree<TreeNode>()
      .separation((a: HierarchyPointNode<TreeNode>, b: HierarchyPointNode<TreeNode>) => (a.parent === b.parent ? 1.2 : 1.5))
      .nodeSize([nodeYSpacing, 1]); // x in px (vertical), y = depth units
    t(root as any);
    return root as HierarchyPointNode<TreeNode>;
  }, [data, nodeYSpacing]);

  const { nodes, links, maxDepth, extent } = useMemo(() => {
    const nodes = (layout as HierarchyPointNode<TreeNode>).descendants();
    const links = (layout as HierarchyPointNode<TreeNode>).links();
    const maxDepth = nodes.reduce((m: number, n: HierarchyPointNode<TreeNode>) => Math.max(m, n.depth), 0);
    const minX = Math.min(...nodes.map((n) => n.depth));
    const maxX = Math.max(...nodes.map((n) => n.depth));
    const minY = Math.min(...nodes.map((n) => n.x));
    const maxY = Math.max(...nodes.map((n) => n.x));
    return { nodes, links, maxDepth, extent: { minX, maxX, minY, maxY } } as {
      nodes: HierarchyPointNode<TreeNode>[];
      links: HierarchyPointLink<TreeNode>[];
      maxDepth: number;
      extent: { minX: number; maxX: number; minY: number; maxY: number };
    };
  }, [layout]);

  // Pan/zoom state
  const [scale, setScale] = useState<number>(1);
  const [tx, setTx] = useState<number>(0);
  const [ty, setTy] = useState<number>(0);
  const [interacted, setInteracted] = useState<boolean>(false);

  // Compute auto-fit transform (centered) when data or size changes, unless user interacted
  useEffect(() => {
    if (!dimensions) return;
    if (!nodes || nodes.length === 0) return;
    if (interacted) return;

    const innerW = Math.max(0, dimensions.width - margin.left - margin.right);
    const innerH = Math.max(0, dimensions.height - margin.top - margin.bottom);
    const xStep = maxDepth > 0 ? innerW / maxDepth : innerW;

    const minPlotX = extent.minX * xStep - nodeRect.width / 2;
    const maxPlotX = extent.maxX * xStep + nodeRect.width / 2;
    const minPlotY = extent.minY - nodeRect.height / 2;
    const maxPlotY = extent.maxY + nodeRect.height / 2;

    const plotW = Math.max(1, maxPlotX - minPlotX);
    const plotH = Math.max(1, maxPlotY - minPlotY);

    const fitPadding = 16;
    const sx = (innerW - fitPadding * 2) / plotW;
    const sy = (innerH - fitPadding * 2) / plotH;
    const s = Math.min(1, Math.max(0.3, Math.min(sx, sy)));

    const centerX = (innerW - s * (minPlotX + maxPlotX)) / 2;
    const centerY = (innerH - s * (minPlotY + maxPlotY)) / 2;

    setScale(s);
    setTx(centerX);
    setTy(centerY);
  }, [dimensions, nodes, maxDepth, extent, interacted]);

  // Pan/zoom handlers
  const minScale = 0.3;
  const maxScale = 3;
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!dimensions) return;
    e.preventDefault();
    setInteracted(true);
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    const newScale = Math.min(maxScale, Math.max(minScale, scale * factor));

    // zoom towards mouse position
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left - margin.left;
    const py = e.clientY - rect.top - margin.top;

    const dx = (px - tx) / scale;
    const dy = (py - ty) / scale;

    setScale(newScale);
    setTx(px - dx * newScale);
    setTy(py - dy * newScale);
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setInteracted(true);
    isDraggingRef.current = true;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    lastPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current || !lastPosRef.current) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - lastPosRef.current.x;
    const dy = y - lastPosRef.current.y;
    lastPosRef.current = { x, y };
    setTx((v) => v + dx);
    setTy((v) => v + dy);
  };
  const endDrag = () => {
    isDraggingRef.current = false;
    lastPosRef.current = null;
  };
  const handleDoubleClick = () => {
    setInteracted(false); // triggers auto-fit in effect
  };

  // Curved link path for smoother look
  const linkPath = (
    sx: number,
    sy: number,
    txp: number,
    typ: number,
  ) => {
    const mx = (sx + txp) / 2;
    return `M${sx},${sy} C${mx},${sy} ${mx},${typ} ${txp},${typ}`;
  };

  return (
    <Box style={{ width: "100%" }}>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>PV Lines Tree</Text>
        <Group gap="sm" align="center" style={{ minWidth: 220 }}>
          <Text size="xs" c="dimmed">Top moves:</Text>
          <Slider
            value={topN}
            onChange={setTopN}
            min={1}
            max={Math.max(1, rankedFirstUCIs.length || 1)}
            step={1}
            marks={[{ value: 1 }, { value: Math.max(1, rankedFirstUCIs.length || 1) }]}
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
        ) : filteredPVs.length === 0 || !dimensions ? (
          <Box w="100%" h="100%" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Text size="sm" c="dimmed">No engine lines yet</Text>
          </Box>
        ) : (
          <svg
            width={dimensions.width}
            height={dimensions.height}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onDoubleClick={handleDoubleClick}
            style={{ cursor: isDraggingRef.current ? "grabbing" : "grab" }}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              {(() => {
                const innerW = Math.max(0, dimensions.width - margin.left - margin.right);
                const innerH = Math.max(0, dimensions.height - margin.top - margin.bottom);
                const xStep = maxDepth > 0 ? innerW / maxDepth : innerW;

                return (
                  <g transform={`translate(${tx},${ty}) scale(${scale})`}>
                    {/* Links */}
                    {links.map((l: HierarchyPointLink<TreeNode>, i: number) => {
                      const sx = (l.source as HierarchyPointNode<TreeNode>).depth * xStep;
                      const sy = (l.source as HierarchyPointNode<TreeNode>).x;
                      const txp = (l.target as HierarchyPointNode<TreeNode>).depth * xStep;
                      const typ = (l.target as HierarchyPointNode<TreeNode>).x;
                      return (
                        <path
                          key={`link-${i}`}
                          d={linkPath(sx, sy, txp, typ)}
                          fill="none"
                          stroke="var(--mantine-color-dark-3)"
                          strokeWidth={1}
                        />
                      );
                    })}
                    {/* Nodes */}
                    {nodes.map((n: HierarchyPointNode<TreeNode>, i: number) => {
                      const nx = n.depth * xStep;
                      const ny = n.x;
                      return (
                        <g key={`node-${i}`} transform={`translate(${nx},${ny})`}>
                          <rect
                            rx={4}
                            width={nodeRect.width}
                            height={nodeRect.height}
                            x={-nodeRect.width / 2}
                            y={-nodeRect.height / 2}
                            fill="var(--mantine-color-dark-6)"
                            stroke="var(--mantine-color-dark-3)"
                          />
                          <text dy={4} textAnchor="middle" fontSize={11} fill="var(--mantine-color-gray-2)">
                            {n.data.name}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </g>
          </svg>
        )}
      </Box>
    </Box>
  );
}

export default memo(LinesTree); 