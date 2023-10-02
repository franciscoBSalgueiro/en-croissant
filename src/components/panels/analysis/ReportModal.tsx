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
import { MoveAnalysis } from "@/utils/chess";
import { useEngines } from "@/utils/engines";
import { formatDuration } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { useAtomValue } from "jotai";
import { referenceDbAtom } from "@/atoms/atoms";

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
  const { engines } = useEngines();
  const dispatch = useContext(TreeDispatchContext);

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
      novelty: (value) => {
        if (value && !referenceDb)
          return "No reference database selected. Select one first in the databases page";
      },
    },
  });

  function analyze() {
    setInProgress(true);
    toggleReportingMode();
    invoke<MoveAnalysis[]>("analyze_game", {
      fen: initialFen,
      moves,
      engine: form.values.engine,
      annotateNovelties: form.values.novelty,
      moveTime: form.values.millisecondsPerMove,
      referenceDb,
    }).then((analysis) => {
      dispatch({
        type: "ADD_ANALYSIS",
        payload: analysis,
      });
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
            data={
              engines?.map((engine) => {
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
