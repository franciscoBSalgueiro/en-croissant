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
import { memo, useContext, useMemo } from "react";
import { MoveAnalysis } from "@/utils/chess";
import { useEngines } from "@/utils/engines";
import { formatDuration } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { useAtomValue } from "jotai";
import { referenceDbAtom } from "@/atoms/atoms";
import { error } from "tauri-plugin-log-api";

function ReportModal({
  moves,
  reportingMode,
  toggleReportingMode,
  setInProgress,
}: {
  moves: string;
  reportingMode: boolean;
  toggleReportingMode: () => void;
  setInProgress: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const referenceDb = useAtomValue(referenceDbAtom);
  const { engines } = useEngines();
  const dispatch = useContext(TreeDispatchContext);

  const uciMoves = useMemo(() => {
    const chess = new Chess();
    let uciMoves: string[] = [];
    try {
      chess.loadPgn(moves);
      uciMoves = chess.history();
    } catch (e) {
      error(e as string);
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
      moves: uciMoves.join(" "),
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
            data={engines!.map((engine) => {
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
            {formatDuration(uciMoves.length * form.values.millisecondsPerMove)}
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
