import { Button, Input, Modal, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { open } from "@tauri-apps/api/dialog";
import { Dispatch, SetStateAction } from "react";
import { Engine, EngineSettings } from "../../utils/engines";

function AddEngine({
  engines,
  opened,
  setOpened,
  setEngineSettings,
}: {
  engines: Engine[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setEngineSettings: Dispatch<SetStateAction<EngineSettings[]>>;
}) {
  const form = useForm<EngineSettings>({
    initialValues: {
      name: "",
      binary: "",
      image: "",
    },

    validate: {
      name: (value) => {
        if (!value) return "Name is required";
        if (engines.find((e) => e.name === value)) return "Name already used";
      },
      binary: (value) => {
        if (!value) return "Binary is required";
      },
    },
  });

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title="New Engine">
      <form
        onSubmit={form.onSubmit(async (values) => {
          setEngineSettings((prev) => [...prev, values]);
          setOpened(false);
        })}
      >
        <TextInput
          label="Name"
          placeholder="Engine's Name"
          withAsterisk
          {...form.getInputProps("name")}
        />

        <Input.Wrapper
          label="Binary file"
          description="Click to select the binary file"
          withAsterisk
          {...form.getInputProps("binary")}
        >
          <Input
            component="button"
            type="button"
            // accept="application/octet-stream"
            onClick={async () => {
              const selected = await open({
                multiple: false,
                filters: [
                  {
                    name: "Binary",
                    extensions: ["exe", "bin", "sh"],
                  },
                ],
              });
              form.setFieldValue("binary", selected as string);
            }}
          >
            <Text lineClamp={1}>{form.values.binary}</Text>
          </Input>
        </Input.Wrapper>

        <Input.Wrapper
          label="Image file"
          description="Click to select the image file"
          {...form.getInputProps("image")}
        >
          <Input
            component="button"
            type="button"
            // accept="application/octet-stream"
            onClick={async () => {
              const selected = await open({
                multiple: false,
                filters: [
                  {
                    name: "Image",
                    extensions: ["png", "jpeg"],
                  },
                ],
              });
              form.setFieldValue("image", selected as string);
            }}
          >
            <Text lineClamp={1}>{form.values.image}</Text>
          </Input>
        </Input.Wrapper>

        <Button fullWidth mt="xl" type="submit">
          Add
        </Button>
      </form>
    </Modal>
  );
}

export default AddEngine;
