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
import { useEffect, useState } from "react";
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

function ReportModal({
  moves,
  setLoading,
  reportingMode,
  toggleReportingMode,
  setTree,
}: {
  moves: string;
  setLoading: (loading: boolean) => void;
  reportingMode: boolean;
  toggleReportingMode: () => void;
  setTree: React.Dispatch<React.SetStateAction<VariationTree>>;
}) {
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
      secondsPerMove: 1,
      skipAnalyzingTheory: true,
    },

    validate: {
      engine: (value) => {
        if (!value) return "Engine is required";
      },
      secondsPerMove: (value) => {
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

    toggleReportingMode();
    setLoading(true);
    invoke("analyze_game", {
      moves: uciMoves.join(" "),
      engine: form.values.engine,
      moveTime: form.values.secondsPerMove,
    }).then((result) => {
      setLoading(false);
      const evals = result as BestMoves[];

      setTree((prev) => {
        let position = prev.getPosition();
        let root = prev.getTopVariation().children[0];
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
        return goToPosition(originalRoot.getTopVariation(), position);
      });
    });
  }

  return (
    <Modal
      opened={reportingMode}
      onClose={() => toggleReportingMode()}
      title="Generate report"
    >
      <form onSubmit={form.onSubmit((values) => analyze())}>
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
            {...form.getInputProps("secondsPerMove")}
            min={1}
          />

          <Checkbox
            label="Skip Analyzing Theory"
            {...form.getInputProps("skipAnalyzingTheory", { type: "checkbox" })}
          />

          <Text size="sm">
            Estimated time:{" "}
            {formatDuration(uciMoves.length * form.values.secondsPerMove)}
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
