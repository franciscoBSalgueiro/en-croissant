import { enginesAtom } from "@/atoms/atoms";
import type { LocalEngine } from "@/utils/engines";
import { useForm } from "@mantine/form";
import { useAtom } from "jotai";
import EngineForm from "./EngineForm";

export default function EditEngine({
  initialEngine,
}: {
  initialEngine: LocalEngine;
}) {
  const [engines, setEngines] = useAtom(enginesAtom);
  const form = useForm<LocalEngine>({
    initialValues: initialEngine,

    validate: {
      name: (value) => {
        if (!value) return "Name is required";
        if (engines.find((e) => e.name === value && e !== initialEngine))
          return "Name already used";
      },
      path: (value) => {
        if (!value) return "Path is required";
      },
    },
  });

  return (
    <EngineForm
      submitLabel="Save"
      form={form}
      onSubmit={(values) => {
        setEngines(async (prev) =>
          (await prev).map((e) => (e === initialEngine ? values : e)),
        );
      }}
    />
  );
}
