import { memo, useState } from "react";
import { Box, Paper } from "@mantine/core";
import UnifiedMovesTable from "./UnifiedMovesTable";
import LinesTree from "./LinesTree";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import "@/styles/react-mosaic.css";

function AnalysisBar({ height = 380 }: { height?: number | string }) {
  type AnalysisBarViewId = "linesTree" | "unifiedMoves";

  const DEFAULT_LAYOUT: MosaicNode<AnalysisBarViewId> = {
    direction: "row",
    first: "linesTree",
    second: "unifiedMoves",
  };

  const [layout, setLayout] = useState<MosaicNode<AnalysisBarViewId> | null>(
    DEFAULT_LAYOUT,
  );

  return (
    <Paper
      withBorder
      p="xs"
      h={height}
      style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
    >
      <Box style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Mosaic<AnalysisBarViewId>
          renderTile={(id) => (
            id === "linesTree" ? (
              <Box style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
                <LinesTree />
              </Box>
            ) : (
              <Box style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
                <UnifiedMovesTable />
              </Box>
            )
          )}
          value={layout}
          onChange={(currentNode) => setLayout(currentNode)}
          resize={{ minimumPaneSizePercentage: 10 }}
        />
      </Box>
    </Paper>
  );
}

export default memo(AnalysisBar);


