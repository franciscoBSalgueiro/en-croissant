import { enginesAtom, referenceDbAtom } from "@/atoms/atoms";
import { type GoMode, commands } from "@/bindings";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import type { LocalEngine } from "@/utils/engines";
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
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { memo, useContext, useEffect } from "react";

const reportSettingsAtom = atomWithStorage("report-settings", {
  novelty: true,
  reversed: true,
  goMode: { t: "Time", c: 500 } as Exclude<GoMode, { t: "Infinite" }>,
});

function ReportModal({
  tab,
  initialFen,
  moves,
  is960,
  reportingMode,
  toggleReportingMode,
  setInProgress,
}: {
  tab: string;
  initialFen: string;
  moves: string[];
  is960: boolean;
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

  useEffect(() => {
    if (!form.values.engine && localEngines.length > 0) {
      form.setFieldValue("engine", localEngines[0].path);
    }
  }, [localEngines.length]);
  const [reportSettings, setReportSettings] = useAtom(reportSettingsAtom);

  const form = useForm({
    initialValues: {
      ...reportSettings,
      engine: "",
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
    setReportSettings(form.values);
    setInProgress(true);
    toggleReportingMode();
    const engine = localEngines.find((e) => e.path === form.values.engine);
    const engineSettings = (engine?.settings ?? []).map((s) => ({
      ...s,
      value: s.value?.toString() ?? "",
    }));

    if (is960 && !engineSettings.find((o) => o.name === "UCI_Chess960")) {
      engineSettings.push({ name: "UCI_Chess960", value: "true" });
    }

    commands
      .analyzeGame(
        `report_${tab}`,
        form.values.engine,
        form.values.goMode,
        {
          annotateNovelties: form.values.novelty,
          fen: initialFen,
          referenceDb,
          reversed: form.values.reversed,
          moves,
        },
        engineSettings,
      )
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
