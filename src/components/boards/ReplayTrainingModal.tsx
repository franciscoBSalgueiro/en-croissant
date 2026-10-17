import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlayerPlay, IconPlayerSkipForward, IconX } from "@tabler/icons-react";
import { type Move, type NormalMove, parseSquare } from "chessops";
import { chessgroundDests } from "chessops/compat";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import { Chessground } from "@/chessground/Chessground";
import { commands, type NormalizedGame } from "@/bindings";
import { enginesAtom } from "@/state/atoms";
import classes from "@/styles/Chessboard.module.css";
import { parsePGN, uciNormalize } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import type { LocalEngine } from "@/utils/engines";
import {
  computeCpLoss,
  defaultTrainingSide,
  extractMainline,
  initialQuizState,
  moveNumber,
  quizAccuracy,
  quizReducer,
  uciToSquares,
} from "@/utils/replayTraining";
import PromotionModal from "./PromotionModal";

/** Fixed search depth for the optional engine scoring. */
const ENGINE_DEPTH = 12;

/** Delay before auto-advancing after a fully correct guess. */
const CORRECT_ADVANCE_MS = 900;

function ReplayTrainingModal({
  opened,
  setOpened,
  game,
}: {
  opened: boolean;
  setOpened: (o: boolean) => void;
  game: NormalizedGame | null;
}) {
  const { t } = useTranslation();
  const engines = (useAtomValue(enginesAtom) ?? []).filter(
    (e): e is LocalEngine => e.type === "local",
  );

  const [side, setSide] = useState<"white" | "black">("white");
  const [engineScoring, setEngineScoring] = useState(false);
  const [engineId, setEngineId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);
  const [quiz, dispatch] = useReducer(quizReducer, initialQuizState);

  // The backend lexer turns the raw movetext into the same game tree the
  // analysis board uses; the quiz then walks its mainline.
  const {
    data: parsed,
    error: parseError,
    isLoading: parsing,
  } = useSWRImmutable(opened && game ? ["replay-training", game.id, game.moves] : null, async () =>
    parsePGN(game!.moves, game!.fen || undefined),
  );

  useEffect(() => {
    if (opened && game) {
      setSide(defaultTrainingSide(game.white_elo, game.black_elo));
      setEngineScoring(false);
      setEngineId(null);
      setEvaluating(false);
      setPendingMove(null);
      dispatch({ type: "reset" });
    }
  }, [opened, game]);

  const selectedEngine = engines.find((engine) => engine.id === engineId) ?? engines[0] ?? null;

  const [pos] = positionFromFen(quiz.boardFen || INITIAL_FEN);
  const dests = useMemo(() => (pos ? chessgroundDests(pos) : new Map()), [pos]);
  const turn = pos?.turn ?? "white";
  const lastMove = quiz.lastMoveUci ? uciToSquares(quiz.lastMoveUci) : undefined;

  const guessing = quiz.phase === "guessing";
  const canMove = guessing && !evaluating && pos?.turn === quiz.side;
  const trainedName = game ? (quiz.side === "white" ? game.white : game.black) : "";

  // Correct guesses auto-advance after a short flash of feedback.
  useEffect(() => {
    if (quiz.phase === "reveal" && quiz.feedback?.outcome === "correct") {
      const timer = setTimeout(() => dispatch({ type: "advance" }), CORRECT_ADVANCE_MS);
      return () => clearTimeout(timer);
    }
  }, [quiz.phase, quiz.feedback]);

  function handleStart() {
    if (!parsed) return;
    const moves = extractMainline(parsed.root);
    if (moves.length === 0) {
      notifications.show({
        title: t("Board.Replay.Title", "Replay Training"),
        message: t("Board.Replay.NoMoves", "No moves found in this game"),
        color: "red",
        icon: <IconX size="1rem" />,
      });
      return;
    }
    dispatch({ type: "start", moves, rootFen: parsed.root.fen, side });
  }

  async function evaluateGuess(fen: string, uci: string): Promise<number | null> {
    const engine = selectedEngine;
    if (!engine) return null;
    const res = await commands.evaluatePosition(fen, [uci], engine.path, ENGINE_DEPTH);
    return res.status === "ok" ? res.data : null;
  }

  async function checkGuess(move: Move) {
    if (!pos || quiz.phase !== "guessing") return;
    const expected = quiz.moves[quiz.index];
    if (!expected) return;

    const playedSan = makeSan(pos, move);
    const playedUci = uciNormalize(pos, move);
    const newPos = pos.clone();
    newPos.play(move);
    const playedFen = makeFen(newPos.toSetup());

    if (engineScoring && selectedEngine) {
      setEvaluating(true);
      try {
        const [guessEval, playedEval] = await Promise.all([
          evaluateGuess(quiz.boardFen, playedUci),
          evaluateGuess(quiz.boardFen, expected.uci),
        ]);
        if (guessEval !== null && playedEval !== null) {
          dispatch({
            type: "guess",
            playedSan,
            playedUci,
            playedFen,
            cpLoss: computeCpLoss(guessEval, playedEval),
          });
          return;
        }
      } catch (err) {
        notifications.show({
          title: t("Board.Replay.Title", "Replay Training"),
          message:
            err instanceof Error
              ? err.message
              : t("Board.Replay.EngineError", "Engine scoring failed, continuing without it"),
          color: "red",
          icon: <IconX size="1rem" />,
        });
      } finally {
        setEvaluating(false);
      }
    }
    dispatch({ type: "guess", playedSan, playedUci, playedFen });
  }

  function onBoardMove(orig: string, dest: string) {
    const from = parseSquare(orig);
    const to = parseSquare(dest);
    if (!from || !to || !pos) return;
    const move: NormalMove = { from, to };
    if (
      pos.board.get(from)?.role === "pawn" &&
      ((dest[1] === "8" && turn === "white") || (dest[1] === "1" && turn === "black"))
    ) {
      setPendingMove(move);
    } else {
      void checkGuess(move);
    }
  }

  const accuracy = Math.round(quizAccuracy(quiz));
  const totalMoves = Math.ceil(quiz.moves.length / 2);

  const feedbackPaper = (() => {
    if (quiz.phase !== "reveal" || !quiz.feedback) return null;
    const f = quiz.feedback;
    if (f.outcome === "correct") {
      return (
        <Paper withBorder p="xs">
          <Text c="green" fw={500}>
            {t("Board.Replay.Correct", { defaultValue: "Correct! +{{points}} points", points: 10 })}
          </Text>
        </Paper>
      );
    }
    if (f.outcome === "alternative") {
      return (
        <Paper withBorder p="xs">
          <Text c="indigo" fw={500}>
            {t("Board.Replay.Alternative", {
              defaultValue: "Good alternative (+{{points}} points)",
              points: 5,
            })}
          </Text>
          <Text size="xs" c="dimmed">
            {t("Board.Replay.ExpectedWas", {
              defaultValue: "Expected: {{san}}",
              san: f.expectedSan,
            })}
            {f.cpLoss !== undefined
              ? ` · ${t("Board.Replay.CpLoss", {
                  defaultValue: "{{cp}}cp loss",
                  cp: Math.round(f.cpLoss),
                })}`
              : ""}
          </Text>
        </Paper>
      );
    }
    if (f.outcome === "incorrect") {
      return (
        <Paper withBorder p="xs">
          <Text c="red" fw={500}>
            {t("Board.Replay.Incorrect", {
              defaultValue: "Incorrect — the move was {{san}}",
              san: f.expectedSan,
            })}
          </Text>
        </Paper>
      );
    }
    return (
      <Paper withBorder p="xs">
        <Text c="yellow" fw={500}>
          {t("Board.Replay.SkippedMove", {
            defaultValue: "Skipped — the move was {{san}}",
            san: f.expectedSan,
          })}
        </Text>
      </Paper>
    );
  })();

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Board.Replay.Title", "Replay Training")}
      size="lg"
    >
      {!game ? null : parseError ? (
        <Alert color="red">
          {t("Board.Replay.ParseError", {
            defaultValue: "Failed to read game moves: {{error}}",
            error: parseError.toString(),
          })}
        </Alert>
      ) : quiz.phase === "idle" ? (
        <Stack>
          <Group justify="space-between">
            <Text fw={500}>
              {game.white} — {game.black}
            </Text>
            <Badge>{game.result.replaceAll("1/2", "½")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {[game.event, game.date, game.eco].filter(Boolean).join(" · ")}
          </Text>
          <Divider />
          <Stack gap={4}>
            <Text fz="sm" fw={500}>
              {t("Board.Replay.Setup.Side", "Play as")}
            </Text>
            <SegmentedControl
              value={side}
              onChange={(value) => setSide(value as "white" | "black")}
              data={[
                {
                  value: "white",
                  label: `${t("Board.Replay.White", "White")} · ${game.white}${
                    game.white_elo ? ` (${game.white_elo})` : ""
                  }`,
                },
                {
                  value: "black",
                  label: `${t("Board.Replay.Black", "Black")} · ${game.black}${
                    game.black_elo ? ` (${game.black_elo})` : ""
                  }`,
                },
              ]}
            />
          </Stack>
          <Switch
            label={t("Board.Replay.Setup.EngineScoring", "Score guesses with an engine")}
            description={t(
              "Board.Replay.Setup.EngineScoringDesc",
              "Guesses within 30cp of the played move earn partial credit",
            )}
            disabled={engines.length === 0}
            checked={engineScoring}
            onChange={(e) => setEngineScoring(e.currentTarget.checked)}
          />
          <Select
            label={t("Board.Replay.Setup.Engine", "Engine")}
            placeholder={t("Board.Replay.Setup.NoEngine", "No local engines found")}
            disabled={!engineScoring || engines.length === 0}
            allowDeselect={false}
            data={engines.map((engine) => ({ label: engine.name, value: engine.id }))}
            value={selectedEngine?.id ?? ""}
            onChange={(value) => setEngineId(value)}
          />
          <Group justify="flex-end">
            <Button
              leftSection={<IconPlayerPlay size="1rem" />}
              loading={parsing}
              disabled={!parsed}
              onClick={handleStart}
            >
              {t("Board.Replay.Setup.Start", "Start training")}
            </Button>
          </Group>
        </Stack>
      ) : quiz.phase === "finished" ? (
        <Stack>
          <Paper withBorder p="md">
            <Text fw={500} mb="xs">
              {t("Board.Replay.Summary.Title", "Training complete")}
            </Text>
            <SimpleGrid cols={3}>
              <Stack gap={0}>
                <Text size="xl" fw={700}>
                  {accuracy}%
                </Text>
                <Text size="xs" c="dimmed">
                  {t("Board.Replay.Summary.Accuracy", "Accuracy")}
                </Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xl" fw={700}>
                  {quiz.score}
                </Text>
                <Text size="xs" c="dimmed">
                  {t("Board.Replay.Summary.Points", "Points")}
                </Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xl" fw={700}>
                  {quiz.asked}
                </Text>
                <Text size="xs" c="dimmed">
                  {t("Board.Replay.Summary.Moves", "Moves")}
                </Text>
              </Stack>
            </SimpleGrid>
          </Paper>
          <Text size="sm" c="dimmed">
            {t("Board.Replay.Summary.Details", {
              defaultValue:
                "{{correct}} exact, {{alternative}} good alternatives, {{skipped}} skipped",
              correct: quiz.correct,
              alternative: quiz.alternatives,
              skipped: quiz.skipped,
            })}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)}>
              {t("Common.Close", "Close")}
            </Button>
            <Button
              leftSection={<IconPlayerPlay size="1rem" />}
              onClick={() =>
                dispatch({
                  type: "start",
                  moves: quiz.moves,
                  rootFen: quiz.rootFen,
                  side: quiz.side,
                })
              }
            >
              {t("Board.Replay.Summary.Replay", "Train again")}
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={0}>
              <Text fw={500}>
                {t("Board.Replay.GuessMove", {
                  defaultValue: "Move {{move}} — guess {{player}}'s move",
                  move: moveNumber(quiz.index),
                  player: trainedName,
                })}
              </Text>
              <Text size="xs" c="dimmed">
                {t("Board.Replay.Progress", {
                  defaultValue: "{{move}} / {{total}}",
                  move: moveNumber(quiz.index),
                  total: totalMoves,
                })}{" "}
                · {t("Board.Replay.Score", "Score")}: <b>{quiz.score}</b>
              </Text>
            </Stack>
            {evaluating && <Loader size="sm" />}
          </Group>
          <Progress value={(quiz.index / Math.max(quiz.moves.length, 1)) * 100} size="sm" />
          <Group align="start" grow gap="lg" wrap="nowrap">
            <Box
              className={classes.chessboard}
              style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}
            >
              <PromotionModal
                pendingMove={pendingMove}
                cancelMove={() => setPendingMove(null)}
                confirmMove={(p) => {
                  if (pendingMove) {
                    void checkGuess({ ...pendingMove, promotion: p });
                    setPendingMove(null);
                  }
                }}
                turn={turn}
                orientation={quiz.side}
              />
              <Chessground
                animation={{ enabled: true }}
                coordinates
                orientation={quiz.side}
                fen={quiz.boardFen}
                turnColor={turn}
                check={pos?.isCheck()}
                lastMove={lastMove}
                movable={{
                  free: false,
                  color: canMove ? quiz.side : undefined,
                  dests: canMove ? dests : new Map(),
                  events: { after: onBoardMove },
                }}
              />
            </Box>
            <Stack gap="sm" style={{ minWidth: 220 }}>
              {feedbackPaper}
              {guessing ? (
                <Button
                  variant="default"
                  leftSection={<IconPlayerSkipForward size="1rem" />}
                  disabled={evaluating}
                  onClick={() => dispatch({ type: "skip" })}
                >
                  {t("Board.Replay.Skip", "Skip")}
                </Button>
              ) : (
                quiz.phase === "reveal" && (
                  <Button onClick={() => dispatch({ type: "advance" })}>
                    {t("Board.Replay.Continue", "Continue")}
                  </Button>
                )
              )}
              <Button
                variant="subtle"
                color="red"
                onClick={() => setOpened(false)}
                disabled={evaluating}
              >
                {t("Board.Replay.Quit", "Quit")}
              </Button>
            </Stack>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

export default ReplayTrainingModal;
