import { Modal, ScrollArea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Dispatch, SetStateAction } from "react";
import { Engine } from "@/utils/engines";
import EngineForm from "./EngineForm";

export default function EditEngine({
  initialEngine,
  engines,
  opened,
  setOpened,
  setEngines,
}: {
  initialEngine: Engine;
  engines: Engine[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setEngines: Dispatch<SetStateAction<Engine[]>>;
}) {
  const form = useForm<Engine>({
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
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Edit Engine"
    >
      <EngineForm
        submitLabel="Save"
        form={form}
        onSubmit={(values) => {
          setEngines((prev) =>
            prev.map((e) => (e === initialEngine ? values : e))
          );
          setOpened(false);
        }}
      />
    </Modal>
  );
}
