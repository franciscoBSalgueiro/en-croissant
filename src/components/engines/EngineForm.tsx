import { UciOptionConfig, commands } from "@/bindings";
import { LocalEngine, requiredEngineSettings } from "@/utils/engines";
import { usePlatform } from "@/utils/files";
import { unwrap } from "@/utils/invoke";
import { Button, Input, NumberInput, Text, TextInput } from "@mantine/core";
import { UseFormReturnType } from "@mantine/form";
import { open } from "@tauri-apps/api/dialog";
import { useRef } from "react";
import { match } from "ts-pattern";
import FileInput from "../common/FileInput";

export default function EngineForm({
  onSubmit,
  form,
  submitLabel,
}: {
  onSubmit: (values: LocalEngine) => void;
  form: UseFormReturnType<LocalEngine, (values: LocalEngine) => LocalEngine>;
  submitLabel: string;
}) {
  const { os } = usePlatform();
  const config = useRef<{ name: string; options: UciOptionConfig[] } | null>(
    null,
  );
  const settings = config.current?.options
    .filter((o) => requiredEngineSettings.includes(o.value.name))
    .map((o) => ({
      name: o.value.name,
      // @ts-expect-error
      value: o.value.default,
    }));

  const filters = match(os)
    .with("windows", () => [{ name: "Executable Files", extensions: ["exe"] }])
    .otherwise(() => []);

  return (
    <form
      onSubmit={form.onSubmit(async (values) =>
        onSubmit({ ...values, loaded: true, settings: settings || [] }),
      )}
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
          config.current = unwrap(
            await commands.getEngineConfig(selected as string),
          );
          form.setFieldValue("path", selected as string);
          form.setFieldValue("name", config.current.name);
        }}
      />

      <TextInput
        label="Name"
        placeholder="Autodetect"
        withAsterisk
        {...form.getInputProps("name")}
      />

      <NumberInput
        label="Elo"
        placeholder="Engine's Elo"
        {...form.getInputProps("elo")}
      />

      <Input.Wrapper
        label="Image file"
        description="Click to select the image file (recommended size: 60x60)"
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
        {submitLabel}
      </Button>
    </form>
  );
}
