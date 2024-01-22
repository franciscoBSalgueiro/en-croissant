import { Modal } from "@mantine/core";
import { useForm } from "@mantine/form";
import { LocalEngine } from "@/utils/engines";
import EngineForm from "./EngineForm";
import { enginesAtom } from "@/atoms/atoms";
import { useAtom } from "jotai";

export default function EditEngine({
  initialEngine,
  opened,
  setOpened,
}: {
  initialEngine: LocalEngine;
  opened: boolean;
  setOpened: (opened: boolean) => void;
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
    <Modal opened={opened} onClose={() => setOpened(false)} title="Edit Engine">
      <EngineForm
        submitLabel="Save"
        form={form}
        onSubmit={(values) => {
          setEngines(async (prev) =>
            (await prev).map((e) => (e === initialEngine ? values : e)),
          );
          setOpened(false);
        }}
      />
    </Modal>
  );
}
