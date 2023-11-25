import {
  activeTabAtom,
  engineMovesFamily,
  tabEngineSettingsFamily,
} from "@/atoms/atoms";
import { commands, events } from "@/bindings";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { swapMove } from "@/utils/chess";
import { Engine } from "@/utils/engines";
import { unwrap } from "@/utils/invoke";
import { useThrottledEffect } from "@/utils/misc";
import { formatScore } from "@/utils/score";
import {
  Accordion,
  ActionIcon,
  Box,
  Code,
  Group,
  Progress,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
  createStyles,
  useMantineTheme,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
  IconTargetArrow,
} from "@tabler/icons-react";
import { Chess } from "chess.js";
import { useAtom, useAtomValue } from "jotai";
import {
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { match } from "ts-pattern";
import AnalysisRow from "./AnalysisRow";
import EngineSettings from "./EngineSettings";

const useStyles = createStyles((theme) => ({
  subtitle: {
    color:
      theme.colorScheme === "dark"
        ? theme.fn.rgba(theme.white, 0.65)
        : theme.black,
  },
}));

interface BestMovesProps {
  id: number;
  engine: Engine;
  setArrows: (arrows: string[]) => void;
  fen: string;
  halfMoves: number;
}

export default function BestMovesComponent({
  id,
  engine,
  setArrows,
  fen,
  halfMoves,
}: BestMovesProps) {
  const dispatch = useContext(TreeDispatchContext);
  const activeTab = useAtomValue(activeTabAtom);
  const [ev, setEngineVariation] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! })
  );
  const [settings, setSettings] = useAtom(
    tabEngineSettingsFamily({ engine: engine.name, tab: activeTab! })
  );

  const engineVariations = useMemo(() => ev.get(fen) ?? [], [ev, fen]);

  const [settingsOn, toggleSettingsOn] = useToggle();
  const [threat, toggleThreat] = useToggle();
  const { classes } = useStyles();
  const depth = engineVariations[0]?.depth ?? 0;
  const nps = Math.floor(engineVariations[0]?.nps / 1000 ?? 0);
  const progress = match(settings.go)
    .with({ t: "Depth" }, ({ c }) => (depth / c) * 100)
    .with({ t: "Infinite" }, () => 99.9)
    .otherwise(() => 0);
  const theme = useMantineTheme();
  const listeners = useRef<(() => void)[]>([]);

  const isGameOver = useMemo(() => {
    const chess = new Chess(fen);
    return chess.isGameOver();
  }, [fen]);

  useEffect(() => {
    async function waitForMove() {
      const unlisten = await events.bestMovesPayload.listen(({ payload }) => {
        const ev = payload.bestLines;
        if (
          payload.engine === engine.path &&
          payload.tab === activeTab &&
          settings.enabled &&
          !isGameOver
        ) {
          startTransition(() => {
            setEngineVariation((prev) => {
              const newMap = new Map(prev);
              newMap.set(fen, ev);
              return newMap;
            });
            dispatch({
              type: "SET_SCORE",
              payload: ev[0].score,
            });
            if (id === 0) {
              setArrows(
                ev.map((ev) => {
                  return ev.uciMoves[0];
                })
              );
            }
          });
        }
      });
      listeners.current.push(unlisten);
    }
    waitForMove();
    return () => {
      listeners.current.forEach((unlisten) => unlisten());
    };
  }, [
    activeTab,
    dispatch,
    engine.path,
    id,
    setArrows,
    settings.enabled,
    isGameOver,
    fen,
  ]);

  useThrottledEffect(
    () => {
      if (settings.enabled) {
        const chess = new Chess(fen);
        if (chess.isGameOver()) {
          commands.stopEngine(engine.path, activeTab!);
        } else {
          commands
            .getBestMoves(engine.path, activeTab!, settings.go, {
              fen: threat ? swapMove(fen) : fen,
              multipv: settings.options.multipv,
              hash: settings.options.hash,
              threads: settings.options.threads,
              extraOptions: settings.options.extraOptions,
            })
            .then((res) => {
              const bestMoves = unwrap(res);
              if (bestMoves) {
                setEngineVariation((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(fen, bestMoves);
                  return newMap;
                });
              }
            });
        }
      } else {
        commands.stopEngine(engine.path, activeTab!).then((r) => unwrap(r));
      }
    },
    50,
    [settings.enabled, settings.options, settings.go, threat, fen]
  );

  return useMemo(
    () => (
      <>
        <Box sx={{ display: "flex" }}>
          <Stack spacing={0} py="1rem">
            <ActionIcon
              size="lg"
              variant={settings.enabled ? "filled" : "transparent"}
              color={theme.primaryColor}
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

          <Accordion.Control sx={{ flex: 1 }}>
            <Group position="apart">
              <Group align="center">
                <Text fw="bold" fz="xl">
                  {engine.name}
                </Text>
                {settings.enabled &&
                  !isGameOver &&
                  engineVariations.length === 0 && <Code fz="xs">Loading...</Code>}
                {progress < 100 &&
                  settings.enabled &&
                  !isGameOver &&
                  engineVariations.length > 0 && (
                    <Tooltip label={"How fast the engine is running"}>
                      <Code fz="xs">{nps}k nodes/s</Code>
                    </Tooltip>
                  )}
              </Group>
              <Group spacing="lg">
                {!isGameOver && engineVariations.length > 0 && (
                  <>
                    <Stack align="center" spacing={0}>
                      <Text
                        size="0.7rem"
                        transform="uppercase"
                        weight={700}
                        className={classes.subtitle}
                      >
                        Eval
                      </Text>
                      <Text fw="bold" fz="md">
                        {formatScore(engineVariations[0].score, 1) ?? 0}
                      </Text>
                    </Stack>
                    <Stack align="center" spacing={0}>
                      <Text
                        size="0.7rem"
                        transform="uppercase"
                        weight={700}
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
          <Tooltip label="Check the opponent's threat">
            <ActionIcon
              size="lg"
              onClick={() => toggleThreat()}
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
            mr={8}
            mt="auto"
            mb="auto"
          >
            <IconSettings size="1rem" />
          </ActionIcon>
        </Box>
        <EngineSettings
          engine={engine.name}
          settingsOn={settingsOn}
          settings={settings}
          setSettings={setSettings}
        />

        <Progress
          value={isGameOver ? 0 : progress}
          animate={progress < 100 && settings.enabled && !isGameOver}
          size="xs"
          striped={progress < 100 && !settings.enabled}
          // color={threat ? "red" : "blue"}
          color={threat ? "red" : theme.primaryColor}
        />
        <Accordion.Panel>
          <Table>
            <tbody>
              {isGameOver && (
                <tr>
                  <td>
                    <Text align="center" my="lg">
                      {"Game is over"}
                    </Text>
                  </td>
                </tr>
              )}
              {!isGameOver &&
                engineVariations.length === 0 &&
                (settings.enabled ? (
                  [...Array(settings.options.multipv)].map((_, i) => (
                    <tr key={i}>
                      <td>
                        <Skeleton height={35} radius="xl" p={5} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>
                      <Text align="center" my="lg">
                        {"Engine isn't enabled"}
                      </Text>
                    </td>
                  </tr>
                ))}
              {!isGameOver &&
                engineVariations.map((engineVariation, index) => {
                  return (
                    <AnalysisRow
                      key={index}
                      moves={engineVariation.sanMoves}
                      score={engineVariation.score}
                      halfMoves={halfMoves}
                      threat={threat}
                    />
                  );
                })}
            </tbody>
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
    ]
  );
}
