import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeUci, type Move, type NormalMove, parseSquare } from "chessops";
import { chessgroundDests, chessgroundMove } from "chessops/compat";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { Chessground } from "@/chessground/Chessground";
import { formatReviewInterval, getNextReviewTimes } from "@/components/files/opening";
import PromotionModal from "@/components/boards/PromotionModal";
import { moveHighlightAtom, showCoordinatesAtom } from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import {
  buildStrategyDeck,
  type StrategyCard,
  gradeCard,
  loadStrategyDeck,
  orderStrategyDeck,
  saveStrategyDeck,
  strategyDeckKey,
  strategyStats,
} from "@/utils/dbLearning";

type Phase = "waiting" | "correct" | "incorrect" | "done";

function StrategyTrainerModal({
  opened,
  setOpened,
  fen,
  path,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  fen: string;
  path: string;
}) {
  const { t } = useTranslation();
  const key = strategyDeckKey(path, fen);

  const [cards, setCards] = useState<StrategyCard[]>([]);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);
  const [answerFen, setAnswerFen] = useState<string | null>(null);
  const [answerMove, setAnswerMove] = useState<Move | null>(null);

  const showCoordinates = useAtomValue(showCoordinatesAtom);
  const moveHighlight = useAtomValue(moveHighlightAtom);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;

    function startSession(deck: StrategyCard[]) {
      // Defensive: a legacy/corrupt card without answers cannot be quizzed.
      const trainable = deck.filter((card) => card.answers.length > 0);
      setCards(orderStrategyDeck(trainable));
      setCurrent(0);
      setPhase(trainable.length > 0 ? "waiting" : "done");
      setPendingMove(null);
      setAnswerFen(null);
      setAnswerMove(null);
    }

    const existing = loadStrategyDeck(key);
    if (existing.length > 0) {
      startSession(existing);
      return;
    }

    setBuilding(true);
    setError(null);
    buildStrategyDeck(path, fen)
      .then((deck) => {
        if (cancelled) return;
        saveStrategyDeck(key, deck);
        startSession(deck);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        startSession([]);
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, key, path, fen]);

  const item = cards[current];
  const itemFen = item?.fen;
  const [pos] = useMemo(() => (itemFen ? positionFromFen(itemFen) : [null, null]), [itemFen]);
  const turn = pos?.turn ?? "white";
  const dests = useMemo(() => (pos ? chessgroundDests(pos) : new Map()), [pos]);

  const stats = strategyStats(cards);
  const completed =
    phase === "done"
      ? cards.length
      : current + (phase === "correct" || phase === "incorrect" ? 1 : 0);

  function applyGrade(index: number, grade: 1 | 2 | 3 | 4) {
    const updated = cards.map((c, i) =>
      i === index ? { ...c, card: gradeCard(c.card, grade) } : c,
    );
    setCards(updated);
    saveStrategyDeck(key, updated);
  }

  function nextCard() {
    setAnswerFen(null);
    setAnswerMove(null);
    setPendingMove(null);
    if (current + 1 >= cards.length) {
      setPhase("done");
    } else {
      setCurrent((c) => c + 1);
      setPhase("waiting");
    }
  }

  function handleGrade(grade: 1 | 2 | 3 | 4) {
    applyGrade(current, grade);
    nextCard();
  }

  function checkMove(move: Move) {
    if (!item || phase !== "waiting") return;
    const [position] = positionFromFen(item.fen);
    if (!position) return;

    // Compare by UCI so SAN formatting differences (check/mate suffixes,
    // disambiguation) cannot reject an otherwise correct move.
    const playedUci = makeUci(move);
    const accepted = item.answers.some((answer) => {
      const candidate = parseSan(position, answer);
      return candidate !== undefined && makeUci(candidate) === playedUci;
    });
    if (accepted) {
      // Show the move the user actually played; any accepted answer is correct.
      const newPos = position.clone();
      newPos.play(move);
      setAnswerFen(makeFen(newPos.toSetup()));
      setAnswerMove(move);
      setPhase("correct");
      return;
    }

    // Wrong: reveal the most popular accepted answer and schedule with Again (1).
    const primary = item.answers[0];
    const expected = primary ? parseSan(position, primary) : undefined;
    if (expected) {
      const newPos = position.clone();
      newPos.play(expected);
      setAnswerFen(makeFen(newPos.toSetup()));
      setAnswerMove(expected);
    }
    applyGrade(current, 1);
    setPhase("incorrect");
  }

  function handleClose() {
    saveStrategyDeck(key, cards);
    setOpened(false);
  }

  const reviewTimes = item ? getNextReviewTimes(item.card) : null;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="lg"
      title={<b>{t("Board.Trainer.Title")}</b>}
    >
      {building ? (
        <Stack align="center" gap="sm" py="xl">
          <Loader />
          <Text fz="sm" c="dimmed">
            {t("Board.Trainer.Building")}
          </Text>
        </Stack>
      ) : error ? (
        <Stack gap="sm">
          <Text c="red" fz="sm">
            {error}
          </Text>
          <Button variant="light" size="sm" onClick={handleClose}>
            {t("Board.Trainer.Close")}
          </Button>
        </Stack>
      ) : cards.length === 0 ? (
        <Stack gap="sm">
          <Text fz="sm" c="dimmed">
            {t("Board.Trainer.NoPositions")}
          </Text>
          <Button variant="light" size="sm" onClick={handleClose}>
            {t("Board.Trainer.Close")}
          </Button>
        </Stack>
      ) : (
        <Group align="flex-start" gap="lg" wrap="nowrap">
          <Box pos="relative" style={{ width: "min(100%, 360px)" }}>
            <PromotionModal
              pendingMove={pendingMove}
              cancelMove={() => setPendingMove(null)}
              confirmMove={async (p) => {
                if (pendingMove) {
                  await checkMove({ ...pendingMove, promotion: p });
                  setPendingMove(null);
                }
              }}
              turn={turn}
              orientation={turn}
            />
            <Chessground
              animation={{ enabled: true }}
              coordinates={showCoordinates !== "no"}
              coordinatesOnSquares={showCoordinates === "all"}
              orientation={turn}
              fen={answerFen ?? item.fen}
              turnColor={turn}
              lastMove={answerMove && moveHighlight ? chessgroundMove(answerMove) : undefined}
              check={moveHighlight && !answerFen && pos?.isCheck()}
              movable={{
                free: false,
                color: phase === "waiting" ? turn : undefined,
                dests,
                events: {
                  after: (orig, dest) => {
                    const from = parseSquare(orig)!;
                    const to = parseSquare(dest)!;
                    const move: NormalMove = { from, to };
                    if (
                      pos?.board.get(from)?.role === "pawn" &&
                      ((dest[1] === "8" && turn === "white") ||
                        (dest[1] === "1" && turn === "black"))
                    ) {
                      setPendingMove(move);
                    } else {
                      checkMove(move);
                    }
                  },
                },
              }}
            />
          </Box>

          <Stack gap="sm" flex={1} miw={200}>
            <Group justify="space-between" wrap="nowrap">
              <Text fz="sm" fw={500}>
                {turn === "white" ? t("Fen.WhiteToMove") : t("Fen.BlackToMove")}
              </Text>
              <Badge size="sm" variant="light" color="yellow">
                {t("Board.Practice.Due")}: {stats.due + stats.unseen}
              </Badge>
            </Group>
            <Stack gap={4}>
              <Progress value={cards.length > 0 ? (completed / cards.length) * 100 : 0} size="sm" />
              <Text fz="xs" c="dimmed" ta="right">
                {completed}/{cards.length}
              </Text>
            </Stack>

            {phase === "waiting" && (
              <Text fz="sm" c="dimmed">
                {t("Board.Trainer.MakeYourMove")}
              </Text>
            )}

            {phase === "correct" && item && (
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon size="md" color="green" variant="light" radius="xl">
                    <IconCheck size={16} />
                  </ThemeIcon>
                  <Text fw={500} c="green">
                    {t("Board.Practice.Correct")}
                  </Text>
                </Group>
                <Text fz="sm" c="dimmed">
                  {t("Board.Practice.HowDifficult")}
                </Text>
                <SimpleGrid cols={4} spacing="xs" style={{ width: "100%" }}>
                  <Tooltip label={t("Board.Practice.AgainHint")}>
                    <Button
                      color="red"
                      variant="light"
                      size="compact-md"
                      onClick={() => handleGrade(1)}
                      style={{ height: "auto", padding: "4px 0" }}
                    >
                      <Stack gap={0} align="center">
                        <Text fz="xs" fw={600}>
                          {t("Board.Practice.Again")}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {reviewTimes ? formatReviewInterval(reviewTimes[1]) : ""}
                        </Text>
                      </Stack>
                    </Button>
                  </Tooltip>
                  <Tooltip label={t("Board.Practice.HardHint")}>
                    <Button
                      color="orange"
                      variant="light"
                      size="compact-md"
                      onClick={() => handleGrade(2)}
                      style={{ height: "auto", padding: "4px 0" }}
                    >
                      <Stack gap={0} align="center">
                        <Text fz="xs" fw={600}>
                          {t("Board.Practice.Hard")}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {reviewTimes ? formatReviewInterval(reviewTimes[2]) : ""}
                        </Text>
                      </Stack>
                    </Button>
                  </Tooltip>
                  <Tooltip label={t("Board.Practice.GoodHint")}>
                    <Button
                      color="blue"
                      variant="light"
                      size="compact-md"
                      onClick={() => handleGrade(3)}
                      style={{ height: "auto", padding: "4px 0" }}
                    >
                      <Stack gap={0} align="center">
                        <Text fz="xs" fw={600}>
                          {t("Board.Practice.Good")}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {reviewTimes ? formatReviewInterval(reviewTimes[3]) : ""}
                        </Text>
                      </Stack>
                    </Button>
                  </Tooltip>
                  <Tooltip label={t("Board.Practice.EasyHint")}>
                    <Button
                      color="green"
                      variant="light"
                      size="compact-md"
                      onClick={() => handleGrade(4)}
                      style={{ height: "auto", padding: "4px 0" }}
                    >
                      <Stack gap={0} align="center">
                        <Text fz="xs" fw={600}>
                          {t("Board.Practice.Easy")}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {reviewTimes ? formatReviewInterval(reviewTimes[4]) : ""}
                        </Text>
                      </Stack>
                    </Button>
                  </Tooltip>
                </SimpleGrid>
              </Stack>
            )}

            {phase === "incorrect" && item && (
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon size="md" color="red" variant="light" radius="xl">
                    <IconX size={16} />
                  </ThemeIcon>
                  <Text fw={500} c="red">
                    {t("Common.Incorrect")}
                  </Text>
                </Group>
                <Text fz="sm" c="dimmed">
                  {t("Board.Trainer.CorrectMoveWas", { move: item.answers[0] })}
                </Text>
                <Button variant="light" size="sm" onClick={nextCard}>
                  {t("Board.Trainer.Next")}
                </Button>
              </Stack>
            )}

            {phase === "done" && (
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon size="md" color="green" variant="light" radius="xl">
                    <IconCheck size={16} />
                  </ThemeIcon>
                  <Text fw={500}>{t("Board.Trainer.AllDone")}</Text>
                </Group>
                <Button variant="light" size="sm" onClick={handleClose}>
                  {t("Board.Trainer.Close")}
                </Button>
              </Stack>
            )}
          </Stack>
        </Group>
      )}
    </Modal>
  );
}

export default memo(StrategyTrainerModal);
