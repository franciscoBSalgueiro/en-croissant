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
import { memo, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { commands, type GoMode } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { enginesAtom, referenceDbAtom } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";

const reportSettingsAtom = atomWithStorage("report-settings", {
  novelty: true,
  reversed: true,
  goMode: { t: "Time", c: 500 } as Exclude<GoMode, { t: "Infinite" }>,
  engine: "",
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
  setInProgress: (value: boolean) => void;
}) {
  const { t } = useTranslation();

  const referenceDb = useAtomValue(referenceDbAtom);
  const engines = useAtomValue(enginesAtom);
  const localEngines = useMemo(
    () => engines.filter((e): e is LocalEngine => e.type === "local"),
    [engines],
  );
  const store = useContext(TreeStateContext)!;
  const addAnalysis = useStore(store, (s) => s.addAnalysis);

  const [reportSettings, setReportSettings] = useAtom(reportSettingsAtom);

  const form = useForm({
    initialValues: reportSettings,
    validate: {
      engine: (value) => {
        if (!value) return t("Board.Analysis.EngineRequired");
      },
      novelty: (value) => {
        if (value && !referenceDb) return t("Board.Analysis.RefDBRequired");
      },
    },
  });

  useEffect(() => {
    const engine =
      localEngines.length === 0
        ? ""
        : !reportSettings.engine ||
            !localEngines.some((l) => l.id === reportSettings.engine)
          ? localEngines[0].id
          : reportSettings.engine;

    form.setValues({ ...reportSettings, engine });
  }, [localEngines, reportSettings]);

  function analyze() {
    setReportSettings(form.values);
    setInProgress(true);
    toggleReportingMode();
    const engine = localEngines.find((e) => e.id === form.values.engine);
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
        engine?.path ?? "",
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
        if (analysis.status === "ok") {
          addAnalysis(analysis.data);
        }
      })
      .finally(() => setInProgress(false));
  }

  return (
    <Modal
      opened={reportingMode}
      onClose={() => toggleReportingMode()}
      title={t("Board.Analysis.GenerateReport")}
    >
      <form onSubmit={form.onSubmit(() => analyze())}>
        <Stack>
          <Select
            allowDeselect={false}
            withAsterisk
            label={t("Common.Engine")}
            placeholder="Pick one"
            data={
              localEngines.map((engine) => {
                return {
                  value: engine.id,
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
              data={[
                { label: t("GoMode.Depth"), value: "Depth" },
                { label: t("Board.Analysis.Time"), value: "Time" },
                { label: t("GoMode.Nodes"), value: "Nodes" },
              ]}
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
            label={t("Board.Analysis.Reversed")}
            description={t("Board.Analysis.Reversed.Desc")}
            {...form.getInputProps("reversed", { type: "checkbox" })}
          />

          <Checkbox
            label={t("Board.Analysis.AnnotateNovelties")}
            description={t("Board.Analysis.AnnotateNovelties.Desc")}
            {...form.getInputProps("novelty", { type: "checkbox" })}
          />

          <Group justify="right">
            <Button type="submit">{t("Board.Analysis.Analyze")}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default memo(ReportModal);
