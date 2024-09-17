import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  allEnabledAtom,
  currentAnalysisTabAtom,
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
import BestMoves, { arrowColors } from "./BestMoves";
import EngineSelection from "./EngineSelection";
import LogsPanel from "./LogsPanel";
import ReportPanel from "./ReportPanel";
import ScoreBubble from "./ScoreBubble";
import TablebaseInfo from "./TablebaseInfo";

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

  const [tab, setTab] = useAtom(currentAnalysisTabAtom);
  const [expanded, setExpanded] = useAtom(currentExpandedEnginesAtom);

  const [pos] = positionFromFen(currentNodeFen);
  const navigate = useNavigate();

  return (
    <Stack h="100%">
      <Tabs
        h="100%"
        orientation="vertical"
        placement="right"
        value={tab}
        onChange={(v) => setTab(v!)}
        style={{
          display: "flex",
        }}
        keepMounted={false}
      >
        <Tabs.List>
          <Tabs.Tab value="engines">{t("Board.Analysis.Engines")}</Tabs.Tab>
          <Tabs.Tab value="report">{t("Board.Analysis.Report")}</Tabs.Tab>
          <Tabs.Tab value="logs" disabled={loadedEngines.length === 0}>
            {t("Board.Analysis.Logs")}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel
          value="engines"
          style={{
            overflow: "hidden",
            display: tab === "engines" ? "flex" : "none",
            flexDirection: "column",
          }}
        >
          <ScrollArea
            offsetScrollbars
            onScrollPositionChange={() =>
              document.dispatchEvent(new Event("analysis-panel-scroll"))
            }
          >
            {pos &&
              (getPiecesCount(pos) <= 7 ||
                (getPiecesCount(pos) === 8 && hasCaptures(pos))) && (
                <>
                  <TablebaseInfo fen={currentNodeFen} turn={pos.turn} />
                  <Space h="sm" />
                </>
              )}
            {loadedEngines.length > 1 && (
              <Paper withBorder p="xs" flex={1}>
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
            <Stack mt="sm">
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
                    setEngines(async (prev) => {
                      const result = Array.from(await prev);
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
                <Popover width={250} position="top-end" shadow="md">
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
        </Tabs.Panel>
        <Tabs.Panel
          value="report"
          pt="xs"
          style={{
            overflow: "hidden",
            display: tab === "report" ? "flex" : "none",
            flexDirection: "column",
          }}
        >
          <ReportPanel />
        </Tabs.Panel>
        <Tabs.Panel
          value="logs"
          pt="xs"
          style={{
            overflow: "hidden",
            display: tab === "logs" ? "flex" : "none",
            flexDirection: "column",
          }}
        >
          <LogsPanel />
        </Tabs.Panel>
      </Tabs>
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
        {score ? (
          <ScoreBubble size="sm" score={score} />
        ) : (
          <Text fz="sm" c="dimmed">
            ???
          </Text>
        )}
      </Stack>
    </Card>
  );
}

export default memo(AnalysisPanel);
