import { memo, useState } from "react";
import { Box, Paper, Tabs } from "@mantine/core";
import UnifiedMovesTable from "./UnifiedMovesTable";
import LinesTree from "./LinesTree";
import GameNotation from "@/components/common/GameNotation";

function AnalysisBar({ height = 380 }: { height?: number | string }) {
  const [activeTab, setActiveTab] = useState<string | null>("linesTree");

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
          <Tabs.Tab value="linesTree">Lines Tree</Tabs.Tab>
          <Tabs.Tab value="unifiedMoves">Unified Moves</Tabs.Tab>
          <Tabs.Tab value="notation">Notation</Tabs.Tab>
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
    </Paper>
  );
}

export default memo(AnalysisBar);


