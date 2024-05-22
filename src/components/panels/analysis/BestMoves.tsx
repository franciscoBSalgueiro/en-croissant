import type { BestMoves } from "@/bindings";
import {
  activeTabAtom,
  currentThreatAtom,
  engineMovesFamily,
  engineProgressFamily,
  enginesAtom,
  tabEngineSettingsFamily,
} from "@/state/atoms";
import { chessopsError, positionFromFen, swapMove } from "@/utils/chessops";
import type { Engine } from "@/utils/engines";
import { formatNodes } from "@/utils/format";
import { formatScore } from "@/utils/score";
import {
  Accordion,
  ActionIcon,
  Box,
  Code,
  Collapse,
  Group,
  Progress,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import {
  IconGripVertical,
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
  IconTargetArrow,
} from "@tabler/icons-react";
import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import { memo, useCallback, useDeferredValue, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import AnalysisRow from "./AnalysisRow";
import * as classes from "./BestMoves.css";
import EngineSettingsForm, { type Settings } from "./EngineSettingsForm";

export const arrowColors = [
  { strong: "blue", pale: "paleBlue" },
  { strong: "green", pale: "paleGreen" },
  { strong: "red", pale: "paleRed" },
  { strong: "yellow", pale: "yellow" }, // there's no paleYellow in chessground
];

interface BestMovesProps {
  id: number;
  engine: Engine;
  fen: string;
  moves: string[];
  halfMoves: number;
  dragHandleProps: any;
  orientation: "white" | "black";
}

function BestMovesComponent({
  id,
  engine,
  fen,
  moves,
  halfMoves,
  dragHandleProps,
  orientation,
}: BestMovesProps) {
  const { t } = useTranslation();

  const activeTab = useAtomValue(activeTabAtom);
  const ev = useAtomValue(
    engineMovesFamily({ engine: engine.name, tab: activeTab! }),
  );
  const progress = useAtomValue(
    engineProgressFamily({ engine: engine.name, tab: activeTab! }),
  );
  const [, setEngines] = useAtom(enginesAtom);
  const [settings, setSettings2] = useAtom(
    tabEngineSettingsFamily({
      engineName: engine.name,
      defaultSettings: engine.settings ?? undefined,
      defaultGo: engine.go ?? undefined,
      tab: activeTab!,
    }),
  );

  useEffect(() => {
    if (settings.synced) {
      setSettings2((prev) => ({
        ...prev,
        go: engine.go || prev.go,
        settings: engine.settings || prev.settings,
      }));
    }
  }, [engine.settings, engine.go, settings.synced, setSettings2]);

  const setSettings = useCallback(
    (fn: (prev: Settings) => Settings) => {
      const newSettings = fn(settings);
      setSettings2(newSettings);
      if (newSettings.synced) {
        setEngines(async (prev) =>
          (await prev).map((o) =>
            o.name === engine.name
              ? { ...o, settings: newSettings.settings, go: newSettings.go }
              : o,
          ),
        );
      }
    },
    [engine, settings, setSettings2, setEngines],
  );

  const [settingsOn, toggleSettingsOn] = useToggle();
  const [threat, setThreat] = useAtom(currentThreatAtom);
  const theme = useMantineTheme();

  const [pos, error] = positionFromFen(fen);
  if (pos) {
    for (const uci of moves) {
      const move = parseUci(uci);
      if (!move) {
        console.log("Invalid move", uci);
        break;
      }
      pos.play(move);
    }
  }

  const isGameOver = pos?.isEnd() ?? false;
  const finalFen = useMemo(() => (pos ? makeFen(pos.toSetup()) : null), [pos]);

  const { searchingFen, searchingMoves } = useMemo(
    () =>
      match(threat)
        .with(true, () => ({
          searchingFen: swapMove(finalFen || INITIAL_FEN),
          searchingMoves: [],
        }))
        .with(false, () => ({
          searchingFen: fen,
          searchingMoves: moves,
        }))
        .exhaustive(),
    [fen, moves, threat, finalFen],
  );

  const engineVariations = useDeferredValue(
    useMemo(
      () => ev.get(`${searchingFen}:${searchingMoves.join(",")}`),
      [ev, searchingFen, searchingMoves],
    ),
  );

  return (
    <>
      <Box style={{ display: "flex" }}>
        <Stack gap={0} py="1rem">
          <ActionIcon
            size="lg"
            variant={settings.enabled ? "filled" : "transparent"}
            color={id < 4 ? arrowColors[id].strong : theme.primaryColor}
            onClick={() => {
              setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
            }}
            ml={12}
          >
            {settings.enabled ? (
              <IconPlayerPause size="1rem" />
            ) : (
              <IconPlayerPlay size="1rem" />
            )}
          </ActionIcon>
        </Stack>
        <Accordion.Control>
          <EngineTop
            name={engine.name}
            engineVariations={engineVariations}
            isGameOver={isGameOver}
            enabled={settings.enabled}
            progress={progress}
            error={error}
          />
        </Accordion.Control>
        <ActionIcon.Group>
          <Tooltip label="Check the opponent's threat">
            <ActionIcon
              size="lg"
              onClick={() => setThreat(!threat)}
              disabled={!settings.enabled}
              variant="transparent"
              mt="auto"
              mb="auto"
            >
              <IconTargetArrow color={threat ? "red" : undefined} size="1rem" />
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            size="lg"
            onClick={() => toggleSettingsOn()}
            mt="auto"
            mb="auto"
          >
            <IconSettings size="1rem" />
          </ActionIcon>
          <ActionIcon
            size="lg"
            mr={8}
            mt="auto"
            mb="auto"
            style={{
              cursor: "grab",
            }}
            {...dragHandleProps}
          >
            <IconGripVertical size="1rem" />
          </ActionIcon>
        </ActionIcon.Group>
      </Box>
      <Collapse in={settingsOn} px={30} pb={15}>
        <EngineSettingsForm
          engine={engine}
          settings={settings}
          setSettings={setSettings}
          color={id < 4 ? arrowColors[id].strong : theme.primaryColor}
          remote={engine.type !== "local"}
        />
      </Collapse>

      <Progress
        value={isGameOver ? 0 : progress}
        animated={progress < 100 && settings.enabled && !isGameOver}
        size="xs"
        striped={progress < 100 && !settings.enabled}
        color={id < 4 ? arrowColors[id].strong : theme.primaryColor}
      />
      <Accordion.Panel pos="relative">
        <Table>
          <Table.Tbody>
            {error && (
              <Table.Tr>
                <Table.Td>
                  <Text ta="center" my="lg">
                    Invalid position: {chessopsError(error)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {isGameOver && (
              <Table.Tr>
                <Table.Td>
                  <Text ta="center" my="lg">
                    Game is over
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {engineVariations &&
              engineVariations.length === 0 &&
              !isGameOver && (
                <Table.Tr>
                  <Table.Td>
                    <Text ta="center" my="lg">
                      No analysis available
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            {!isGameOver &&
              !error &&
              !engineVariations &&
              (settings.enabled ? (
                [
                  ...Array(
                    settings.settings.find((s) => s.name === "MultiPV")
                      ?.value ?? 1,
                  ),
                ].map((_, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Skeleton height={35} radius="xl" p={5} />
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td>
                    <Text ta="center" my="lg">
                      {t("Board.Analysis.InactiveEngine")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            {!isGameOver &&
              !error &&
              finalFen &&
              engineVariations &&
              engineVariations.map((engineVariation, index) => {
                return (
                  <AnalysisRow
                    key={index}
                    engine={engine.name}
                    moves={engineVariation.sanMoves}
                    score={engineVariation.score}
                    halfMoves={halfMoves}
                    threat={threat}
                    fen={threat ? swapMove(finalFen) : finalFen}
                    orientation={orientation}
                  />
                );
              })}
          </Table.Tbody>
        </Table>
      </Accordion.Panel>
    </>
  );
}

function EngineTop({
  name,
  engineVariations,
  isGameOver,
  enabled,
  progress,
  error,
}: {
  name: string;
  engineVariations: BestMoves[] | undefined;
  isGameOver: boolean;
  enabled: boolean;
  progress: number;
  error: any;
}) {
  const isComputed = engineVariations && engineVariations.length > 0;
  const depth = isComputed ? engineVariations[0].depth : 0;
  const nps = isComputed ? formatNodes(engineVariations[0].nps) : 0;

  return (
    <Group justify="space-between">
      <Group align="center">
        <Text fw="bold" fz="xl">
          {name}
        </Text>
        {enabled && !isGameOver && !error && !engineVariations && (
          <Code fz="xs">Loading...</Code>
        )}
        {progress < 100 &&
          enabled &&
          !isGameOver &&
          engineVariations &&
          engineVariations.length > 0 && (
            <Tooltip label={"How fast the engine is running"}>
              <Code fz="xs">{nps} nodes/s</Code>
            </Tooltip>
          )}
      </Group>
      <Group gap="lg">
        {!isGameOver && engineVariations && engineVariations.length > 0 && (
          <>
            <Stack align="center" gap={0}>
              <Text
                size="0.7rem"
                tt="uppercase"
                fw={700}
                className={classes.subtitle}
              >
                Eval
              </Text>
              <Text fw="bold" fz="md">
                {formatScore(engineVariations[0].score.value, 1) ?? 0}
              </Text>
            </Stack>
            <Stack align="center" gap={0}>
              <Text
                size="0.7rem"
                tt="uppercase"
                fw={700}
                className={classes.subtitle}
              >
                Depth
              </Text>
              <Text fw="bold" fz="md">
                {depth}
              </Text>
            </Stack>
          </>
        )}
      </Group>
    </Group>
  );
}

export default memo(BestMovesComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.engine === next.engine &&
    prev.fen === next.fen &&
    equal(prev.moves, next.moves) &&
    prev.halfMoves === next.halfMoves &&
    prev.orientation === next.orientation
  );
});
