import { memo, useContext, useMemo, useState } from "react";
import { Box, Group, Paper, Progress, Text, Tabs } from "@mantine/core";
import UnifiedMovesTable from "./UnifiedMovesTable";
import LinesTree from "./LinesTree";
import GameNotation from "@/components/common/GameNotation";
import { useAtomValue } from "jotai";
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

function AnalysisBar({ height = 380 }: { height?: number | string }) {
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
  const rootFen = useStore(store, (s) => s.root.fen);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );
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


