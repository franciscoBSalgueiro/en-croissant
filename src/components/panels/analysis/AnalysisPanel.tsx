import { events } from "@/bindings";
import EvalChart from "@/components/common/EvalChart";
import ProgressButton from "@/components/common/ProgressButton";
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
import {
  ANNOTATION_INFO,
  type Annotation,
  isBasicAnnotation,
} from "@/utils/annotation";
import { getGameStats, getVariationLine } from "@/utils/chess";
import { getPiecesCount, hasCaptures, positionFromFen } from "@/utils/chessops";
import type { Engine } from "@/utils/engines";
import { getNodeAtPath } from "@/utils/treeReducer";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import {
  Accordion,
  ActionIcon,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  Popover,
  ScrollArea,
  Space,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { shallowEqual } from "@mantine/hooks";
import {
  IconChevronsRight,
  IconPlayerPause,
  IconSelector,
  IconSettings,
  IconZoomCheck,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import cx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useMemo } from "react";
import React from "react";
import { useStore } from "zustand";
import { label } from "./AnalysisPanel.css";
import BestMoves, { arrowColors } from "./BestMoves";
import EngineSelection from "./EngineSelection";
import LogsPanel from "./LogsPanel";
import ScoreBubble from "./ScoreBubble";
import TablebaseInfo from "./TablebaseInfo";

function AnalysisPanel({
  tabId,
  toggleReportingMode,
  inProgress,
  setInProgress,
}: {
  tabId: string;
  toggleReportingMode: () => void;
  inProgress: boolean;
  setInProgress: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const headers = useStore(store, (s) => s.headers);
  const currentNode = getNodeAtPath(root, position);

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

  const stats = useMemo(() => getGameStats(root), [root]);
  const is960 = useMemo(() => headers.variant === "Chess960", [headers]);

  const fen = root.fen;
  const moves = useMemo(
    () => getVariationLine(root, position, is960),
    [root, position, is960],
  );
  const [pos] = positionFromFen(currentNode.fen);
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
          <Tabs.Tab value="engines">Engines</Tabs.Tab>
          <Tabs.Tab value="report">Report</Tabs.Tab>
          <Tabs.Tab value="logs" disabled={loadedEngines.length === 0}>
            Logs
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
          <>
            <ScrollArea offsetScrollbars>
              {pos &&
                (getPiecesCount(pos) <= 7 ||
                  (getPiecesCount(pos) === 8 && hasCaptures(pos))) && (
                  <>
                    <TablebaseInfo fen={currentNode.fen} turn={pos.turn} />
                    <Space h="sm" />
                  </>
                )}
              {loadedEngines.length > 1 && (
                <Paper withBorder p="xs" flex={1}>
                  <Group w="100%">
                    <Stack w="6rem" gap="xs">
                      <Text ta="center" fw="bold">
                        Summary
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
                        {allEnabled ? "Stop" : "Run"}
                      </Button>
                    </Stack>
                    <Group grow flex={1}>
                      {loadedEngines.map((engine, i) => (
                        <EngineSummary
                          key={engine.name}
                          engine={engine}
                          fen={fen}
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
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                        >
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
                                        fen={fen}
                                        moves={moves}
                                        halfMoves={currentNode.halfMoves}
                                        dragHandleProps={
                                          provided.dragHandleProps
                                        }
                                        orientation={
                                          headers.orientation || "white"
                                        }
                                        chess960={is960}
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
          </>
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
          <ScrollArea offsetScrollbars>
            <Stack mb="lg" gap="0.4rem" mr="xs">
              <Group grow style={{ textAlign: "center" }}>
                {stats.whiteAccuracy && stats.blackAccuracy && (
                  <>
                    <AccuracyCard
                      color="WHITE"
                      accuracy={stats.whiteAccuracy}
                      cpl={stats.whiteCPL}
                    />
                    <AccuracyCard
                      color="BLACK"
                      accuracy={stats.blackAccuracy}
                      cpl={stats.blackCPL}
                    />
                  </>
                )}
                <div>
                  <ProgressButton
                    id={`report_${tabId}`}
                    redoable
                    disabled={root.children.length === 0}
                    leftIcon={<IconZoomCheck size="0.875rem" />}
                    onClick={toggleReportingMode}
                    initInstalled={false}
                    progressEvent={events.reportProgress}
                    labels={{
                      action: "Generate report",
                      completed: "Report generated",
                      inProgress: "Generating report",
                    }}
                    inProgress={inProgress}
                    setInProgress={setInProgress}
                  />
                </div>
              </Group>
              <Paper withBorder p="md">
                <EvalChart
                  isAnalysing={inProgress}
                  startAnalysis={toggleReportingMode}
                />
              </Paper>
              <GameStats {...stats} />
            </Stack>
          </ScrollArea>
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

  const curEval = ev.get(`${fen}:${moves.join(",")}`);
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

type Stats = ReturnType<typeof getGameStats>;

const GameStats = memo(
  function GameStats({ whiteAnnotations, blackAnnotations }: Stats) {
    const store = useContext(TreeStateContext)!;
    const goToAnnotation = useStore(store, (s) => s.goToAnnotation);

    return (
      <Paper withBorder>
        <Grid columns={11} justify="space-between" p="md">
          {Object.keys(ANNOTATION_INFO)
            .filter((a) => isBasicAnnotation(a))
            .map((annotation) => {
              const s = annotation as "??" | "?" | "?!" | "!!" | "!" | "!?";
              const { name, color } = ANNOTATION_INFO[s];
              const w = whiteAnnotations[s];
              const b = blackAnnotations[s];
              return (
                <React.Fragment key={annotation}>
                  <Grid.Col
                    className={cx(w > 0 && label)}
                    span={4}
                    style={{ textAlign: "center" }}
                    c={w > 0 ? color : undefined}
                    onClick={() => {
                      if (w > 0) {
                        goToAnnotation(s, "white");
                      }
                    }}
                  >
                    {w}
                  </Grid.Col>
                  <Grid.Col span={1} c={w + b > 0 ? color : undefined}>
                    {annotation}
                  </Grid.Col>
                  <Grid.Col span={4} c={w + b > 0 ? color : undefined}>
                    {name}
                  </Grid.Col>
                  <Grid.Col
                    className={cx(b > 0 && label)}
                    span={2}
                    c={b > 0 ? color : undefined}
                    onClick={() => {
                      if (b > 0) {
                        goToAnnotation(s, "black");
                      }
                    }}
                  >
                    {b}
                  </Grid.Col>
                </React.Fragment>
              );
            })}
        </Grid>
      </Paper>
    );
  },
  (prev, next) => {
    return (
      shallowEqual(prev.whiteAnnotations, next.whiteAnnotations) &&
      shallowEqual(prev.blackAnnotations, next.blackAnnotations)
    );
  },
);

function AccuracyCard({
  color,
  cpl,
  accuracy,
}: {
  color: string;
  cpl: number;
  accuracy: number;
}) {
  return (
    <Paper withBorder p="xs">
      <Group justify="space-between">
        <Stack gap={0} align="start">
          <Text c="dimmed">{color}</Text>
          <Text fz="sm">{cpl.toFixed(1)} ACPL</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fz="xl" lh="normal">
            {accuracy.toFixed(1)}%
          </Text>
          <Text fz="sm" c="dimmed" lh="normal">
            Accuracy
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

export default memo(AnalysisPanel);
