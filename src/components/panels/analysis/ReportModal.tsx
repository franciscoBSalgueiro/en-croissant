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
import { useLocalStorage } from "@mantine/hooks";
import { Chess } from "chess.js";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  MoveAnalysis,
  Score,
  VariationTree,
  getAnnotation,
  goToPosition,
} from "../../../utils/chess";
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
  const [referenceDb] = useLocalStorage<string | null>({
    key: "reference-database",
    defaultValue: null,
  });
  const [engines, setEngines] = useState<Engine[]>([]);

  const uciMoves = useMemo(() => {
    const chess = new Chess();
    let uciMoves: string[] = [];
    try {
      chess.loadPgn(moves);
      uciMoves = chess.history();
    } catch (e) {
      console.error(e);
    }
    return uciMoves;
  }, [moves]);

  const form = useForm({
    initialValues: {
      engine: "",
      millisecondsPerMove: 500,
      novelty: true,
    },

    validate: {
      engine: (value) => {
        if (!value) return "Engine is required";
      },
      millisecondsPerMove: (value) => {
        if (!value) return "Milliseconds per move is required";
      },
    },
  });

  useEffect(() => {
    getEngines().then((engines) => {
      setEngines(engines);
    });
  }, []);

  function analyze() {
    setInProgress(true);
    toggleReportingMode();
    invoke<MoveAnalysis[]>("analyze_game", {
      moves: uciMoves.join(" "),
      engine: form.values.engine,
      annotateNovelties: form.values.novelty,
      moveTime: form.values.millisecondsPerMove,
      referenceDb,
    }).then((analysis) => {
      let position = tree.getPosition();
      let root = tree.getTopVariation().children[0];
      let originalRoot = root;
      let i = 0;
      while (root !== undefined) {
        root.score = analysis[i].best.score;

        if (analysis[i].novelty) {
          root.commentHTML = "Novelty";
          root.commentText = "Novelty";
        }

        let prevScore: Score = { type: "cp", value: 0 };
        if (i > 0) {
          prevScore = analysis[i - 1].best.score;
        }
        const curScore = analysis[i].best.score;
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
            label="Milliseconds per Move"
            min={1}
            step={200}
            {...form.getInputProps("millisecondsPerMove")}
          />

          <Checkbox
            label="Annotate Novelties"
            description="Add a comment to the first position that is not in the reference database."
            {...form.getInputProps("novelty", { type: "checkbox" })}
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
