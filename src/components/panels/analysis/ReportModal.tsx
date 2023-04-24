import {
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { Chess } from "chess.js";
import { useContext, useEffect, useState } from "react";
import {
  Annotation,
  BestMoves,
  Score,
  VariationTree,
  goToPosition,
} from "../../../utils/chess";
import { DatabaseInfo, getDatabases } from "../../../utils/db";
import { Engine, getEngines } from "../../../utils/engines";
import { formatDuration } from "../../../utils/format";
import { invoke } from "../../../utils/misc";
import GameContext from "../../common/GameContext";

function ReportModal({
  moves,
  reportingMode,
  toggleReportingMode,
  setTree,
  setInProgress,
}: {
  moves: string;
  reportingMode: boolean;
  toggleReportingMode: () => void;
  setTree: (tree: VariationTree) => void;
  setInProgress: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const tree = useContext(GameContext).game.tree;
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);

  const chess = new Chess();
  let uciMoves: string[] = [];
  try {
    chess.loadPgn(moves);
    uciMoves = chess.history();
  } catch (e) {
    console.error(e);
  }

  const form = useForm({
    initialValues: {
      engine: "",
      millisecondsPerMove: 500,
      skipAnalyzingTheory: true,
    },

    validate: {
      engine: (value) => {
        if (!value) return "Engine is required";
      },
      millisecondsPerMove: (value) => {
        if (!value) return "Seconds per move is required";
      },
    },
  });

  useEffect(() => {
    getDatabases().then((dbs) => {
      setDatabases(dbs);
    });
    getEngines().then((engines) => {
      setEngines(engines);
    });
  }, []);

  function analyze() {
    function getAnnotation(
      prevScore: Score,
      curScore: Score,
      isWhite: boolean
    ): Annotation {
      if (prevScore.cp !== undefined && curScore.mate) {
        return Annotation.Blunder;
      }
      if (isWhite) {
        if (prevScore.cp - curScore.cp > 300) {
          return Annotation.Blunder;
        }
        if (prevScore.cp - curScore.cp > 100) {
          return Annotation.Mistake;
        }
        if (prevScore.cp - curScore.cp > 50) {
          return Annotation.Dubious;
        }
      } else {
        if (prevScore.cp - curScore.cp < -300) {
          return Annotation.Blunder;
        }
        if (prevScore.cp - curScore.cp < -100) {
          return Annotation.Mistake;
        }
        if (prevScore.cp - curScore.cp < -50) {
          return Annotation.Dubious;
        }
      }

      return Annotation.None;
    }

    setInProgress(true);
    toggleReportingMode();
    invoke("analyze_game", {
      moves: uciMoves.join(" "),
      engine: form.values.engine,
      moveTime: form.values.millisecondsPerMove,
    }).then((result) => {
      const evals = result as BestMoves[];

      let position = tree.getPosition();
      let root = tree.getTopVariation().children[0];
      let originalRoot = root;
      let i = 0;
      while (root !== undefined) {
        root.score = evals[i].score;

        let prevScore = { cp: 0 } as Score;
        if (i > 0) {
          prevScore = evals[i - 1].score;
        }
        const curScore = evals[i].score;
        const isWhite = i % 2 === 0;
        root.annotation = getAnnotation(prevScore, curScore, isWhite);

        root = root.children[0];
        i++;
      }
      setTree(goToPosition(originalRoot.getTopVariation(), position));
    });
  }

  return (
    <Modal
      opened={reportingMode}
      onClose={() => toggleReportingMode()}
      title="Generate report"
    >
      <form onSubmit={form.onSubmit(() => analyze())}>
        <Stack>
          <Select
            withAsterisk
            label="Engine"
            placeholder="Pick one"
            data={engines.map((engine) => {
              return {
                value: engine.path,
                label: engine.name,
              };
            })}
            {...form.getInputProps("engine")}
          />
          <NumberInput
            withAsterisk
            label="Seconds per Move"
            min={1}
            step={200}
            {...form.getInputProps("millisecondsPerMove")}
          />

          <Checkbox
            label="Skip Analyzing Theory"
            {...form.getInputProps("skipAnalyzingTheory", { type: "checkbox" })}
          />

          <Text size="sm">
            Estimated time:{" "}
            {formatDuration(
              (uciMoves.length * form.values.millisecondsPerMove) / 1000
            )}
          </Text>

          <Group position="right">
            <Button type="submit">Analyze</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default ReportModal;
