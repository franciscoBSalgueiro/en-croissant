import {
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useEffect, useState } from "react";
import { Database, getDatabases } from "../../../utils/db";
import { Engine, getEngines } from "../../../utils/engines";
import { formatNumber } from "../../../utils/format";

function ReportModal({
  reportingMode,
  toggleReportingMode,
}: {
  reportingMode: boolean;
  toggleReportingMode: () => void;
}) {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);

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

  return (
    <Modal
      opened={reportingMode}
      onClose={() => toggleReportingMode()}
      title="Generate report"
    >
      <form onSubmit={form.onSubmit((values) => console.log(values))}>
        <Stack>
          <Select
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
            label="Seconds per Move"
            {...form.getInputProps("secondsPerMove")}
            min={1}
          />

          <Select
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

          <Group position="right">
            <Button type="submit">Analyze</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default ReportModal;
