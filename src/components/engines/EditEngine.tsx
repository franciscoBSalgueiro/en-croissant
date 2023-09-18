import {
  Button,
  Modal,
  NumberInput,
  ScrollArea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { open } from "@tauri-apps/api/dialog";
import { platform } from "@tauri-apps/api/os";
import { Dispatch, SetStateAction } from "react";
import { Engine } from "@/utils/engines";
import { invoke } from "@/utils/invoke";
import FileInput from "../common/FileInput";
import useSWR from "swr";
import { match } from "ts-pattern";

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
  const { data: os } = useSWR("os", async () => {
    const p = await platform();
    const os = match(p)
      .with("win32", () => "windows" as const)
      .with("linux", () => "linux" as const)
      .with("darwin", () => "macos" as const)
      .otherwise(() => {
        throw Error("OS not supported");
      });
    return os;
  });

  const filters = match(os)
    .with("windows", () => [{ name: "Executable Files", extensions: ["exe"] }])
    .otherwise(() => []);

  const form = useForm<Engine>({
    initialValues: initialEngine,

    validate: {
      name: (value) => {
        if (!value) return "Name is required";
        if (engines.find((e) => e.name === value && e !== initialEngine)) return "Name already used";
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
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <form
        onSubmit={form.onSubmit(async (values) => {
          setEngines((prev) => prev.map((e) => (e === initialEngine ? values : e)));
          setOpened(false);
        })}
      >
        <FileInput
          label="Binary file"
          description="Click to select the binary file"
          filename={form.values.path}
          withAsterisk
          onClick={async () => {
            const selected = await open({
              multiple: false,
              filters,
            });
            if (!selected) return;
            const name: string = await invoke("get_engine_name", {
              path: selected as string,
            });
            form.setFieldValue("path", selected as string);
            form.setFieldValue("name", name);
          }}
        />

        <TextInput
          label="Name"
          placeholder="Auto"
          withAsterisk
          {...form.getInputProps("name")}
        />

        <NumberInput
          label="Elo"
          placeholder="Engine's Elo"
          {...form.getInputProps("elo")}
        />

        {/* <Input.Wrapper
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
            </Input.Wrapper> */}

        <Button fullWidth mt="xl" type="submit">
          Edit
        </Button>
      </form>
    </Modal>
  );
}
