import {
  Accordion,
  ActionIcon,
  Box,
  ChevronIcon,
  createStyles,
  Flex,
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
import { emit, listen } from "@tauri-apps/api/event";
import { Chess } from "chess.js";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  Annotation,
  BestMoves,
  BestMovesPayload,
  Score,
  swapMove,
} from "../../../utils/chess";
import { Engine } from "../../../utils/engines";
import { formatScore } from "../../../utils/format";
import { invoke } from "../../../utils/misc";
import MoveCell from "../../boards/MoveCell";
import { TreeDispatchContext } from "../../common/TreeStateContext";
import EngineSettings from "./EngineSettings";

const useStyles = createStyles((theme) => ({
  subtitle: {
    color:
      theme.colorScheme === "dark"
        ? theme.fn.rgba(theme.white, 0.65)
        : theme.black,
  },
}));

function ScoreBubble({ score }: { score: Score }) {
  const text = formatScore(score);
  return (
    <Box
      sx={(theme) => ({
        backgroundColor:
          score.value >= 0 ? theme.colors.gray[0] : theme.colors.dark[9],
        textAlign: "center",
        padding: 5,
        borderRadius: theme.radius.md,
        width: 70,
        boxShadow: theme.shadows.md,
      })}
    >
      <Text
        weight={700}
        color={score.value >= 0 ? "black" : "white"}
        size="md"
        align="center"
        sx={(theme) => ({
          fontFamily: theme.fontFamilyMonospace,
        })}
      >
        {text}
      </Text>
    </Box>
  );
}

interface BestMovesProps {
  id: number;
  tab: string;
  engine: Engine;
  setArrows: (arrows: string[]) => void;
  fen: string;
  halfMoves: number;
}

function BestMoves({
  id,
  tab,
  engine,
  setArrows,
  fen,
  halfMoves,
}: BestMovesProps) {
  const dispatch = useContext(TreeDispatchContext);
  const [engineVariations, setEngineVariation] = useState<BestMoves[]>([]);
  const [numberLines, setNumberLines] = useState<number>(3);
  const [maxDepth, setMaxDepth] = useState<number>(24);
  const [cores, setCores] = useState<number>(2);
  const [enabled, toggleEnabled] = useToggle();
  const [settingsOn, toggleSettingsOn] = useToggle();
  const [threat, toggleThreat] = useToggle();
  const { classes } = useStyles();
  const depth = engineVariations[0]?.depth ?? 0;
  const nps = Math.floor(engineVariations[0]?.nps / 1000 ?? 0);
  const progress = (depth / maxDepth) * 100;
  const theme = useMantineTheme();

  useEffect(() => {
    async function waitForMove() {
      await listen("best_moves", (event) => {
        const payload = event.payload as BestMovesPayload;
        const ev = payload.bestLines;
        if (payload.engine === engine.path && payload.tab === tab) {
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
        }
      });
    }
    waitForMove();
  }, []);

  useEffect(() => {
    let chess: Chess | null;
    try {
      chess = new Chess(fen);
    } catch (e) {
      chess = null;
    }
    if (enabled && chess !== null) {
      emit("stop_engine", engine.path);
      invoke("get_best_moves", {
        engine: engine.path,
        tab,
        fen: threat ? swapMove(fen) : fen,
        depth: maxDepth,
        numberLines: Math.min(numberLines, chess.moves().length),
        numberThreads: 2 ** cores,
      });
    } else {
      emit("stop_engine", engine.path);
    }
  }, [enabled, numberLines, maxDepth, cores, threat, fen]);

  useEffect(() => {
    if (!enabled) {
      setEngineVariation([]);
    }
  }, [fen]);

  return useMemo(
    () => (
      <>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Stack spacing={0}>
            <ActionIcon
              size="lg"
              variant={enabled ? "filled" : "transparent"}
              color={theme.primaryColor}
              onClick={() => {
                toggleEnabled();
              }}
              ml={12}
            >
              {enabled ? (
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
                {progress < 100 && enabled && (
                  <Tooltip label={"How fast the engine is running"}>
                    <Text>{nps}k nodes/s</Text>
                  </Tooltip>
                )}
              </Group>
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
          </Accordion.Control>
          <Tooltip label="Check the opponent's threat">
            <ActionIcon
              size="lg"
              onClick={() => toggleThreat()}
              disabled={!enabled}
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
          numberLines={numberLines}
          setNumberLines={setNumberLines}
          maxDepth={maxDepth}
          setMaxDepth={setMaxDepth}
          cores={cores}
          setCores={setCores}
        />

        <Progress
          value={progress}
          animate={progress < 100 && enabled}
          size="xs"
          striped={progress < 100 && !enabled}
          // color={threat ? "red" : "blue"}
          color={threat ? "red" : theme.primaryColor}
        />
        <Accordion.Panel>
          <Table>
            <tbody>
              {engineVariations.length === 0 &&
                (enabled ? (
                  Array.apply(null, Array(numberLines)).map((_, i) => (
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
                        Engine isn't enabled
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
      enabled,
      engineVariations,
      threat,
      settingsOn,
      numberLines,
      maxDepth,
      cores,
      progress,
      nps,
      depth,
    ]
  );
}

function AnalysisRow({
  score,
  moves,
  halfMoves,
  threat,
}: {
  score: Score;
  moves: string[];
  halfMoves: number;
  threat: boolean;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const dispatch = useContext(TreeDispatchContext);

  if (!open) {
    moves = moves.slice(0, 12);
  }

  return (
    <tr style={{ verticalAlign: "top" }}>
      <td>
        <ScoreBubble score={score} />
      </td>
      <td>
        <Flex
          direction="row"
          wrap="wrap"
          sx={{
            height: open ? "100%" : 35,
            overflow: "hidden",
            alignItems: "center",
          }}
        >
          {moves.map((move, index) => {
            const total_moves = halfMoves + index + 1 + (threat ? 1 : 0);
            const is_white = total_moves % 2 === 1;
            const move_number = Math.ceil(total_moves / 2);

            return (
              <>
                {(index === 0 || is_white) && (
                  <>{`${move_number.toString()}${is_white ? "." : "..."}`}</>
                )}
                <MoveCell
                  key={index + move}
                  move={move}
                  isCurrentVariation={false}
                  annotation={Annotation.None}
                  onContextMenu={() => {}}
                  onClick={() => {
                    if (!threat) {
                      dispatch({
                        type: "MAKE_MOVES",
                        payload: moves.slice(0, index + 1),
                      });
                    }
                  }}
                />
              </>
            );
          })}
        </Flex>
      </td>
      <td>
        <ActionIcon
          style={{
            transition: "transform 200ms ease",
            transform: open ? `rotate(180deg)` : "none",
          }}
          onClick={() => setOpen(!open)}
        >
          <ChevronIcon />
        </ActionIcon>
      </td>
    </tr>
  );
}
export default BestMoves;
