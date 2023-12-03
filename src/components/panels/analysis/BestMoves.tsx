import {
  activeTabAtom,
  currentArrowsAtom,
  engineMovesFamily,
  tabEngineSettingsFamily,
} from "@/atoms/atoms";
import { events } from "@/bindings";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { swapMove } from "@/utils/chessops";
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
import { useAtom, useAtomValue } from "jotai";
import {
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AnalysisRow from "./AnalysisRow";
import EngineSettingsForm from "./EngineSettingsForm";
import { Engine } from "@/utils/engines";
import { chessopsError, positionFromFen } from "@/utils/chessops";

const useStyles = createStyles((theme) => ({
  subtitle: {
    color:
      theme.colorScheme === "dark"
        ? theme.fn.rgba(theme.white, 0.65)
        : theme.black,
  },
}));

export const arrowColors = ["blue", "green", "red", "yellow"];

interface BestMovesProps {
  id: number;
  engine: Engine;
  fen: string;
  halfMoves: number;
}

export default function BestMovesComponent({
  id,
  engine,
  fen,
  halfMoves,
}: BestMovesProps) {
  const dispatch = useContext(TreeDispatchContext);
  const activeTab = useAtomValue(activeTabAtom);
  const [ev, setEngineVariation] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! })
  );
  const [settings, setSettings] = useAtom(
    tabEngineSettingsFamily({
      engineName: engine.name,
      defaultSettings: engine.settings,
      tab: activeTab!,
    })
  );
  const [, setArrows] = useAtom(currentArrowsAtom);

  const engineVariations = useMemo(() => ev.get(fen) ?? [], [ev, fen]);

  const [settingsOn, toggleSettingsOn] = useToggle();
  const [threat, toggleThreat] = useToggle();
  const { classes } = useStyles();
  const depth = engineVariations[0]?.depth ?? 0;
  const nps = Math.floor(engineVariations[0]?.nps / 1000 ?? 0);
  const theme = useMantineTheme();
  const listeners = useRef<(() => void)[]>([]);
  const [progress, setProgress] = useState(0);

  const [isGameOver, error] = useMemo(() => {
    const [pos, error] = positionFromFen(fen);
    return [pos?.isEnd() ?? false, error];
  }, [fen]);

  useEffect(() => {
    async function waitForMove() {
      const unlisten = await events.bestMovesPayload.listen(({ payload }) => {
        const ev = payload.bestLines;
        if (
          payload.engine === engine.name &&
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
            setProgress(payload.progress);
            dispatch({
              type: "SET_SCORE",
              payload: ev[0].score,
            });
            setArrows((prev) => {
              const newMap = new Map(prev);
              newMap.set(
                id,
                ev.map((ev) => ev.uciMoves[0])
              );
              return newMap;
            });
          });
        }
      });
      listeners.current.push(unlisten);
    }
    waitForMove();
    return () => {
      listeners.current.forEach((unlisten) => unlisten());
    };
  }, [activeTab, dispatch, id, setArrows, settings.enabled, isGameOver, fen]);

  useThrottledEffect(
    () => {
      if (settings.enabled) {
        if (isGameOver) {
          engine.stop(activeTab!);
        } else {
          engine
            .getBestMoves(activeTab!, settings.go, {
              fen: threat ? swapMove(fen) : fen,
              multipv: settings.options.multipv,
              hash: settings.options.hash,
              threads: settings.options.threads,
              extraOptions: settings.options.extraOptions,
            })
            .then((moves) => {
              if (moves) {
                const [progress, bestMoves] = moves;
                setEngineVariation((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(fen, bestMoves);
                  return newMap;
                });
                setProgress(progress);
                setArrows((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(
                    id,
                    bestMoves.map((ev) => ev.uciMoves[0])
                  );
                  return newMap;
                });
              }
            });
        }
      } else {
        engine.stop(activeTab!);
      }
    },
    50,
    [settings.enabled, settings.options, settings.go, threat, fen, isGameOver]
  );

  return useMemo(
    () => (
      <>
        <Box sx={{ display: "flex" }}>
          <Stack spacing={0} py="1rem">
            <ActionIcon
              size="lg"
              variant={settings.enabled ? "filled" : "transparent"}
              color={id < 4 ? arrowColors[id] : theme.primaryColor}
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
                  !error &&
                  engineVariations.length === 0 && (
                    <Code fz="xs">Loading...</Code>
                  )}
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
        <Collapse in={settingsOn} px={30} pb={15}>
          <EngineSettingsForm
            engineName={engine.name}
            settings={settings}
            setSettings={setSettings}
            color={id < 4 ? arrowColors[id] : theme.primaryColor}
            remote={engine.remote}
          />
        </Collapse>

        <Progress
          value={isGameOver ? 0 : progress}
          animate={progress < 100 && settings.enabled && !isGameOver}
          size="xs"
          striped={progress < 100 && !settings.enabled}
          color={id < 4 ? arrowColors[id] : theme.primaryColor}
        />
        <Accordion.Panel>
          <Table>
            <tbody>
              {error && (
                <tr>
                  <td>
                    <Text align="center" my="lg">
                      Invalid position: {chessopsError(error)}
                    </Text>
                  </td>
                </tr>
              )}
              {isGameOver && (
                <tr>
                  <td>
                    <Text align="center" my="lg">
                      Game is over
                    </Text>
                  </td>
                </tr>
              )}
              {!isGameOver &&
                !error &&
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
                !error &&
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
