import { enginesAtom, referenceDbAtom } from "@/atoms/atoms";
import { GoMode, commands } from "@/bindings";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { LocalEngine } from "@/utils/engines";
import { unwrap } from "@/utils/invoke";
import {
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useAtomValue } from "jotai";
import { memo, useContext } from "react";

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
  const localEngines = engines.filter(
    (e): e is LocalEngine => e.type === "local",
  );
  const dispatch = useContext(TreeDispatchContext);

  const form = useForm({
    initialValues: {
      engine: localEngines[0]?.path ?? "",
      novelty: true,
      reversed: true,
      goMode: { t: "Time", c: 500 } as Exclude<GoMode, { t: "Infinite" }>,
    },

    validate: {
      engine: (value) => {
        if (!value) return "Engine is required";
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
      .analyzeGame(form.values.engine, form.values.goMode, {
        annotateNovelties: form.values.novelty,
        fen: initialFen,
        referenceDb,
        reversed: form.values.reversed,
        moves,
      })
      .then((analysis) => {
        const analysisData = unwrap(analysis);
        dispatch({
          type: "ADD_ANALYSIS",
          payload: analysisData,
        });
      })
      .finally(() => setInProgress(false));
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
            allowDeselect={false}
            withAsterisk
            label="Engine"
            placeholder="Pick one"
            data={
              localEngines.map((engine) => {
                return {
                  value: engine.path,
                  label: engine.name,
                };
              }) ?? []
            }
            {...form.getInputProps("engine")}
          />
          <Group wrap="nowrap">
            <Select
              allowDeselect={false}
              comboboxProps={{
                position: "bottom",
                middlewares: { flip: false, shift: false },
              }}
              data={["Depth", { label: "Time (ms)", value: "Time" }, "Nodes"]}
              value={form.values.goMode.t}
              onChange={(v) => {
                const newGo = form.values.goMode;
                newGo.t = v as "Depth" | "Time" | "Nodes";
                form.setFieldValue("goMode", newGo);
              }}
            />
            <NumberInput
              min={1}
              value={form.values.goMode.c as number}
              onChange={(v) =>
                form.setFieldValue("goMode", {
                  ...(form.values.goMode as any),
                  c: (v || 1) as number,
                })
              }
            />
          </Group>

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

          <Group justify="right">
            <Button type="submit">Analyze</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default memo(ReportModal);
