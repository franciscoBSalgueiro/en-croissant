import {
  Accordion,
  Box,
  Button,
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
import BestMoves from "./BestMoves";
import EngineSelection from "./EngineSelection";
import React from "react";
import {
  allEnabledAtom,
  currentAnalysisTabAtom,
  enableAllAtom,
  enginesAtom,
} from "@/atoms/atoms";
import { useAtom, useAtomValue } from "jotai";
import LogsPanel from "./LogsPanel";
import EvalChart from "@/components/common/EvalChart";

function AnalysisPanel({
  boardSize,
  setArrows,
  toggleReportingMode,
  inProgress,
  setInProgress,
}: {
  boardSize: number;
  setArrows: (arrows: string[]) => void;
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
    <Tabs
      defaultValue="engines"
      orientation="vertical"
      placement="right"
      value={tab}
      onTabChange={(v) => setTab(v!)}
    >
      <Tabs.List>
        <Tabs.Tab value="engines">Engines</Tabs.Tab>
        <Tabs.Tab value="report">Report</Tabs.Tab>
        <Tabs.Tab value="logs" disabled={loadedEngines.length == 0}>
          Logs
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="engines" pt="xs">
        <ScrollArea sx={{ height: boardSize / 2 }} offsetScrollbars>
          {loadedEngines.length > 0 && (
            <Group>
              <Button
                rightIcon={
                  allEnabled ? <IconPlayerPause /> : <IconChevronsRight />
                }
                variant={allEnabled ? "filled" : "default"}
                onClick={() => enable(!allEnabled)}
              >
                {allEnabled ? "Stop All" : "Run All"}
              </Button>
            </Group>
          )}
          <Stack mt="sm">
            <Accordion
              variant="separated"
              multiple
              chevronSize={0}
              defaultValue={loadedEngines.map((e) => e.path)}
            >
              {loadedEngines.map((engine, i) => {
                return (
                  <Accordion.Item key={engine.path} value={engine.path}>
                    <BestMoves
                      id={i}
                      engine={engine}
                      setArrows={setArrows}
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
      </Tabs.Panel>
      <Tabs.Panel value="report" pt="xs">
        <ScrollArea sx={{ height: boardSize / 2 }} offsetScrollbars>
          <Stack mb="lg" spacing="0.4rem" mr="xs">
            <Group grow sx={{ textAlign: "center" }}>
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
                  leftIcon={<IconZoomCheck size={14} />}
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
      <Tabs.Panel value="logs" pt="xs">
        <Stack>
          <LogsPanel />
        </Stack>
      </Tabs.Panel>
    </Tabs>
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
                    sx={{ textAlign: "center" }}
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
      <Group position="apart">
        <Stack spacing={0} align="start">
          <Text color="dimmed">{color}</Text>
          <Text fz="sm">{cpl.toFixed(1)} ACPL</Text>
        </Stack>
        <Stack spacing={0} align="center">
          <Text fz="xl" lh="normal">
            {accuracy.toFixed(1)}%
          </Text>
          <Text fz="sm" color="dimmed" lh="normal">
            Accuracy
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

export default memo(AnalysisPanel);
