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
import { memo, useContext } from "react";
import { formatDuration } from "@/utils/format";
import { unwrap } from "@/utils/invoke";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { useAtomValue } from "jotai";
import { enginesAtom, referenceDbAtom } from "@/atoms/atoms";
import { commands } from "@/bindings";

function ReportModal({
  initialFen,
  moves,
  reportingMode,
  toggleReportingMode,
  setInProgress,
}: {
  initialFen: string;
  moves: string[];
  reportingMode: boolean;
  toggleReportingMode: () => void;
  setInProgress: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const referenceDb = useAtomValue(referenceDbAtom);
  const engines = useAtomValue(enginesAtom);
  const dispatch = useContext(TreeDispatchContext);

  const form = useForm({
    initialValues: {
      engine: engines[0]?.path ?? "",
      millisecondsPerMove: 500,
      novelty: true,
      reversed: true
    },

    validate: {
      engine: (value) => {
        if (!value) return "Engine is required";
      },
      millisecondsPerMove: (value) => {
        if (!value) return "Milliseconds per move is required";
      },
      novelty: (value) => {
        if (value && !referenceDb)
          return "No reference database selected. Select one first in the databases page";
      },
    },
  });

  function analyze() {
    setInProgress(true);
    toggleReportingMode();
    commands
      .analyzeGame(
        moves,
        form.values.engine,
        {
          t: "Time",
          c: form.values.millisecondsPerMove,
        },
        {
          annotateNovelties: form.values.novelty,
          fen: initialFen,
          referenceDb,
          reversed: form.values.reversed
        }
      )
      .then((analysis) => {
        const analysisData = unwrap(analysis);
        dispatch({
          type: "ADD_ANALYSIS",
          payload: analysisData,
        });
      }).finally(() => setInProgress(false));
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
            data={
              engines.map((engine) => {
                return {
                  value: engine.path,
                  label: engine.name,
                };
              }) ?? []
            }
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
            label="Reversed analysis"
            description="Analyze the game in starting from the last move."
            {...form.getInputProps("reversed", { type: "checkbox" })}
          />

          <Checkbox
            label="Annotate Novelties"
            description="Add a comment to the first position that is not in the reference database."
            {...form.getInputProps("novelty", { type: "checkbox" })}
          />

          <Text size="sm">
            Estimated time:{" "}
            {formatDuration(moves.length * form.values.millisecondsPerMove)}
          </Text>

          <Group position="right">
            <Button type="submit">Analyze</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default memo(ReportModal);
