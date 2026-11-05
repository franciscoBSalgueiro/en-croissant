import {
  Center,
  Divider,
  Group,
  InputWrapper,
  NumberInput,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconCpu, IconUser } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { GoMode } from "@/bindings";
import GoModeInput from "@/components/common/GoModeInput";
import TimeInput, { type TimeType } from "@/components/common/TimeInput";
import EngineSettingsForm from "@/components/panels/analysis/EngineSettingsForm";
import type { TimeControlField } from "@/utils/clock";
import type { EngineSettings, LocalEngine } from "@/utils/engines";
import { IS_MOBILE_APP } from "@/utils/mobile";
import {
  STOCKFISH_MAX_ELO,
  STOCKFISH_MIN_ELO,
  STOCKFISH_NATIVE_MIN_ELO,
} from "@/utils/stockfish";
import { EnginesSelect } from "./EnginesSelect";

const DEFAULT_ELO = 1500;

/** Rough guide so the number means something. */
function eloLabel(elo: number) {
  if (elo < 500) return "lernt gerade die Regeln";
  if (elo < 900) return "Anfänger";
  if (elo < 1200) return "Gelegenheitsspieler";
  if (elo < 1500) return "Hobbyspieler";
  if (elo < 1800) return "Vereinsspieler";
  if (elo < 2100) return "starker Vereinsspieler";
  if (elo < 2400) return "Experte / Meisterkandidat";
  if (elo < 2700) return "Großmeister";
  return "Weltspitze";
}

function EloInput({
  elo,
  setElo,
  compact,
}: {
  elo: number | null;
  setElo: (elo: number | null) => void;
  compact: boolean;
}) {
  const limited = elo !== null;
  const value = elo ?? STOCKFISH_MAX_ELO;
  return (
    <Stack gap={6}>
      <Switch
        size={compact ? "xs" : "sm"}
        label="Elo begrenzen"
        checked={limited}
        onChange={(e) => setElo(e.currentTarget.checked ? DEFAULT_ELO : null)}
      />
      {limited ? (
        <>
          <Group gap={6} wrap="nowrap" align="center">
            <Text size={compact ? "xs" : "sm"} fw={600} style={{ flexShrink: 0 }}>
              Elo
            </Text>
            <NumberInput
              size="xs"
              min={STOCKFISH_MIN_ELO}
              max={STOCKFISH_MAX_ELO}
              step={10}
              clampBehavior="blur"
              value={value}
              onChange={(v) => typeof v === "number" && setElo(v)}
              style={{ flex: 1, minWidth: 0 }}
            />
          </Group>
          <Slider
            size="sm"
            min={STOCKFISH_MIN_ELO}
            max={STOCKFISH_MAX_ELO}
            step={10}
            value={value}
            onChange={setElo}
            label={(v) => `${v} Elo`}
          />
          <Text size="xs" c="dimmed">
            ≈ {eloLabel(value)}
            {value < STOCKFISH_NATIVE_MIN_ELO ? " · unter 1320 nur geschätzt" : ""}
          </Text>
        </>
      ) : (
        <Text size="xs" c="dimmed">
          Volle Stärke (ca. 3500+ Elo)
        </Text>
      )}
    </Stack>
  );
}

export type OpponentSettings =
  | {
      type: "human";
      timeControl?: TimeControlField;
      name?: string;
      timeUnit?: TimeType;
      incrementUnit?: TimeType;
    }
  | {
      type: "engine";
      timeControl?: TimeControlField;
      engine: LocalEngine | null;
      /** Built-in Stockfish 19 (WebAssembly) instead of an engine program. */
      builtin?: boolean;
      /** Strength of the built-in engine; null = full strength. */
      elo?: number | null;
      go: GoMode;
      engineSettings?: EngineSettings;
      timeUnit?: TimeType;
      incrementUnit?: TimeType;
    };

export const DEFAULT_TIME_CONTROL: TimeControlField = {
  seconds: 180_000,
  increment: 2_000,
};

export function OpponentForm({
  compact = false,
  sameTimeControl,
  opponent,
  setOpponent,
  setOtherOpponent,
}: {
  /** Smaller controls for phones/tablets. */
  compact?: boolean;
  sameTimeControl: boolean;
  opponent: OpponentSettings;
  setOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  setOtherOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
}) {
  const { t } = useTranslation();

  function updateType(type: "engine" | "human") {
    if (type === "human") {
      setOpponent((prev) => ({
        ...prev,
        type: "human",
        name: "Player",
      }));
    } else {
      setOpponent((prev) => ({
        ...prev,
        type: "engine",
        engine: null,
        // iOS can't run engine programs: use the built-in Stockfish there.
        builtin: IS_MOBILE_APP || ("builtin" in prev && !!prev.builtin),
        elo: "elo" in prev && prev.elo !== undefined ? prev.elo : DEFAULT_ELO,
        go: ("go" in prev && prev.go) || (IS_MOBILE_APP ? { t: "Time", c: 1500 } : { t: "Depth", c: 24 }),
      }));
    }
  }

  const size = compact ? "xs" : "sm";
  const iconSize = compact ? 14 : 16;

  return (
    <Stack flex={1} gap={compact ? "xs" : "md"} miw={0}>
      <SegmentedControl
        size={size}
        fullWidth
        data={[
          {
            value: "human",
            label: (
              <Center style={{ gap: compact ? 4 : 10 }}>
                <IconUser size={iconSize} />
                <span>{t("Board.Opponent.Human")}</span>
              </Center>
            ),
          },
          {
            value: "engine",
            label: (
              <Center style={{ gap: compact ? 4 : 10 }}>
                <IconCpu size={iconSize} />
                <span>{t("Common.Engine")}</span>
              </Center>
            ),
          },
        ]}
        value={opponent.type}
        onChange={(v) => updateType(v as "human" | "engine")}
      />

      {opponent.type === "human" && (
        <TextInput
          size={size}
          value={opponent.name ?? ""}
          onChange={(e) => setOpponent((prev) => ({ ...prev, name: e.target.value }))}
        />
      )}

      {opponent.type === "engine" && (
        <EnginesSelect
          engine={opponent.engine}
          builtin={!!opponent.builtin}
          setBuiltin={() =>
            setOpponent((prev) => ({
              ...prev,
              builtin: true,
              engine: null,
              elo: "elo" in prev && prev.elo !== undefined ? prev.elo : DEFAULT_ELO,
            }))
          }
          setEngine={(engine) =>
            setOpponent((prev) => ({
              ...prev,
              builtin: false,
              engine,
              engineSettings: engine?.settings || undefined,
            }))
          }
        />
      )}

      {opponent.type === "engine" && opponent.builtin && (
        <EloInput
          compact={compact}
          elo={opponent.elo ?? null}
          setElo={(elo) =>
            setOpponent((prev) => (prev.type === "engine" ? { ...prev, elo } : prev))
          }
        />
      )}

      <Divider variant="dashed" label={t("Board.Opponent.TimeSettings")} />
      <SegmentedControl
        size={size}
        fullWidth
        data={[
          { value: "time", label: t("GoMode.Time") },
          { value: "unlimited", label: t("Board.Opponent.Unlimited") },
        ]}
        value={opponent.timeControl ? "time" : "unlimited"}
        onChange={(v) => {
          setOpponent((prev) => ({
            ...prev,
            timeControl: v === "time" ? DEFAULT_TIME_CONTROL : undefined,
          }));
          if (sameTimeControl) {
            setOtherOpponent((prev) => ({
              ...prev,
              timeControl: v === "time" ? DEFAULT_TIME_CONTROL : undefined,
            }));
          }
        }}
      />
      <Group grow wrap="nowrap" gap={compact ? 6 : "md"}>
        {opponent.timeControl && (
          <>
            <InputWrapper label={t("GoMode.Time")} size={size}>
              <TimeInput
                compact={compact}
                defaultType="m"
                type={opponent.timeUnit}
                onTypeChange={(t) => {
                  setOpponent((prev) => ({ ...prev, timeUnit: t }));
                  if (sameTimeControl) {
                    setOtherOpponent((prev) => ({ ...prev, timeUnit: t }));
                  }
                }}
                value={opponent.timeControl.seconds}
                setValue={(v) => {
                  setOpponent((prev) => ({
                    ...prev,
                    timeControl: {
                      seconds: v.t === "Time" ? v.c : 0,
                      increment: prev.timeControl?.increment ?? 0,
                    },
                  }));
                  if (sameTimeControl) {
                    setOtherOpponent((prev) => ({
                      ...prev,
                      timeControl: {
                        seconds: v.t === "Time" ? v.c : 0,
                        increment: prev.timeControl?.increment ?? 0,
                      },
                    }));
                  }
                }}
              />
            </InputWrapper>
            <InputWrapper label={t("Board.Opponent.Increment")} size={size}>
              <TimeInput
                compact={compact}
                defaultType="s"
                type={opponent.incrementUnit}
                onTypeChange={(t) => {
                  setOpponent((prev) => ({ ...prev, incrementUnit: t }));
                  if (sameTimeControl) {
                    setOtherOpponent((prev) => ({ ...prev, incrementUnit: t }));
                  }
                }}
                value={opponent.timeControl.increment ?? 0}
                setValue={(v) => {
                  setOpponent((prev) => ({
                    ...prev,
                    timeControl: {
                      seconds: prev.timeControl?.seconds ?? 0,
                      increment: v.t === "Time" ? v.c : 0,
                    },
                  }));
                  if (sameTimeControl) {
                    setOtherOpponent((prev) => ({
                      ...prev,
                      timeControl: {
                        seconds: prev.timeControl?.seconds ?? 0,
                        increment: v.t === "Time" ? v.c : 0,
                      },
                    }));
                  }
                }}
              />
            </InputWrapper>
          </>
        )}
      </Group>

      {opponent.type === "engine" && (
        <Stack gap={compact ? "xs" : "md"}>
          {!opponent.timeControl && (
            <GoModeInput
              gameMode
              goMode={opponent.go}
              setGoMode={(go) =>
                setOpponent((prev) => {
                  if (prev.type === "human") {
                    return prev;
                  }
                  return {
                    ...prev,
                    go,
                  };
                })
              }
            />
          )}
          {!opponent.builtin && (
            <Divider variant="dashed" label={t("Board.Opponent.EngineSettings", "Engine Settings")} />
          )}
          {opponent.engine && !opponent.builtin && (
            <EngineSettingsForm
              engine={opponent.engine}
              remote={false}
              gameMode
              settings={{
                go: opponent.go,
                settings: opponent.engineSettings || opponent.engine.settings || [],
                enabled: true,
                synced: false,
              }}
              setSettings={(fn) =>
                setOpponent((prev) => {
                  if (prev.type === "human") {
                    return prev;
                  }
                  const newSettings = fn({
                    go: prev.go,
                    settings: prev.engineSettings || prev.engine?.settings || [],
                    enabled: true,
                    synced: false,
                  });
                  return {
                    ...prev,
                    go: newSettings.go,
                    engineSettings: newSettings.settings,
                  };
                })
              }
              minimal={true}
            />
          )}
        </Stack>
      )}
    </Stack>
  );
}
