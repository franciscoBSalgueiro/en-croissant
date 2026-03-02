import {
  ActionIcon,
  Checkbox,
  Group,
  type MantineColor,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconPlayerStopFilled, IconSettings } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import { commands, type GoMode } from "@/bindings";
import GoModeInput from "@/components/common/GoModeInput";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import {
  type Engine,
  type EngineSettings,
  isUciEngine,
  killEngine,
} from "@/utils/engines";
import { unwrap } from "@/utils/unwrap";
import CoresSlider from "./CoresSlider";
import HashSlider from "./HashSlider";
import LinesSlider from "./LinesSlider";

export type Settings = {
  enabled: boolean;
  go: GoMode;
  settings: EngineSettings;
  synced: boolean;
};

interface EngineSettingsProps {
  engine: Engine;
  settings: Settings;
  setSettings: (fn: (prev: Settings) => Settings) => void;
  color?: MantineColor;
  minimal?: boolean;
  gameMode?: boolean;
}

function EngineSettingsForm({
  engine,
  settings,
  setSettings,
  color,
  minimal,
  gameMode,
}: EngineSettingsProps) {
  const { t } = useTranslation();
  const activeTab = useAtomValue(activeTabAtom);
  const local = engine.type === "local";

  const { data: config } = useSWRImmutable(
    local && engine.path ? ["engine-config", engine.path] : null,
    async ([, path]) => {
      return unwrap(await commands.getEngineConfig(path));
    },
  );

  const getSetting = (name: string) => {
    const fromProps = settings.settings.find((o) => o.name === name);
    if (fromProps) return fromProps.value;

    if (config?.options) {
      const option = config.options.find((o) => o.value.name === name);
      if (
        option &&
        option.type !== "button" &&
        option.value.default !== undefined
      ) {
        return option.value.default;
      }
    }

    return undefined; // not found in current settings and default value
  };

  const updateSetting = (name: string, newValue: number | string | boolean) => {
    setSettings((prev) => {
      const exists = prev.settings.some((o) => o.name === name);
      if (exists) {
        return {
          ...prev,
          settings: prev.settings.map((o) =>
            o.name === name ? { ...o, value: newValue } : o,
          ),
        };
      }
      return {
        ...prev,
        settings: [...prev.settings, { name, value: newValue }],
      };
    });
  };

  const setGoMode = (v: GoMode) => {
    setSettings((prev) => ({ ...prev, go: v }));
  };
  const multiPv = getSetting("MultiPV");
  const threads = getSetting("Threads");
  const hash = getSetting("Hash");

  return (
    <Stack>
      {local && isUciEngine(engine) && (
        <GoModeInput
          gameMode={gameMode}
          goMode={settings.go}
          setGoMode={setGoMode}
        />
      )}

      {!minimal && multiPv !== undefined && (
        <Group grow>
          <Text size="sm" fw="bold">
            {t("Engines.Settings.NumOfLines")}
          </Text>
          <LinesSlider
            value={Number(multiPv)}
            setValue={(v) => updateSetting("MultiPV", v)}
            color={color}
          />
        </Group>
      )}

      {local && threads !== undefined && (
        <>
          <Group grow>
            <Text size="sm" fw="bold">
              {t("Engines.Settings.NumOfCores")}
            </Text>
            <CoresSlider
              value={Number(threads)}
              setValue={(v) => updateSetting("Threads", v)}
              color={color}
            />
          </Group>

          {hash !== undefined && (
            <Group grow>
              <Text size="sm" fw="bold">
                {t("Engines.Settings.SizeOfHash")}
              </Text>
              <HashSlider
                value={Number(hash)}
                setValue={(v) => updateSetting("Hash", v)}
                color={color}
              />
            </Group>
          )}
        </>
      )}
      {!minimal && (
        <Group>
          <SyncSettings
            settings={settings}
            engine={engine.name}
            setSettings={setSettings}
          />
          <ActionIcon.Group>
            {local && (
              <Tooltip label="Kill engine">
                <ActionIcon
                  variant="default"
                  onClick={() => {
                    killEngine(engine, activeTab!);
                    setSettings((prev) => ({
                      ...prev,
                      enabled: false,
                    }));
                  }}
                >
                  <IconPlayerStopFilled size="1rem" />
                </ActionIcon>
              </Tooltip>
            )}
            <AdvancedSettings engineName={engine.name} />
          </ActionIcon.Group>
        </Group>
      )}
    </Stack>
  );
}

function SyncSettings({
  engine,
  settings,
  setSettings,
}: {
  engine: string;
  settings: Settings;
  setSettings: (fn: (prev: Settings) => Settings) => void;
}) {
  const { t } = useTranslation();

  const engines = useAtomValue(enginesAtom);
  const engineDefault = useMemo(
    () => (engines ?? []).find((o) => o.name === engine)!,
    [engines, engine],
  );

  return (
    <Checkbox
      label={t("Board.Analysis.SyncGlobally")}
      checked={settings.synced}
      onChange={(e) => {
        if (e.currentTarget.checked) {
          setSettings((prev) => ({
            ...prev,
            go: engineDefault.go || prev.go,
            settings: engineDefault.settings || prev.settings,
            synced: true,
          }));
        } else {
          setSettings((prev) => ({
            ...prev,
            synced: false,
          }));
        }
      }}
    />
  );
}

function AdvancedSettings({ engineName }: { engineName: string }) {
  const { t } = useTranslation();

  const navigate = useNavigate();
  const engines = useAtomValue(enginesAtom);

  return (
    <Tooltip label={t("Engines.Settings.AdvancedSettings")}>
      <ActionIcon
        variant="default"
        onClick={() =>
          navigate({
            to: "/engines",
            search: {
              selected: (engines ?? []).findIndex((o) => o.name === engineName),
            },
          })
        }
      >
        <IconSettings size="1rem" />
      </ActionIcon>
    </Tooltip>
  );
}

export default memo(EngineSettingsForm);
