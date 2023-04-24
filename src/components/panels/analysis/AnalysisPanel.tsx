import {
  Accordion,
  Button,
  Group,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { IconRobot, IconZoomCheck } from "@tabler/icons-react";
import { useContext } from "react";
import { Annotation, VariationTree } from "../../../utils/chess";
import { CompleteGame } from "../../../utils/db";
import { Engine } from "../../../utils/engines";
import GameContext from "../../common/GameContext";
import { ProgressButton } from "../../common/ProgressButton";
import BestMoves from "./BestMoves";
import EngineSettingsBoard from "./EngineSettingsBoard";

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
    let whiteSum = 0;
    let whiteCount = 0;
    let blackSum = 0;
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
      return { white: 0, black: 0, whiteAnnotations, blackAnnotations };
    }
    let prevScore = current.score ?? { cp: 30 };
    while (current.children.length > 0) {
      current = current.children[0];
      if (current.annotation) {
        if (current.halfMoves % 2 === 1) {
          whiteAnnotations[current.annotation]++;
        } else {
          blackAnnotations[current.annotation]++;
        }
      }
      if (current.score && current.score.cp) {
        if (current.halfMoves % 2 === 1) {
          whiteSum += Math.max(prevScore?.cp - current.score.cp, 0);
          whiteCount++;
        } else {
          blackSum += Math.max(-(prevScore?.cp - current.score.cp), 0);
          blackCount++;
        }
        prevScore = current.score;
      }
    }

    return {
      white: whiteSum / whiteCount,
      black: blackSum / blackCount,
      whiteAnnotations,
      blackAnnotations,
    };
  };
  const { white, black, whiteAnnotations, blackAnnotations } =
    getGameStats(tree);

  return (
    <Tabs defaultValue="engines">
      <Tabs.List>
        <Tabs.Tab value="engines">Engines</Tabs.Tab>
        <Tabs.Tab value="report">Report</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="engines" pt="xs">
        <ScrollArea
          sx={{ height: boardSize / 2 }}
          offsetScrollbars
          type="always"
        >
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
            <EngineSettingsBoard engines={engines} setEngines={setEngines} />
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
        <Stack mb="lg">
          <Group grow sx={{ textAlign: "center" }}>
            <div>{white.toFixed(1)}</div>
            <div>{black.toFixed(1)}</div>
          </Group>
          <Group grow sx={{ textAlign: "center" }}>
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

export default AnalysisPanel;
