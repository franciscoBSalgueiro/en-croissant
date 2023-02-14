import {
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { invoke } from "@tauri-apps/api";
import { useEffect, useState } from "react";
import {
  EngineVariation,
  goToPosition,
  pgnToUCI,
  VariationTree
} from "../../../utils/chess";
import { Database, getDatabases } from "../../../utils/db";
import { Engine, getEngines } from "../../../utils/engines";
import {
  formatDuration,
  formatNumber
} from "../../../utils/format";

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
  const [databases, setDatabases] = useState<Database[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);

  const uciMoves = pgnToUCI(moves);

  const form = useForm({
    initialValues: {
      engine: "",
      secondsPerMove: 1,
      referenceDatabase: "",
      skipAnalyzingTheory: true,
    },

    validate: {
      engine: (value) => {
        if (!value) return "Engine is required";
      },
      secondsPerMove: (value) => {
        if (!value) return "Seconds per move is required";
      },
      referenceDatabase: (value) => {
        if (!value) return "Reference database is required";
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
    toggleReportingMode();
    setLoading(true);
    invoke("analyze_game", {
      moves: uciMoves,
      engine: form.values.engine,
      moveTime: form.values.secondsPerMove,
    }).then((result) => {
      setLoading(false);
      const evals = result as EngineVariation[];
      console.log(evals);
      setTree((prev) => {
        let position = prev.getPosition();
        let root = prev.getTopVariation().children[0];
        let i = 0;
        while (root.children.length > 0) {
          root.score = evals[i].score;

          root = root.children[0];
          i++;
        }
        root.score = evals[i].score;
        return goToPosition(root.getTopVariation(), position);
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

          <Select
            withAsterisk
            label="Reference Database"
            placeholder="Pick one"
            data={databases.map((db) => {
              return {
                value: db.file,
                label: `${db.title} (${formatNumber(db.game_count!)} games)`,
              };
            })}
            {...form.getInputProps("referenceDatabase")}
          />

          <Checkbox
            label="Skip Analyzing Theory"
            {...form.getInputProps("skipAnalyzingTheory", { type: "checkbox" })}
          />

          <Text size="sm">
            Estimated time:{" "}
            {formatDuration(
              uciMoves.split(" ").length * form.values.secondsPerMove
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
