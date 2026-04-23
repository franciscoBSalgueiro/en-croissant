import {
  ActionIcon,
  Button,
  Group,
  Input,
  NumberInput,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { homeDir, resolve as resolveSystemPath } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { IconFolderOpen, IconSearch } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { commands, type EngineConfig } from "@/bindings";
import { type LocalEngine, requiredEngineSettings } from "@/utils/engines";
import { usePlatform } from "@/utils/files";

export default function EngineForm({
  onSubmit,
  form,
  submitLabel,
  detectStockfish = false,
  validateName,
}: {
  onSubmit: (values: LocalEngine) => void;
  form: UseFormReturnType<LocalEngine, (values: LocalEngine) => LocalEngine>;
  submitLabel: string;
  detectStockfish?: boolean;
  validateName?: (name: string) => string | undefined;
}) {
  const { t } = useTranslation();

  const { os } = usePlatform();
  const stockfishLookupDone = useRef(false);
  const [stockfishPath, setStockfishPath] = useState<string | null>(null);
  const requiredSettings = (config: EngineConfig) =>
    config.options
      .filter((o) => requiredEngineSettings.includes(o.value.name))
      .filter((o) => o.type !== "button")
      .map((o) => ({
        name: o.value.name,
        value: o.value.default as string | number | boolean,
      }));

  const filters = match(os)
    .with("windows", () => [{ name: "Executable Files", extensions: ["exe"] }])
    .otherwise(() => []);

  useEffect(() => {
    if (!detectStockfish || stockfishLookupDone.current) return;
    stockfishLookupDone.current = true;

    let cancelled = false;

    commands
      .findExecutableOnPath("stockfish")
      .then((path) => {
        if (!cancelled) {
          setStockfishPath(path);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStockfishPath(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detectStockfish]);

  async function expandHomePath(path: string): Promise<string> {
    const trimmed = path.trim();
    if (trimmed === "~") {
      return homeDir();
    }
    if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
      return resolveSystemPath(await homeDir(), trimmed.slice(2));
    }
    return trimmed;
  }

  async function resolvePath(path: string): Promise<string> {
    const expanded = await expandHomePath(path);
    if (!expanded || expanded.includes("/") || expanded.includes("\\")) {
      return expanded;
    }
    const resolved = await commands.findExecutableOnPath(expanded);
    return resolved ?? expanded;
  }

  async function loadEngineConfig(
    path: string,
    overwriteName: boolean,
  ): Promise<{ config: EngineConfig; path: string } | null> {
    const resolvedPath = await resolvePath(path);
    if (!resolvedPath) {
      form.setFieldError("path", t("Common.RequirePath"));
      return null;
    }

    const result = await commands.getEngineConfig(resolvedPath);
    if (result.status === "error") {
      form.setFieldError("path", result.error);
      return null;
    }

    form.clearFieldError("path");
    form.setFieldValue("path", resolvedPath);
    if (overwriteName || !form.values.name.trim()) {
      form.setFieldValue("name", result.data.name);
      form.clearFieldError("name");
    }

    return { config: result.data, path: resolvedPath };
  }

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        const loaded = await loadEngineConfig(values.path, false);
        if (!loaded) return;

        const name = values.name.trim() || loaded.config.name;
        if (!name) {
          form.setFieldError("name", t("Common.RequireName"));
          return;
        }

        const nameError = validateName?.(name);
        if (nameError) {
          form.setFieldError("name", nameError);
          return;
        }

        onSubmit({
          ...values,
          name,
          path: loaded.path,
          loaded: true,
          settings: requiredSettings(loaded.config),
        });
      })}
    >
      <Group align="end" wrap="nowrap">
        <TextInput
          style={{ flex: 1, minWidth: 0 }}
          label={t("Engines.Add.BinaryFile")}
          description={t("Engines.Add.BinaryFile.Desc")}
          withAsterisk
          value={form.values.path}
          error={form.errors.path}
          onChange={(e) => {
            form.clearFieldError("path");
            form.setFieldValue("path", e.currentTarget.value);
          }}
        />
        {stockfishPath && stockfishPath !== form.values.path && (
          <Tooltip label={t("Engines.Add.UseStockfish")}>
            <Button
              type="button"
              variant="default"
              leftSection={<IconSearch size="1rem" />}
              onClick={() => loadEngineConfig(stockfishPath, true)}
            >
              Stockfish
            </Button>
          </Tooltip>
        )}
        <Tooltip label={t("Common.Open")}>
          <ActionIcon
            type="button"
            variant="default"
            size={36}
            mt={26}
            onClick={async () => {
              const selected = await open({
                multiple: false,
                filters,
              });
              if (!selected) return;
              await loadEngineConfig(selected as string, true);
            }}
          >
            <IconFolderOpen size="1rem" />
          </ActionIcon>
        </Tooltip>
      </Group>

      <TextInput
        label={t("Engines.Add.Name")}
        placeholder={t("Engines.Add.Name.Autodetect")}
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
