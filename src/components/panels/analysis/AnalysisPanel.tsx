import {
  Accordion,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { shallowEqual } from "@mantine/hooks";
import { IconZoomCheck } from "@tabler/icons-react";
import { memo, useContext } from "react";
import { getGameStats } from "../../../utils/chess";
import { Engine } from "../../../utils/engines";
import { useLocalFile } from "../../../utils/misc";
import { getNodeAtPath } from "../../../utils/treeReducer";
import ProgressButton from "../../common/ProgressButton";
import { TreeStateContext } from "../../common/TreeStateContext";
import BestMoves from "./BestMoves";
import EngineSelection from "./EngineSelection";

const labels = {
  action: "Generate report",
  completed: "Report generated",
  inProgress: "Generating report",
};
const icon = <IconZoomCheck size={14} />;

function AnalysisPanel({
  boardSize,
  id,
  setArrows,
  toggleReportingMode,
  inProgress,
  setInProgress,
}: {
  boardSize: number;
  id: string;
  setArrows: (arrows: string[]) => void;
  toggleReportingMode: () => void;
  inProgress: boolean;
  setInProgress: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { root, position } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);
  if (!currentNode) {
    return <></>;
  }

  const [engines, setEngines] = useLocalFile<Engine[]>(
    "engines/engines.json",
    []
  );

  return (
    <Tabs defaultValue="engines" orientation="vertical" placement="right">
      <Tabs.List>
        <Tabs.Tab value="engines">Engines</Tabs.Tab>
        <Tabs.Tab value="report">Report</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="engines" pt="xs">
        <ScrollArea sx={{ height: boardSize / 2 }} offsetScrollbars>
          <Stack>
            <Accordion
              variant="separated"
              multiple
              chevronSize={0}
              defaultValue={engines.map((e) => e.path)}
            >
              {engines
                .filter((e) => e.loaded)
                .map((engine, i) => {
                  return (
                    <Accordion.Item key={engine.path} value={engine.path}>
                      <BestMoves
                        tabId={id}
                        id={i}
                        tab={id}
                        engine={engine}
                        setArrows={setArrows}
                        fen={currentNode.fen}
                        halfMoves={currentNode.halfMoves}
                      />
                    </Accordion.Item>
                  );
                })}
            </Accordion>
            <EngineSelection engines={engines} setEngines={setEngines} />
          </Stack>
        </ScrollArea>
      </Tabs.Panel>
      <Tabs.Panel value="report" pt="xs">
        <GameStats {...getGameStats(root)} />
        <ProgressButton
          id={0}
          redoable
          disabled={root.children.length === 0}
          leftIcon={icon}
          onClick={toggleReportingMode}
          initInstalled={false}
          progressEvent="report_progress"
          labels={labels}
          inProgress={inProgress}
          setInProgress={setInProgress}
        />
      </Tabs.Panel>
    </Tabs>
  );
}

type GameStats = ReturnType<typeof getGameStats>;

const GameStats = memo(
  ({
    whiteCPL,
    blackCPL,
    whiteAccuracy,
    blackAccuracy,
    whiteAnnotations,
    blackAnnotations,
  }: GameStats) => (
    <Stack mb="lg" spacing="0.4rem" mr="xs">
      <Group grow sx={{ textAlign: "center" }}>
        {whiteAccuracy && blackAccuracy && (
          <>
            <AccuracyCard
              color="WHITE"
              accuracy={whiteAccuracy}
              cpl={whiteCPL}
            />
            <AccuracyCard
              color="BLACK"
              accuracy={blackAccuracy}
              cpl={blackCPL}
            />
          </>
        )}
      </Group>
      <Group grow sx={{ textAlign: "center" }} mt="xs">
        <div>{whiteAnnotations["!!"]}</div>
        <Text>Brilliant</Text>
        <div> {blackAnnotations["!!"]}</div>
      </Group>
      <Group grow sx={{ textAlign: "center" }}>
        <div>{whiteAnnotations["!"]}</div>
        <Text>Good</Text>
        <div> {blackAnnotations["!"]}</div>
      </Group>
      <Group grow sx={{ textAlign: "center" }}>
        <div>{whiteAnnotations["!?"]}</div>
        <Text>Interesting</Text>
        <div> {blackAnnotations["!?"]}</div>
      </Group>
      <Group grow sx={{ textAlign: "center" }}>
        <div>{whiteAnnotations["?!"]}</div>
        <Text>Dubious</Text>
        <div> {blackAnnotations["?!"]}</div>
      </Group>
      <Group grow sx={{ textAlign: "center" }}>
        <div>{whiteAnnotations["?"]}</div>
        <Text>Mistake</Text>
        <div> {blackAnnotations["?"]}</div>
      </Group>
      <Group grow sx={{ textAlign: "center" }}>
        <div>{whiteAnnotations["??"]}</div>
        <Text>Blunder</Text>
        <div> {blackAnnotations["??"]}</div>
      </Group>
    </Stack>
  ),
  (prev, next) => {
    return (
      prev.whiteCPL === next.whiteCPL &&
      prev.blackCPL === next.blackCPL &&
      prev.whiteAccuracy === next.whiteAccuracy &&
      prev.blackAccuracy === next.blackAccuracy &&
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
