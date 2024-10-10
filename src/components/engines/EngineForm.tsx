import { type UciOptionConfig, commands } from "@/bindings";
import { type LocalEngine, requiredEngineSettings } from "@/utils/engines";
import { usePlatform } from "@/utils/files";
import { unwrap } from "@/utils/unwrap";
import { Button, Input, NumberInput, Text, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { open } from "@tauri-apps/plugin-dialog";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

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
        label={t("Engines.Add.BinaryFile")}
        description={t("Engines.Add.BinaryFile.Desc")}
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
        label={t("Engines.Add.Name")}
        placeholder={t("Engines.Add.Name.Autodetect")}
        withAsterisk
        {...form.getInputProps("name")}
      />

      <NumberInput
        label="Elo"
        placeholder={t("Engines.Add.Elo.Desc")}
        {...form.getInputProps("elo")}
      />

      <Input.Wrapper
        label={t("Engines.Add.ImageFile")}
        description={t("Engines.Add.ImageFile.Desc")}
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
