import { enginesAtom } from "@/atoms/atoms";
import { GoMode } from "@/bindings";
import GoModeInput from "@/components/common/GoModeInput";
import { EngineSettings } from "@/utils/engines";
import {
  ActionIcon,
  Group,
  MantineColor,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconReload, IconSettings } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import React, { memo } from "react";
import { useNavigate } from "react-router-dom";
import CoresSlider from "./CoresSlider";
import HashSlider from "./HashSlider";
import LinesSlider from "./LinesSlider";

interface EngineSettingsProps {
  engineName: string;
  settings: { enabled: boolean; go: GoMode; settings: EngineSettings };
  setSettings: (
    fn: (prev: { enabled: boolean; go: GoMode; settings: EngineSettings }) => {
      enabled: boolean;
      go: GoMode;
      settings: EngineSettings;
    },
  ) => void;
  color?: MantineColor;
  minimal?: boolean;
  remote: boolean;
  gameMode?: boolean;
}

function EngineSettingsForm({
  engineName,
  settings,
  setSettings,
  color,
  minimal,
  remote,
  gameMode,
}: EngineSettingsProps) {
  const multipv = settings.settings.find((o) => o.name === "MultiPV");
  const threads = settings.settings.find((o) => o.name === "Threads");
  const hash = settings.settings.find((o) => o.name === "Hash");

  return (
    <Stack>
      {!remote && (
        <GoModeInput
          gameMode={gameMode}
          goMode={settings.go}
          setGoMode={(v) => setSettings((prev) => ({ ...prev, go: v }))}
        />
      )}

      {!minimal && multipv && (
        <Group grow>
          <Text size="sm" fw="bold">
            Number of Lines
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
              Number of cores
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
                Size of Hash
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
      <Group>
        <ReloadSettings engine={engineName} setSettings={setSettings} />

        <AdvancedSettings engineName={engineName} />
      </Group>
    </Stack>
  );
}

function ReloadSettings({
  engine,
  setSettings,
}: {
  engine: string;
  setSettings: (
    fn: (prev: { enabled: boolean; go: GoMode; settings: EngineSettings }) => {
      enabled: boolean;
      go: GoMode;
      settings: EngineSettings;
    },
  ) => void;
}) {
  const engines = useAtomValue(enginesAtom);
  const engineDefault = engines.find((o) => o.name === engine)!;
  return (
    <Tooltip label="Reset to engine default">
      <ActionIcon
        size="xs"
        onClick={() => {
          setSettings((prev) => ({
            ...prev,
            go: engineDefault.go || prev.go,
            settings: engineDefault.settings || prev.settings,
          }));
        }}
      >
        <IconReload />
      </ActionIcon>
    </Tooltip>
  );
}

function AdvancedSettings({ engineName }: { engineName: string }) {
  const navigate = useNavigate();
  const engines = useAtomValue(enginesAtom);

  return (
    <Tooltip label="Advanced settings">
      <ActionIcon
        size="xs"
        onClick={() =>
          navigate(
            `/engines?load=${engines.findIndex((o) => o.name === engineName)}`,
          )
        }
      >
        <IconSettings />
      </ActionIcon>
    </Tooltip>
  );
}

export default memo(EngineSettingsForm);
