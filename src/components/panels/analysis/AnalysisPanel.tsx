import {
  Accordion,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { shallowEqual } from "@mantine/hooks";
import {
  IconChevronsRight,
  IconPlayerPause,
  IconZoomCheck,
} from "@tabler/icons-react";
import { memo, useContext, useMemo } from "react";
import { ANNOTATION_INFO, getGameStats } from "@/utils/chess";
import { getNodeAtPath } from "@/utils/treeReducer";
import ProgressButton from "@/components/common/ProgressButton";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import BestMoves, { arrowColors } from "./BestMoves";
import EngineSelection from "./EngineSelection";
import React from "react";
import {
  activeTabAtom,
  allEnabledAtom,
  currentAnalysisTabAtom,
  enableAllAtom,
  engineMovesFamily,
  enginesAtom,
} from "@/atoms/atoms";
import { useAtom, useAtomValue } from "jotai";
import LogsPanel from "./LogsPanel";
import EvalChart from "@/components/common/EvalChart";
import ScoreBubble from "./ScoreBubble";
import { Engine } from "@/utils/engines";

function AnalysisPanel({
  toggleReportingMode,
  inProgress,
  setInProgress,
}: {
  toggleReportingMode: () => void;
  inProgress: boolean;
  setInProgress: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { root, position } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);

  const engines = useAtomValue(enginesAtom);
  const loadedEngines = useMemo(
    () => engines.filter((e) => e.loaded),
    [engines]
  );

  const [, enable] = useAtom(enableAllAtom);
  const allEnabledLoader = useAtomValue(allEnabledAtom);
  const allEnabled =
    allEnabledLoader.state === "hasData" && allEnabledLoader.data;

  const [tab, setTab] = useAtom(currentAnalysisTabAtom);

  const stats = useMemo(() => getGameStats(root), [root]);

  return (
    <Stack h="100%">
      <Tabs
        h="100%"
        defaultValue="engines"
        orientation="vertical"
        placement="right"
        value={tab}
        onChange={(v) => setTab(v!)}
        style={{
          display: "flex",
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="engines">Engines</Tabs.Tab>
          <Tabs.Tab value="report">Report</Tabs.Tab>
          <Tabs.Tab value="logs" disabled={loadedEngines.length == 0}>
            Logs
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel
          value="engines"
          pt="xs"
          style={{
            overflow: "hidden",
            display: tab === "engines" ? "flex" : "none",
            flexDirection: "column",
          }}
        >
          <>
            <ScrollArea offsetScrollbars>
              {loadedEngines.length > 1 && (
                <Paper withBorder p="xs" style={{ flex: 1 }}>
                  <Group w="100%">
                    <Stack w="8rem">
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
                    <Group grow style={{ flex: 1 }}>
                      {loadedEngines.map((engine, i) => (
                        <EngineSummary
                          key={engine.name}
                          engine={engine}
                          fen={currentNode.fen}
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
                  {loadedEngines.map((engine, i) => {
                    return (
                      <Accordion.Item key={engine.name} value={engine.name}>
                        <BestMoves
                          id={i}
                          engine={engine}
                          fen={currentNode.fen}
                          halfMoves={currentNode.halfMoves}
                        />
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
                <EngineSelection />
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
                <Box w={100}>
                  <ProgressButton
                    id={0}
                    redoable
                    disabled={root.children.length === 0}
                    leftIcon={<IconZoomCheck size="0.875rem" />}
                    onClick={() => toggleReportingMode()}
                    initInstalled={false}
                    progressEvent="report_progress"
                    labels={{
                      action: "Generate report",
                      completed: "Report generated",
                      inProgress: "Generating report",
                    }}
                    inProgress={inProgress}
                    setInProgress={setInProgress}
                  />
                </Box>
              </Group>
              <Paper withBorder p="md">
                <EvalChart
                  isAnalysing={inProgress}
                  startAnalysis={() => toggleReportingMode()}
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
  i,
}: {
  engine: Engine;
  fen: string;
  i: number;
}) {
  const activeTab = useAtomValue(activeTabAtom);
  const [ev] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! })
  );

  const curEval = ev.get(fen);
  const score = curEval ? curEval[0].score : null;

  return (
    <Card withBorder c={arrowColors[i].strong}>
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
    return (
      <Paper withBorder>
        <Grid columns={11} justify="space-between" p="md">
          {Object.keys(ANNOTATION_INFO)
            .filter((a) => a !== "")
            .map((annotation) => {
              const s = annotation as "??" | "?" | "?!" | "!!" | "!" | "!?";
              const { name, color } = ANNOTATION_INFO[s];
              const w = whiteAnnotations[s];
              const b = blackAnnotations[s];
              return (
                <React.Fragment key={annotation}>
                  <Grid.Col
                    span={4}
                    style={{ textAlign: "center" }}
                    c={w > 0 ? color : undefined}
                  >
                    {w}
                  </Grid.Col>
                  <Grid.Col span={1} c={w + b > 0 ? color : undefined}>
                    {annotation}
                  </Grid.Col>
                  <Grid.Col span={4} c={w + b > 0 ? color : undefined}>
                    {name}
                  </Grid.Col>
                  <Grid.Col span={2} c={b > 0 ? color : undefined}>
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
  }
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
