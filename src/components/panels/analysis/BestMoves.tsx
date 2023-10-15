import {
  Accordion,
  ActionIcon,
  Box,
  createStyles,
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
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
  IconTargetArrow,
} from "@tabler/icons-react";
import {
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BestMoves, swapMove } from "@/utils/chess";
import { Engine } from "@/utils/engines";
import { invoke, unwrap } from "@/utils/invoke";
import { useThrottledEffect } from "@/utils/misc";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import EngineSettings from "./EngineSettings";
import { Chess } from "chess.js";
import AnalysisRow from "./AnalysisRow";
import { useAtom, useAtomValue } from "jotai";
import { activeTabAtom, tabEngineSettingsFamily } from "@/atoms/atoms";
import { formatScore } from "@/utils/score";
import { commands, events } from "@/bindings";

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
  const [ev, setEngineVariation] = useState<BestMoves[]>([]);
  const [settings, setSettings] = useAtom(
    tabEngineSettingsFamily({ engine: engine.name, tab: activeTab! })
  );

  const engineVariations = useMemo(
    () => (settings.enabled ? ev : []),
    [settings.enabled, ev]
  );

  const [settingsOn, toggleSettingsOn] = useToggle();
  const [threat, toggleThreat] = useToggle();
  const { classes } = useStyles();
  const depth = engineVariations[0]?.depth ?? 0;
  const nps = Math.floor(engineVariations[0]?.nps / 1000 ?? 0);
  const progress = (depth / settings.maxDepth) * 100;
  const theme = useMantineTheme();

  useEffect(() => {
    async function waitForMove() {
      console.log("waiting for move");
      const unlisten = await events.bestMovesPayload.listen(({ payload }) => {
        console.log("got move", payload);
        const ev = payload.bestLines;
        if (payload.engine === engine.path && payload.tab === activeTab) {
          startTransition(() => {
            setEngineVariation(ev);
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
      return () => {
        unlisten();
      };
    }
    waitForMove();
  }, []);

  const chess = new Chess(fen);

  useThrottledEffect(
    () => {
      if (settings.enabled) {
        const chess = new Chess(fen);
        if (chess.isGameOver()) {
          setSettings((prev) => ({ ...prev, enabled: false }));
          setEngineVariation([]);
        } else {
          commands
            .getBestMoves(
              engine.path,
              activeTab!,
              {
                t: "Depth",
                c: settings.maxDepth,
              },
              {
                fen: threat ? swapMove(fen) : fen,
                multipv: settings.numberLines,
                threads: 2 ** settings.cores,
              }
            )
            .then((res) => {
              unwrap(res);
            });
        }
      } else {
        commands.stopEngine(engine.path, activeTab!).then((r) => unwrap(r));
      }
    },
    50,
    [
      settings.enabled,
      settings.cores,
      settings.maxDepth,
      settings.numberLines,
      threat,
      fen,
    ]
  );

  return useMemo(
    () => (
      <>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Stack spacing={0}>
            <ActionIcon
              size="lg"
              variant={settings.enabled ? "filled" : "transparent"}
              color={theme.primaryColor}
              onClick={() => {
                setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
              }}
              disabled={chess.isGameOver()}
              ml={12}
            >
              {settings.enabled ? (
                <IconPlayerPause size={16} />
              ) : (
                <IconPlayerPlay size={16} />
              )}
            </ActionIcon>
          </Stack>

          <Accordion.Control>
            <Group position="apart">
              <Group align="baseline">
                <Text fw="bold" fz="xl">
                  {engine.name}
                </Text>
                {settings.enabled && engineVariations.length === 0 && (
                  <Text>Loading...</Text>
                )}
                {progress < 100 &&
                  settings.enabled &&
                  engineVariations.length > 0 && (
                    <Tooltip label={"How fast the engine is running"}>
                      <Text>{nps}k nodes/s</Text>
                    </Tooltip>
                  )}
              </Group>
              <Group spacing="lg">
                {engineVariations.length > 0 && (
                  <Stack align="center" spacing={0}>
                    <Text
                      size="xs"
                      transform="uppercase"
                      weight={700}
                      className={classes.subtitle}
                    >
                      Eval
                    </Text>
                    <Text fw="bold" fz="xl">
                      {formatScore(engineVariations[0].score, 1) ?? 0}
                    </Text>
                  </Stack>
                )}
                <Stack align="center" spacing={0}>
                  <Text
                    size="xs"
                    transform="uppercase"
                    weight={700}
                    className={classes.subtitle}
                  >
                    Depth
                  </Text>
                  <Text fw="bold" fz="xl">
                    {depth}
                  </Text>
                </Stack>
              </Group>
            </Group>
          </Accordion.Control>
          <Tooltip label="Check the opponent's threat">
            <ActionIcon
              size="lg"
              onClick={() => toggleThreat()}
              disabled={!settings.enabled}
              variant="transparent"
            >
              <IconTargetArrow color={threat ? "red" : undefined} size={16} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon size="lg" onClick={() => toggleSettingsOn()} mr={8}>
            <IconSettings size={16} />
          </ActionIcon>
        </Box>
        <EngineSettings
          settingsOn={settingsOn}
          cores={settings.cores}
          maxDepth={settings.maxDepth}
          numberLines={settings.numberLines}
          setSettings={setSettings}
        />

        <Progress
          value={progress}
          animate={progress < 100 && settings.enabled}
          size="xs"
          striped={progress < 100 && !settings.enabled}
          // color={threat ? "red" : "blue"}
          color={threat ? "red" : theme.primaryColor}
        />
        <Accordion.Panel>
          <Table>
            <tbody>
              {engineVariations.length === 0 &&
                (settings.enabled ? (
                  [...Array(settings.numberLines)].map((_, i) => (
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
              {engineVariations.map((engineVariation, index) => {
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
      settings.enabled,
      settings.numberLines,
      settings.maxDepth,
      settings.cores,
      engineVariations,
      threat,
      settingsOn,
      progress,
      nps,
      depth,
    ]
  );
}
