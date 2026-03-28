import {
  Button,
  Checkbox,
  Input,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { open } from "@tauri-apps/plugin-dialog";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { commands, type UciOptionConfig } from "@/bindings";
import {
  MAIA_ELO_MAX,
  MAIA_ELO_MIN,
  requiredEngineSettings,
  type LocalEngine,
} from "@/utils/engines";
import { usePlatform } from "@/utils/files";
import { unwrap } from "@/utils/unwrap";
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

  const runtime = form.values.runtime;
  const config = useRef<{ name: string; options: UciOptionConfig[] } | null>(null);

  const binaryFilters = match({ os, runtime })
    .with({ runtime: "maia" }, () => [
      { name: "Maia Model", extensions: ["onnx"] },
    ])
    .with({ os: "windows", runtime: "uci" }, () => [
      { name: "Executable Files", extensions: ["exe"] },
    ])
    .otherwise(() => []);

  const handleFileSelect = async () => {
    const selected = await open({
      multiple: false,
      filters: binaryFilters,
    });

    if (!selected) return;
    const path = selected as string;

    form.setFieldValue("path", path);

    if (runtime === "uci") {
      try {
        config.current = unwrap(await commands.getEngineConfig(path));
        form.setFieldValue("name", config.current.name);
      } catch (e) {
        console.error("Failed to parse UCI config", e);
      }
    } else if (runtime === "maia") {
      // For Maia, simply default the name to the filename
      // technically ONNX supports metadata, but maia does not provide it
      const fileName =
        path
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^/.]+$/, "") || "";
      if (fileName) {
        form.setFieldValue("name", fileName);
      }
    }
  };

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        const defaults =
          runtime === "uci"
            ? (config.current?.options
                .filter((o) => requiredEngineSettings.includes(o.value.name))
                .filter((o) => o.type !== "button")
                .map((o) => ({
                  name: o.value.name,
                  value: o.value.default as string | number | boolean | null,
                })) ?? [])
            : [];
        const maiaElo =
          values.runtime === "maia"
            ? typeof values.elo === "number"
              ? Math.max(MAIA_ELO_MIN, Math.min(MAIA_ELO_MAX, values.elo))
              : 1500
            : values.elo;
        const submitted: LocalEngine =
          values.runtime === "maia"
            ? {
                ...values,
                elo: maiaElo,
                loaded: true,
                settings: defaults,
                showInDatabase: values.showInDatabase !== false,
              }
            : {
                ...values,
                loaded: true,
                settings: defaults,
              };
        onSubmit(submitted);
      })}
    >
      <Stack>
        <SegmentedControl
          fullWidth
          data={[
            { label: t("Engines.Add.TypeUciBinary"), value: "uci" },
            { label: t("Engines.Add.TypeMaiaOnnx"), value: "maia" },
          ]}
          value={form.values.runtime}
          onChange={(value) => {
            form.setFieldValue("runtime", value as "uci" | "maia");
            form.setFieldValue("path", "");
            if (value === "maia") {
              form.setFieldValue("elo", 1500);
              form.setFieldValue("showInDatabase", true);
            }
          }}
        />

        <FileInput
          label={
            runtime === "maia"
              ? t("Engines.Add.OnnxFile")
              : t("Engines.Add.BinaryFile")
          }
          description={
            runtime === "maia"
              ? t("Engines.Add.OnnxFile.Desc")
              : t("Engines.Add.BinaryFile.Desc")
          }
          filename={form.values.path}
          withAsterisk
          onClick={handleFileSelect}
        />

        <TextInput
          label={t("Engines.Add.Name")}
          placeholder={t("Engines.Add.Name.Autodetect")}
          withAsterisk
          {...form.getInputProps("name")}
        />

        <NumberInput
          label={runtime === "maia" ? t("Engines.Settings.DefaultMaiaElo") : "Elo"}
          placeholder={t("Engines.Add.Elo.Desc")}
          min={runtime === "maia" ? MAIA_ELO_MIN : undefined}
          max={runtime === "maia" ? MAIA_ELO_MAX : undefined}
          {...form.getInputProps("elo")}
        />

        {runtime === "maia" && (
          <Checkbox
            label={t("Engines.Settings.ShowInDatabase")}
            checked={form.values.showInDatabase !== false}
            onChange={(event) => {
              form.setFieldValue("showInDatabase", event.currentTarget.checked);
            }}
          />
        )}

        {runtime === "uci" && (
          <Input.Wrapper
            label={t("Engines.Add.ImageFile")}
            description={t("Engines.Add.ImageFile.Desc")}
            {...form.getInputProps("image")}
          >
            <Input
              component="button"
              type="button"
              onClick={async () => {
                const selected = await open({
                  multiple: false,
                  filters: [
                    {
                      name: "Image",
                      extensions: ["png", "jpeg", "jpg", "webp"],
                    },
                  ],
                });
                if (selected) {
                  form.setFieldValue("image", selected as string);
                }
              }}
            >
              <Text lineClamp={1}>{form.values.image}</Text>
            </Input>
          </Input.Wrapper>
        )}

        <Button fullWidth mt="xl" type="submit">
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
