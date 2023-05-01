import {
  Accordion,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { IconRobot, IconZoomCheck } from "@tabler/icons-react";
import { memo, useContext } from "react";
import {
  Annotation,
  Score,
  VariationTree,
  getAccuracyFromCp,
} from "../../../utils/chess";
import { CompleteGame } from "../../../utils/db";
import { Engine } from "../../../utils/engines";
import GameContext from "../../common/GameContext";
import { ProgressButton } from "../../common/ProgressButton";
import BestMoves from "./BestMoves";
import EngineSelection from "./EngineSelection";

function AnalysisPanel({
  boardSize,
  engines,
  id,
  makeMoves,
  setArrows,
  setCompleteGame,
  setEngines,
  changeToPlayMode,
  toggleReportingMode,
  inProgress,
  setInProgress,
}: {
  boardSize: number;
  engines: Engine[];
  id: string;
  makeMoves: (moves: string[]) => void;
  setArrows: (arrows: string[]) => void;
  setCompleteGame: React.Dispatch<React.SetStateAction<CompleteGame>>;
  setEngines: React.Dispatch<React.SetStateAction<Engine[]>>;
  changeToPlayMode: () => void;
  toggleReportingMode: () => void;
  inProgress: boolean;
  setInProgress: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const tree = useContext(GameContext).game.tree;
  /* get through the main line and get the average centipawn loss for each player*/
  const getGameStats = (tree: VariationTree) => {
    let whiteCPSum = 0;
    let whiteAccuracy = 0;
    let whiteCount = 0;
    let blackCPSum = 0;
    let blackAccuracy = 0;
    let blackCount = 0;

    let whiteAnnotations = {
      [Annotation.Blunder]: 0,
      [Annotation.Mistake]: 0,
      [Annotation.Dubious]: 0,
      [Annotation.Brilliant]: 0,
      [Annotation.Good]: 0,
      [Annotation.Interesting]: 0,
    };

    let blackAnnotations = {
      [Annotation.Blunder]: 0,
      [Annotation.Mistake]: 0,
      [Annotation.Dubious]: 0,
      [Annotation.Brilliant]: 0,
      [Annotation.Good]: 0,
      [Annotation.Interesting]: 0,
    };

    let current = tree.getTopVariation();
    if (current.children.length === 0) {
      return {
        whiteCPL: 0,
        blackCPL: 0,
        whiteAccuracy,
        blackAccuracy,
        whiteAnnotations,
        blackAnnotations,
      };
    }
    let prevScore: Score = current.score ?? { type: "cp", value: 30 };
    while (current.children.length > 0) {
      current = current.children[0];
      if (current.annotation) {
        if (current.halfMoves % 2 === 1) {
          whiteAnnotations[current.annotation]++;
        } else {
          blackAnnotations[current.annotation]++;
        }
      }
      if (current.score && current.score.type === "cp") {
        if (current.halfMoves % 2 === 1) {
          whiteCPSum += Math.max(prevScore.value - current.score.value, 0);
          whiteAccuracy += getAccuracyFromCp(
            prevScore?.value,
            current.score.value
          );
          whiteCount++;
        } else {
          blackCPSum += Math.max(-(prevScore?.value - current.score.value), 0);
          blackAccuracy += getAccuracyFromCp(
            -prevScore?.value,
            -current.score.value
          );
          blackCount++;
        }
        prevScore = current.score;
      }
    }

    return {
      whiteCPL: whiteCPSum / whiteCount,
      blackCPL: blackCPSum / blackCount,
      whiteAccuracy: whiteAccuracy / whiteCount,
      blackAccuracy: blackAccuracy / blackCount,
      whiteAnnotations,
      blackAnnotations,
    };
  };
  const {
    whiteCPL,
    blackCPL,
    whiteAccuracy,
    blackAccuracy,
    whiteAnnotations,
    blackAnnotations,
  } = getGameStats(tree);

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
                        id={i}
                        tab={id}
                        engine={engine}
                        makeMoves={makeMoves}
                        setArrows={setArrows}
                        setCompleteGame={setCompleteGame}
                      />
                    </Accordion.Item>
                  );
                })}
            </Accordion>
            <EngineSelection engines={engines} setEngines={setEngines} />
            <Group grow>
              <Button
                variant="default"
                leftIcon={<IconRobot size={14} />}
                onClick={() => changeToPlayMode()}
              >
                Play against engine
              </Button>
            </Group>
          </Stack>
        </ScrollArea>
      </Tabs.Panel>
      <Tabs.Panel value="report" pt="xs">
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
        <ProgressButton
          id={0}
          redoable
          disabled={tree.getTopVariation().children.length === 0}
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
      </Tabs.Panel>
    </Tabs>
  );
}

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
