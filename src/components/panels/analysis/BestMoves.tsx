import { events, type EngineOptions, type GoMode } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  engineMovesFamily,
  enginesAtom,
  tabEngineSettingsFamily,
} from "@/state/atoms";
import { getBestMoves as chessdbGetBestMoves } from "@/utils/chessdb/api";
import { chessopsError, positionFromFen, swapMove } from "@/utils/chessops";
import {
  type Engine,
  type LocalEngine,
  getBestMoves as localGetBestMoves,
  stopEngine,
} from "@/utils/engines";
import { formatNodes } from "@/utils/format";
import { getBestMoves as lichessGetBestMoves } from "@/utils/lichess/api";
import { useThrottledEffect } from "@/utils/misc";
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
import {
  memo,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { match } from "ts-pattern";
import { useZustand as useStore } from "use-zustand";
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
  chess960: boolean;
}

function BestMovesComponent({
  id,
  engine,
  fen,
  moves,
  halfMoves,
  dragHandleProps,
  orientation,
  chess960,
}: BestMovesProps) {
  const store = useContext(TreeStateContext)!;
  const setScore = useStore(store, (s) => s.setScore);
  const activeTab = useAtomValue(activeTabAtom);
  const [ev, setEngineVariation] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! }),
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
  const [threat, toggleThreat] = useToggle();
  const theme = useMantineTheme();
  const [progress, setProgress] = useState(0);

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

  const engineVariations = useMemo(
    () => ev.get(`${searchingFen}:${searchingMoves.join(",")}`),
    [ev, searchingFen, searchingMoves],
  );

  const isComputed = engineVariations && engineVariations.length > 0;
  const depth = isComputed ? engineVariations[0].depth : 0;
  const nps = isComputed ? formatNodes(engineVariations[0].nps) : 0;

  useEffect(() => {
    const unlisten = events.bestMovesPayload.listen(({ payload }) => {
      const ev = payload.bestLines;
      if (
        payload.engine === engine.name &&
        payload.tab === activeTab &&
        payload.fen === searchingFen &&
        payload.moves.join(",") === searchingMoves.join(",") &&
        settings.enabled &&
        !isGameOver
      ) {
        startTransition(() => {
          setEngineVariation((prev) => {
            const newMap = new Map(prev);
            newMap.set(`${searchingFen}:${searchingMoves.join(",")}`, ev);
            if (threat) {
              newMap.delete(`${fen}:${moves.join(",")}`);
            } else if (finalFen) {
              newMap.delete(`${swapMove(finalFen)}:`);
            }
            return newMap;
          });
          setProgress(payload.progress);
          setScore(ev[0].score);
        });
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [
    activeTab,
    setScore,
    settings.enabled,
    isGameOver,
    searchingFen,
    JSON.stringify(searchingMoves),
    engine.name,
    setEngineVariation,
  ]);

  const getBestMoves = useMemo(
    () =>
      match(engine.type)
        .with(
          "local",
          () => (fen: string, goMode: GoMode, options: EngineOptions) =>
            localGetBestMoves(engine as LocalEngine, fen, goMode, options),
        )
        .with("chessdb", () => chessdbGetBestMoves)
        .with("lichess", () => lichessGetBestMoves)
        .exhaustive(),
    [engine.type, engine],
  );

  useThrottledEffect(
    () => {
      if (settings.enabled) {
        if (isGameOver) {
          if (engine.type === "local") {
            stopEngine(engine, activeTab!);
          }
        } else {
          const options =
            settings.settings?.map((s) => ({
              name: s.name,
              value: s.value?.toString() || "",
            })) ?? [];
          if (chess960 && !options.find((o) => o.name === "UCI_Chess960")) {
            options.push({ name: "UCI_Chess960", value: "true" });
          }
          getBestMoves(activeTab!, settings.go, {
            moves: searchingMoves,
            fen: searchingFen,
            extraOptions: options,
          }).then((moves) => {
            if (moves) {
              const [progress, bestMoves] = moves;
              setEngineVariation((prev) => {
                const newMap = new Map(prev);
                newMap.set(
                  `${searchingFen}:${searchingMoves.join(",")}`,
                  bestMoves,
                );
                return newMap;
              });
              setProgress(progress);
            }
          });
        }
      } else {
        if (engine.type === "local") {
          stopEngine(engine, activeTab!);
        }
      }
    },
    50,
    [
      settings.enabled,
      JSON.stringify(settings.settings),
      settings.go,
      searchingFen,
      JSON.stringify(searchingMoves),
      isGameOver,
      activeTab,
      getBestMoves,
      setEngineVariation,
      engine,
    ],
  );

  return useMemo(
    () => (
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
            <Group justify="space-between">
              <Group align="center">
                <Text fw="bold" fz="xl">
                  {engine.name}
                </Text>
                {settings.enabled &&
                  !isGameOver &&
                  !error &&
                  !engineVariations && <Code fz="xs">Loading...</Code>}
                {progress < 100 &&
                  settings.enabled &&
                  !isGameOver &&
                  engineVariations &&
                  engineVariations.length > 0 && (
                    <Tooltip label={"How fast the engine is running"}>
                      <Code fz="xs">{nps} nodes/s</Code>
                    </Tooltip>
                  )}
              </Group>
              <Group gap="lg">
                {!isGameOver &&
                  engineVariations &&
                  engineVariations.length > 0 && (
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
                          {formatScore(engineVariations[0].score, 1) ?? 0}
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
          </Accordion.Control>
          <ActionIcon.Group>
            <Tooltip label="Check the opponent's threat">
              <ActionIcon
                size="lg"
                onClick={() => toggleThreat()}
                disabled={!settings.enabled}
                variant="transparent"
                mt="auto"
                mb="auto"
              >
                <IconTargetArrow
                  color={threat ? "red" : undefined}
                  size="1rem"
                />
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
        <Accordion.Panel>
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
                        {"Engine isn't enabled"}
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
    ),
    [
      settings,
      theme.primaryColor,
      isGameOver,
      engine.name,
      engineVariations,
      progress,
      nps,
      classes.subtitle,
      depth,
      threat,
      settingsOn,
      setSettings,
      toggleThreat,
      toggleSettingsOn,
      halfMoves,
      orientation,
    ],
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
