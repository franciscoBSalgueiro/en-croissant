import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  allEnabledAtom,
  currentExpandedEnginesAtom,
  enableAllAtom,
  engineMovesFamily,
  enginesAtom,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { getPiecesCount, hasCaptures, positionFromFen } from "@/utils/chessops";
import type { Engine } from "@/utils/engines";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import {
  Accordion,
  ActionIcon,
  Button,
  Card,
  Group,
  Paper,
  Popover,
  ScrollArea,
  Space,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import {
  IconChevronsRight,
  IconPlayerPause,
  IconSelector,
  IconSettings,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useDeferredValue, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { atomWithStorage } from "jotai/utils";
import BestMoves, { arrowColors } from "./BestMoves";
import EngineSelection from "./EngineSelection";
import LastMoveScore from "./LastMoveScore";
import LogsPanel from "./LogsPanel";
import ReportPanel from "./ReportPanel";
import ScoreBubble from "./ScoreBubble";
import TablebaseInfo from "./TablebaseInfo";
import UnifiedMovesTable from "./UnifiedMovesTable";

import "react-mosaic-component/react-mosaic-component.css";
import "@/styles/react-mosaic.css";

// Analysis panel mosaic layout
type AnalysisViewId = "engines" | "moves" | "report" | "logs";

interface AnalysisMosaicState {
  currentNode: MosaicNode<AnalysisViewId> | null;
}

const analysisMosaicStateAtom = atomWithStorage<AnalysisMosaicState>("analysisMosaicState", {
  currentNode: {
    direction: "column",
    first: "engines",
    second: {
      direction: "column", 
      first: "moves",
      second: {
        direction: "column",
        first: "report",
        second: "logs",
      },
    },
  },
});

// Provide a fallback layout in case the stored mosaic state is empty or null
const defaultAnalysisLayout: MosaicNode<AnalysisViewId> = {
  direction: "column",
  first: "engines",
  second: {
    direction: "column",
    first: "moves",
    second: {
      direction: "column",
      first: "report",
      second: "logs",
    },
  },
};

function AnalysisPanel() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const rootFen = useStore(store, (s) => s.root.fen);
  const headers = useStore(store, (s) => s.headers);
  const currentNodeFen = useStore(
    store,
    useShallow((s) => s.currentNode().fen),
  );
  const is960 = useMemo(() => headers.variant === "Chess960", [headers]);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );
  const currentNodeHalfMoves = useStore(
    store,
    useShallow((s) => s.currentNode().halfMoves),
  );

  const [engines, setEngines] = useAtom(enginesAtom);
  const loadedEngines = useMemo(
    () => engines.filter((e) => e.loaded),
    [engines],
  );

  const [, enable] = useAtom(enableAllAtom);
  const allEnabledLoader = useAtomValue(allEnabledAtom);
  const allEnabled =
    allEnabledLoader.state === "hasData" && allEnabledLoader.data;

  const [expanded, setExpanded] = useAtom(currentExpandedEnginesAtom);
  const [mosaicState, setMosaicState] = useAtom(analysisMosaicStateAtom);

  // Ensure we always have a valid layout to display
  const currentNode = mosaicState.currentNode ?? defaultAnalysisLayout;

  const [pos] = positionFromFen(currentNodeFen);
  const navigate = useNavigate();

  // Define the analysis panel components
  const analysisLayout: { [viewId in AnalysisViewId]: JSX.Element } = {
    engines: (
      <Paper withBorder p="xs" h="100%">
        <ScrollArea h="100%" offsetScrollbars>
          <Stack gap="sm">
            {pos &&
              (getPiecesCount(pos) <= 7 ||
                (getPiecesCount(pos) === 8 && hasCaptures(pos))) && (
                <>
                  <TablebaseInfo fen={currentNodeFen} turn={pos.turn} />
                </>
              )}
            {loadedEngines.length > 1 && (
              <Paper withBorder p="xs">
                <Group w="100%">
                  <Stack w="6rem" gap="xs">
                    <Text ta="center" fw="bold">
                      {t("Board.Analysis.Summary")}
                    </Text>
                    <Button
                      rightSection={
                        allEnabled ? (
                          <IconPlayerPause size="1.2rem" />
                        ) : (
                          <IconChevronsRight size="1.2rem" />
                        )
                      }
                      variant={allEnabled ? "filled" : "default"}
                      onClick={() => enable(!allEnabled)}
                    >
                      {allEnabled ? t("Common.Stop") : t("Common.Run")}
                    </Button>
                  </Stack>
                  <Group grow flex={1}>
                    {loadedEngines.map((engine, i) => (
                      <EngineSummary
                        key={engine.name}
                        engine={engine}
                        fen={rootFen}
                        moves={moves}
                        i={i}
                      />
                    ))}
                  </Group>
                </Group>
              </Paper>
            )}
            <Accordion
              variant="separated"
              multiple
              chevronSize={0}
              defaultValue={loadedEngines.map((e) => e.name)}
              value={expanded}
              onChange={(v) => setExpanded(v)}
              styles={{
                label: {
                  paddingTop: 0,
                  paddingBottom: 0,
                },
                content: {
                  padding: "0.3rem",
                },
              }}
            >
              <DragDropContext
                onDragEnd={({ destination, source }) =>
                  destination?.index !== undefined &&
                  setEngines((prev) => {
                    const result = Array.from(prev);
                    const prevLoaded = result.filter((e) => e.loaded);
                    const [removed] = prevLoaded.splice(source.index, 1);
                    prevLoaded.splice(destination.index, 0, removed);

                    result.forEach((e, i) => {
                      if (e.loaded) {
                        result[i] = prevLoaded.shift()!;
                      }
                    });
                    return result;
                  })
                }
              >
                <Droppable droppableId="droppable" direction="vertical">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      <Stack w="100%">
                        {loadedEngines.map((engine, i) => (
                          <Draggable
                            key={engine.name + i.toString()}
                            draggableId={engine.name}
                            index={i}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                              >
                                <Accordion.Item value={engine.name}>
                                  <BestMoves
                                    id={i}
                                    engine={engine}
                                    fen={rootFen}
                                    moves={moves}
                                    halfMoves={currentNodeHalfMoves}
                                    dragHandleProps={provided.dragHandleProps}
                                    orientation={
                                      headers.orientation || "white"
                                    }
                                  />
                                </Accordion.Item>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </Stack>

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </Accordion>
            <Group gap="xs">
              <Button
                flex={1}
                variant="default"
                onClick={() => {
                  navigate({ to: "/engines" });
                }}
                leftSection={<IconSettings size="0.875rem" />}
              >
                Manage Engines
              </Button>
                              <Popover width={250} position="top-end" shadow="md" withinPortal>
                <Popover.Target>
                  <ActionIcon variant="default" size="lg">
                    <IconSelector />
                  </ActionIcon>
                </Popover.Target>

                <Popover.Dropdown>
                  <EngineSelection />
                </Popover.Dropdown>
              </Popover>
            </Group>
          </Stack>
        </ScrollArea>
      </Paper>
    ),
    moves: (
      <Paper withBorder p="xs" h="100%">
        <UnifiedMovesTable />
      </Paper>
    ),
    report: (
      <Paper withBorder p="xs" h="100%">
        <ScrollArea h="100%">
          <ReportPanel />
        </ScrollArea>
      </Paper>
    ),
    logs: (
      <Paper withBorder p="xs" h="100%">
        <ScrollArea h="100%">
          <LogsPanel />
        </ScrollArea>
      </Paper>
    ),
  };

  return (
    <Stack h="100%">
      <Mosaic<AnalysisViewId>
        renderTile={(id) => analysisLayout[id]}
        value={currentNode}
        onChange={(currentNode) => setMosaicState({ currentNode })}
                 resize={{ minimumPaneSizePercentage: 10 }}
       />
     </Stack>
   );
}

function EngineSummary({
  engine,
  fen,
  moves,
  i,
}: {
  engine: Engine;
  fen: string;
  moves: string[];
  i: number;
}) {
  const activeTab = useAtomValue(activeTabAtom);
  const [ev] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! }),
  );

  const curEval = useDeferredValue(
    useMemo(() => ev.get(`${fen}:${moves.join(",")}`), [ev, fen, moves]),
  );
  const score = curEval && curEval.length > 0 ? curEval[0].score : null;

  return (
    <Card withBorder c={arrowColors[i]?.strong} p="xs">
      <Stack gap="xs" align="center">
        <Text
          fw="bold"
          fz="xs"
          style={{ textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {engine.name}
        </Text>
        <Group>
          {score ? (
            <ScoreBubble size="sm" score={score} />
          ) : (
            <Text fz="sm" c="dimmed">
              ???
            </Text>
          )}
          <LastMoveScore />
        </Group>
      </Stack>
    </Card>
  );
}

export default memo(AnalysisPanel);
