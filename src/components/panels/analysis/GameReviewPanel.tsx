import { events, commands } from "@/bindings";
import ProgressButton from "@/components/common/ProgressButton";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  type GameReviewData,
  type MoveReview,
  type PlayerReviewStats,
  activeTabAtom,
  currentGameReviewAtom,
  currentReviewInProgressAtom,
  enginesAtom,
  referenceDbAtom,
} from "@/state/atoms";
import { REVIEW_INFO, type ReviewClassification } from "@/utils/annotation";
import { getMainLine } from "@/utils/chess";
import type { LocalEngine } from "@/utils/engines";
import { getCPLoss, getChessComClassification } from "@/utils/score";
import { unwrap } from "@/utils/unwrap";
import {
  ActionIcon,
  Button,
  Grid,
  Group,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconZoomCheck,
} from "@tabler/icons-react";
import cx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import React, { memo, useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { label } from "./AnalysisPanel.css";
import { reportSettingsAtom } from "./ReportModal";

function GameReviewPanel() {
  const { t } = useTranslation();

  const activeTab = useAtomValue(activeTabAtom);
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const goToMove = useStore(store, (s) => s.goToMove);
  const addAnalysis = useStore(store, (s) => s.addAnalysis);
  const position = useStore(store, (s) => s.position);

  const [reviewData, setReviewData] = useAtom(currentGameReviewAtom);
  const [inProgress, setInProgress] = useAtom(currentReviewInProgressAtom);

  const reportSettings = useAtomValue(reportSettingsAtom);
  const engines = useAtomValue(enginesAtom);
  const referenceDb = useAtomValue(referenceDbAtom);

  const localEngines = engines.filter(
    (e): e is LocalEngine => e.type === "local",
  );

  const currentHalfMove = position.length;

  const generateReviewFromTree = useCallback(() => {
    const currentRoot = store.getState().root;
    const moves: MoveReview[] = [];
    let node = currentRoot;
    let prevScore = currentRoot.score?.value || {
      type: "cp" as const,
      value: 0,
    };
    let halfMove = 0;

    while (node.children.length > 0) {
      node = node.children[0];
      halfMove++;

      if (node.san) {
        const color = halfMove % 2 === 1 ? "white" : "black";

        if (node.score) {
          const cpLoss = getCPLoss(prevScore, node.score.value, color);
          const isBestMove = cpLoss < 5;

          moves.push({
            classification: getChessComClassification(cpLoss, isBestMove),
            cpLoss,
            bestMove: null,
            playedMove: node.san,
          });

          prevScore = node.score.value;
        } else {
          moves.push({
            classification: "good",
            cpLoss: 0,
            bestMove: null,
            playedMove: node.san,
          });
        }
      }
    }

    const whiteMoves = moves.filter((_, i) => i % 2 === 0);
    const blackMoves = moves.filter((_, i) => i % 2 === 1);

    const data: GameReviewData = {
      moves,
      white: calculateStats(whiteMoves),
      black: calculateStats(blackMoves),
    };

    setReviewData(data);
  }, [store, setReviewData]);

  const runAnalysisAndReview = useCallback(async () => {
    if (!activeTab) return;

    const enginePath =
      reportSettings.engine ||
      (localEngines.length > 0 ? localEngines[0].path : null);

    if (!enginePath) {
      return;
    }

    const engine = localEngines.find((e) => e.path === enginePath);
    if (!engine) {
      return;
    }

    setInProgress(true);

    const engineSettings = (engine.settings ?? []).map((s) => ({
      ...s,
      value: s.value?.toString() ?? "",
    }));

    const is960 = headers.variant === "Chess960";
    if (is960 && !engineSettings.find((o) => o.name === "UCI_Chess960")) {
      engineSettings.push({ name: "UCI_Chess960", value: "true" });
    }

    const moves = getMainLine(root, is960);

    try {
      const analysis = await commands.analyzeGame(
        `review_${activeTab}`,
        enginePath,
        reportSettings.goMode,
        {
          annotateNovelties: reportSettings.novelty,
          fen: root.fen,
          referenceDb,
          reversed: reportSettings.reversed,
          moves,
        },
        engineSettings,
      );

      const analysisData = unwrap(analysis);
      addAnalysis(analysisData);

      requestAnimationFrame(() => {
        setTimeout(() => {
          generateReviewFromTree();
          setInProgress(false);
        }, 50);
      });
    } catch (error) {
      setInProgress(false);
    }
  }, [
    activeTab,
    reportSettings,
    localEngines,
    headers.variant,
    root,
    referenceDb,
    addAnalysis,
    generateReviewFromTree,
    setInProgress,
  ]);

  const hasEngine = localEngines.length > 0;
  const hasMoves = root.children.length > 0;

  const halfMoveToPosition = useCallback((halfMove: number): number[] => {
    return Array(halfMove).fill(0);
  }, []);

  const goToFirstMistake = useCallback(() => {
    if (!reviewData) return;
    for (let i = 0; i < reviewData.moves.length; i++) {
      const classification = reviewData.moves[i].classification;
      if (
        classification === "inaccuracy" ||
        classification === "mistake" ||
        classification === "blunder"
      ) {
        goToMove(halfMoveToPosition(i + 1));
        return;
      }
    }
  }, [reviewData, goToMove, halfMoveToPosition]);

  const goToLastMistake = useCallback(() => {
    if (!reviewData) return;
    for (let i = reviewData.moves.length - 1; i >= 0; i--) {
      const classification = reviewData.moves[i].classification;
      if (
        classification === "inaccuracy" ||
        classification === "mistake" ||
        classification === "blunder"
      ) {
        goToMove(halfMoveToPosition(i + 1));
        return;
      }
    }
  }, [reviewData, goToMove, halfMoveToPosition]);

  const goToPreviousMistake = useCallback(() => {
    if (!reviewData) return;
    for (let i = currentHalfMove - 2; i >= 0; i--) {
      const classification = reviewData.moves[i]?.classification;
      if (
        classification === "inaccuracy" ||
        classification === "mistake" ||
        classification === "blunder"
      ) {
        goToMove(halfMoveToPosition(i + 1));
        return;
      }
    }
  }, [reviewData, currentHalfMove, goToMove, halfMoveToPosition]);

  const goToNextMistake = useCallback(() => {
    if (!reviewData) return;
    for (let i = currentHalfMove; i < reviewData.moves.length; i++) {
      const classification = reviewData.moves[i]?.classification;
      if (
        classification === "inaccuracy" ||
        classification === "mistake" ||
        classification === "blunder"
      ) {
        goToMove(halfMoveToPosition(i + 1));
        return;
      }
    }
  }, [reviewData, currentHalfMove, goToMove, halfMoveToPosition]);

  const currentMoveReview = useMemo(() => {
    if (!reviewData || currentHalfMove === 0) return null;
    return reviewData.moves[currentHalfMove - 1] || null;
  }, [reviewData, currentHalfMove]);

  return (
    <ScrollArea offsetScrollbars>
      <Stack mb="lg" gap="0.4rem" mr="xs">
        <Group grow style={{ textAlign: "center" }}>
          {reviewData && (
            <>
              <ReviewAccuracyCard
                color={t("Common.WHITE")}
                stats={reviewData.white}
              />
              <ReviewAccuracyCard
                color={t("Common.BLACK")}
                stats={reviewData.black}
              />
            </>
          )}
          <div>
            <ProgressButton
              id={`review_${activeTab}`}
              redoable
              disabled={!hasMoves || !hasEngine}
              leftIcon={<IconZoomCheck size="0.875rem" />}
              onClick={runAnalysisAndReview}
              initInstalled={false}
              progressEvent={events.reportProgress}
              labels={{
                action: t("Review.GenerateReview"),
                completed: t("Review.ReviewGenerated"),
                inProgress: t("Review.AnalysingGame"),
              }}
              inProgress={inProgress}
              setInProgress={setInProgress}
            />
            {!hasEngine && (
              <Text fz="xs" c="dimmed" mt="xs">
                {t("Review.NoEngineConfigured")}
              </Text>
            )}
            {!hasMoves && hasEngine && (
              <Text fz="xs" c="dimmed" mt="xs">
                {t("Review.NoMovesToAnalyse")}
              </Text>
            )}
          </div>
        </Group>

        {reviewData && (
          <>
            <Paper withBorder p="xs">
              <Stack gap="xs">
                <Text fz="sm" fw="bold" ta="center">
                  {t("Review.StepThrough")}
                </Text>
                <Group justify="center" gap="xs">
                  <Tooltip label={t("Review.FirstMistake")}>
                    <ActionIcon
                      variant="default"
                      onClick={goToFirstMistake}
                      data-testid="first-mistake-btn"
                    >
                      <IconPlayerSkipBack size="1rem" />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t("Review.PreviousMistake")}>
                    <ActionIcon
                      variant="default"
                      onClick={goToPreviousMistake}
                      data-testid="prev-mistake-btn"
                    >
                      <IconChevronLeft size="1rem" />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t("Review.NextMistake")}>
                    <ActionIcon
                      variant="default"
                      onClick={goToNextMistake}
                      data-testid="next-mistake-btn"
                    >
                      <IconChevronRight size="1rem" />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t("Review.LastMistake")}>
                    <ActionIcon
                      variant="default"
                      onClick={goToLastMistake}
                      data-testid="last-mistake-btn"
                    >
                      <IconPlayerSkipForward size="1rem" />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                {currentMoveReview && (
                  <Group justify="center" gap="xs">
                    <Text
                      fz="sm"
                      c={REVIEW_INFO[currentMoveReview.classification].color}
                    >
                      {REVIEW_INFO[currentMoveReview.classification].symbol}{" "}
                      {currentMoveReview.playedMove}
                      {" - "}
                      {t(
                        REVIEW_INFO[currentMoveReview.classification]
                          .translationKey,
                      )}
                    </Text>
                  </Group>
                )}
              </Stack>
            </Paper>

            <ClassificationStats
              white={reviewData.white}
              black={reviewData.black}
            />
            <MoveReviewList
              moves={reviewData.moves}
              onMoveClick={(halfMove) => goToMove(halfMoveToPosition(halfMove))}
              currentHalfMove={currentHalfMove}
            />
          </>
        )}
      </Stack>
    </ScrollArea>
  );
}

function calculateStats(moves: MoveReview[]): PlayerReviewStats {
  const counts: Record<ReviewClassification, number> = {
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    book: 0,
    forced: 0,
  };

  let totalCPL = 0;

  for (const move of moves) {
    counts[move.classification]++;
    totalCPL += move.cpLoss;
  }

  const totalMoves = moves.length;
  const averageCPL = totalMoves > 0 ? totalCPL / totalMoves : 0;

  const accuracy =
    totalMoves > 0
      ? Math.max(
          0,
          Math.min(
            100,
            103.1668 * Math.exp(-0.04354 * averageCPL) - 3.1669 + 1,
          ),
        )
      : 0;

  return {
    accuracy,
    averageCPL,
    counts,
    totalMoves,
  };
}

function ReviewAccuracyCard({
  color,
  stats,
}: {
  color: string;
  stats: PlayerReviewStats;
}) {
  const { t } = useTranslation();

  return (
    <Paper withBorder p="xs">
      <Group justify="space-between">
        <Stack gap={0} align="start">
          <Text c="dimmed">{color}</Text>
          <Text fz="sm">{stats.averageCPL.toFixed(1)} ACPL</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fz="xl" lh="normal">
            {stats.accuracy.toFixed(1)}%
          </Text>
          <Text fz="sm" c="dimmed" lh="normal">
            {t("Board.Analysis.Accuracy")}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

const ClassificationStats = memo(function ClassificationStats({
  white,
  black,
}: {
  white: PlayerReviewStats;
  black: PlayerReviewStats;
}) {
  const { t } = useTranslation();

  const classifications: ReviewClassification[] = [
    "best",
    "excellent",
    "good",
    "inaccuracy",
    "mistake",
    "blunder",
  ];

  return (
    <Paper withBorder>
      <Grid columns={11} justify="space-between" p="md">
        {classifications.map((classification) => {
          const { color, symbol, translationKey } = REVIEW_INFO[classification];
          const w = white.counts[classification];
          const b = black.counts[classification];
          return (
            <React.Fragment key={classification}>
              <Grid.Col
                className={cx(w > 0 && label)}
                span={4}
                style={{ textAlign: "center" }}
                c={w > 0 ? color : undefined}
              >
                {w}
              </Grid.Col>
              <Grid.Col span={1} c={w + b > 0 ? color : undefined}>
                {symbol}
              </Grid.Col>
              <Grid.Col span={4} c={w + b > 0 ? color : undefined}>
                {t(translationKey)}
              </Grid.Col>
              <Grid.Col
                className={cx(b > 0 && label)}
                span={2}
                c={b > 0 ? color : undefined}
              >
                {b}
              </Grid.Col>
            </React.Fragment>
          );
        })}
      </Grid>
    </Paper>
  );
});

function MoveReviewList({
  moves,
  onMoveClick,
  currentHalfMove,
}: {
  moves: MoveReview[];
  onMoveClick: (halfMove: number) => void;
  currentHalfMove: number;
}) {
  const { t } = useTranslation();

  if (moves.length === 0) {
    return null;
  }

  return (
    <Paper withBorder p="md">
      <Text fw="bold" mb="sm">
        {t("Review.MoveByMove")}
      </Text>
      <Stack gap="xs">
        {moves.map((move, index) => {
          const { color, symbol } = REVIEW_INFO[move.classification];
          const moveNumber = Math.floor(index / 2) + 1;
          const isWhite = index % 2 === 0;
          const movePrefix = isWhite ? `${moveNumber}.` : `${moveNumber}...`;
          const isCurrentMove = index + 1 === currentHalfMove;

          if (
            move.classification === "best" ||
            move.classification === "excellent" ||
            move.classification === "good"
          ) {
            return null;
          }

          return (
            <Group
              key={`${moveNumber}-${move.playedMove}`}
              gap="xs"
              style={{
                cursor: "pointer",
                backgroundColor: isCurrentMove
                  ? "var(--mantine-color-dark-5)"
                  : undefined,
                borderRadius: "var(--mantine-radius-sm)",
                padding: "0.25rem",
                marginLeft: "-0.25rem",
                marginRight: "-0.25rem",
              }}
              onClick={() => onMoveClick(index + 1)}
              data-testid={`move-review-${index}`}
            >
              <Text fz="sm" c="dimmed" w={50}>
                {movePrefix}
              </Text>
              <Text fz="sm" w={60}>
                {move.playedMove}
              </Text>
              <Text fz="sm" c={color} w={30}>
                {symbol}
              </Text>
              <Progress
                value={Math.min(100, move.cpLoss / 3)}
                color={color}
                size="sm"
                style={{ flex: 1 }}
              />
              <Text fz="xs" c="dimmed" w={50}>
                -{move.cpLoss.toFixed(0)} cp
              </Text>
            </Group>
          );
        })}
      </Stack>
    </Paper>
  );
}

export default GameReviewPanel;
