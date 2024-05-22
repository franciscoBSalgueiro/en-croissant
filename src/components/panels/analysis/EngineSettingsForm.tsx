import type { GoMode } from "@/bindings";
import GoModeInput from "@/components/common/GoModeInput";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import { type Engine, type EngineSettings, killEngine } from "@/utils/engines";
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
import React, { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  remote: boolean;
  gameMode?: boolean;
}

function EngineSettingsForm({
  engine,
  settings,
  setSettings,
  color,
  minimal,
  remote,
  gameMode,
}: EngineSettingsProps) {
  const { t } = useTranslation();

  const multipv = settings.settings.find((o) => o.name === "MultiPV");
  const threads = settings.settings.find((o) => o.name === "Threads");
  const hash = settings.settings.find((o) => o.name === "Hash");
  const activeTab = useAtomValue(activeTabAtom);

  const setGoMode = useCallback(
    (v: GoMode) => {
      setSettings((prev) => ({
        ...prev,
        go: v,
      }));
    },
    [setSettings],
  );

  return (
    <Stack>
      {!remote && (
        <GoModeInput
          gameMode={gameMode}
          goMode={settings.go}
          setGoMode={setGoMode}
        />
      )}

      {!minimal && multipv && (
        <Group grow>
          <Text size="sm" fw="bold">
            {t("Engines.Settings.NumOfLines")}
          </Text>
          <LinesSlider
            value={Number(multipv.value || 1)}
            setValue={(v) =>
              setSettings((prev) => {
                return {
                  ...prev,
                  settings: prev.settings.map((o) =>
                    o.name === "MultiPV" ? { ...o, value: v || 1 } : o,
                  ),
                };
              })
            }
            color={color}
          />
        </Group>
      )}

      {!remote && threads && (
        <>
          <Group grow>
            <Text size="sm" fw="bold">
              {t("Engines.Settings.NumOfCores")}
            </Text>
            <CoresSlider
              value={Number(threads.value || 1)}
              setValue={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  settings: prev.settings.map((o) =>
                    o.name === "Threads" ? { ...o, value: v || 1 } : o,
                  ),
                }))
              }
              color={color}
            />
          </Group>

          {hash && (
            <Group grow>
              <Text size="sm" fw="bold">
                {t("Engines.Settings.SizeOfHash")}
              </Text>
              <HashSlider
                value={Number(hash.value || 1)}
                setValue={(v) =>
                  setSettings((prev) => ({
                    ...prev,
                    settings: prev.settings.map((o) =>
                      o.name === "Hash" ? { ...o, value: v || 1 } : o,
                    ),
                  }))
                }
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
            {engine.type === "local" && (
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
    () => engines.find((o) => o.name === engine)!,
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
              selected: engines.findIndex((o) => o.name === engineName),
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
