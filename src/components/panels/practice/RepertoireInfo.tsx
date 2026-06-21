import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconFlag,
  IconInfoCircle,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { coverageMinGamesAtom, currentTabAtom, referenceDbAtom } from "@/state/atoms";
import { roundKeepSum } from "@/utils/format";
import { isPrefix } from "@/utils/misc";
import {
  computeTreeCoverage,
  fetchPositionMoves,
  findBiggestGap,
  findNextGap,
  getStats,
  type PositionMove,
} from "@/utils/repertoire";
import { getBoardState, getNodeAtPath, type TreeNode } from "@/utils/treeReducer";
import classes from "./RepertoireInfo.module.css";

function formatMoveNotation(halfMoves: number, san: string): string {
  const moveNum = Math.ceil(halfMoves / 2);
  const isWhite = halfMoves % 2 === 1;
  return `${moveNum}${isWhite ? "." : "..."} ${san}`;
}

function RepertoireInfo() {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const dirty = useStore(store, (s) => s.dirty);
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const position = useStore(store, (s) => s.position);
  const currentNode = useStore(store, (s) => s.currentNode());
  const goToMove = useStore(store, (s) => s.goToMove);
  const makeMove = useStore(store, (s) => s.makeMove);
  const makeMoves = useStore(store, (s) => s.makeMoves);
  const setStart = useStore(store, (s) => s.setStart);
  const boardStateMap = useStore(store, (s) => s.boardStateMap);

  const referenceDb = useAtomValue(referenceDbAtom);
  const currentTab = useAtomValue(currentTabAtom);
  const minGames = useAtomValue(coverageMinGamesAtom);

  const orientation = useMemo(() => headers.orientation || "white", [headers.orientation]);

  const stats = useStore(store, getStats);

  const [coverageMap, setCoverageMap] = useState<Map<string, number>>(new Map());
  const [dbMovesMap, setDbMovesMap] = useState<
    Map<
      string,
      { moves: { move: string; white: number; draw: number; black: number }[]; total: number }
    >
  >(new Map());
  const [gamesMap, setGamesMap] = useState<Map<string, number>>(new Map());
  const [missingGamesMap, setMissingGamesMap] = useState<Map<string, number>>(new Map());
  const [currentPosLoading, setCurrentPosLoading] = useState(false);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const coverageVersionRef = useRef(0);
  const firstCoverageRun = useRef(true);

  const startPath = useMemo(() => headers.start || [], [headers.start]);
  const hasStart = headers.start != null && headers.start.length > 0;
  const isBeforeStart =
    hasStart && position.length < startPath.length && isPrefix(position, startPath);
  const isEmptyTree = root.children.length === 0;

  const startNode = useMemo(() => getNodeAtPath(root, startPath), [root, startPath]);

  const startStateMoves = useMemo(() => {
    const movesMap = new Map<string, Map<string, string>>();
    if (!startNode) return movesMap;

    for (const [fen, entries] of Object.entries(boardStateMap)) {
      const perFenMap = new Map<string, string>();
      for (const { node, path } of entries) {
        if (isPrefix(startPath, path)) {
          for (const child of node.children) {
            if (child.san) {
              perFenMap.set(child.san, getBoardState(child.fen));
            }
          }
        }
      }
      if (perFenMap.size > 0) {
        movesMap.set(fen, perFenMap);
      }
    }
    return movesMap;
  }, [boardStateMap, startNode, startPath]);

  useEffect(() => {
    if (!referenceDb) return;
    const boardFen = getBoardState(currentNode.fen);
    if (dbMovesMap.has(boardFen)) return;

    setCurrentPosLoading(true);
    fetchPositionMoves(referenceDb, boardFen)
      .then((data) => {
        setDbMovesMap((prev) => {
          if (prev.has(boardFen)) return prev; // may have been filled by coverage meanwhile
          const next = new Map(prev);
          next.set(boardFen, data);
          return next;
        });
        setCurrentPosLoading(false);
      })
      .catch(() => setCurrentPosLoading(false));
  }, [currentNode.fen, referenceDb, dbMovesMap]);

  useEffect(() => {
    if (!referenceDb) {
      setCoverageMap(new Map());
      setGamesMap(new Map());
      setMissingGamesMap(new Map());
      setDbMovesMap(new Map());
      setCoverageLoading(false);
      firstCoverageRun.current = true;
      return;
    }

    if (!dirty && !firstCoverageRun.current) {
      return;
    }

    const version = ++coverageVersionRef.current;
    firstCoverageRun.current = false;
    setCoverageLoading(true);

    computeTreeCoverage(root, orientation, referenceDb, minGames, startPath, startStateMoves).then(
      (result) => {
        if (version === coverageVersionRef.current) {
          setCoverageMap(result.coverageMap);
          setGamesMap(result.gamesMap);
          setMissingGamesMap(result.missingGamesMap);
          setDbMovesMap(result.dbMovesMap);
          setCoverageLoading(false);
          store.getState().save(); // sets dirty to false
        }
      },
    );
  }, [referenceDb, minGames, orientation, dirty, root, startStateMoves]);

  const nodeToPath = useMemo(() => {
    const map = new Map<TreeNode, number[]>();
    for (const entries of Object.values(boardStateMap)) {
      for (const { node, path } of entries) {
        map.set(node, path);
      }
    }
    return map;
  }, [boardStateMap]);

  const transpositionMoves = useMemo(() => {
    const boardFen = getBoardState(currentNode.fen);
    const entries = boardStateMap[boardFen] || [];
    const moveMap = new Map<string, number[]>();
    for (const { node, path } of entries) {
      if (!isPrefix(startPath, path)) continue;
      for (const child of node.children) {
        if (child.san && !moveMap.has(child.san)) {
          const childPath = nodeToPath.get(child);
          if (childPath && isPrefix(startPath, childPath)) {
            moveMap.set(child.san, childPath);
          }
        }
      }
    }
    return moveMap;
  }, [currentNode.fen, boardStateMap, nodeToPath, startPath]);

  const positionMoves = useMemo(() => {
    const boardFen = getBoardState(currentNode.fen);
    const dbData = dbMovesMap.get(boardFen);
    const movesFromDb = dbData?.moves ?? [];
    const total = dbData?.total ?? 0;

    const dbMoveMap = new Map(movesFromDb.map((m) => [m.move, m]));

    const allMoves: PositionMove[] = [];
    const seenSans = new Set<string>();

    // Prepared moves (always available)
    for (const [san, targetPath] of transpositionMoves) {
      const dbMove = dbMoveMap.get(san);
      const games = dbMove ? dbMove.white + dbMove.draw + dbMove.black : 0;
      const coveragePath = targetPath.join(",");
      const coverage = coverageMap.get(coveragePath) ?? 0;
      seenSans.add(san);
      allMoves.push({
        san,
        games,
        totalGames: total,
        frequency: total > 0 ? games / total : 0,
        white: dbMove ? (games > 0 ? dbMove.white / games : 0) : 0,
        draw: dbMove ? (games > 0 ? dbMove.draw / games : 0) : 0,
        black: dbMove ? (games > 0 ? dbMove.black / games : 0) : 0,
        inRepertoire: true,
        coverage,
        path: targetPath,
      });
    }

    // DB moves not in repertoire
    for (const dbMove of movesFromDb) {
      if (!seenSans.has(dbMove.move)) {
        const games = dbMove.white + dbMove.draw + dbMove.black;
        allMoves.push({
          san: dbMove.move,
          games,
          totalGames: total,
          frequency: total > 0 ? games / total : 0,
          white: games > 0 ? dbMove.white / games : 0,
          draw: games > 0 ? dbMove.draw / games : 0,
          black: games > 0 ? dbMove.black / games : 0,
          inRepertoire: false,
          coverage: 0,
          path: [],
        });
      }
    }

    return allMoves.sort((a, b) => b.frequency - a.frequency);
  }, [currentNode.fen, dbMovesMap, transpositionMoves, coverageMap]);

  const isUserTurn =
    orientation === "white" ? currentNode.halfMoves % 2 === 0 : currentNode.halfMoves % 2 === 1;

  const handleMoveClick = useCallback(
    (move: PositionMove) => {
      if (move.inRepertoire && move.path.length > 0) {
        goToMove(move.path);
      } else {
        makeMove({ payload: move.san });
      }
    },
    [goToMove, makeMove],
  );

  const nextGap = useMemo(
    () => findNextGap(root, position, orientation, coverageMap, gamesMap, minGames),
    [root, position, orientation, coverageMap, gamesMap, minGames],
  );

  const biggestGap = useMemo(
    () =>
      findBiggestGap(
        root,
        orientation,
        coverageMap,
        gamesMap,
        missingGamesMap,
        minGames,
        startPath,
      ),
    [root, orientation, coverageMap, gamesMap, missingGamesMap, startPath, minGames],
  );

  if (!currentTab) return null;

  if (!referenceDb) {
    return (
      <Stack p="sm">
        <TreeStatsBar stats={stats} t={t} />
        <Alert icon={<IconInfoCircle />}>{t("Board.Practice.Build.NoRefDb")}</Alert>
      </Stack>
    );
  }

  return (
    <Stack h="100%" p="sm" gap={0} style={{ overflow: "hidden" }}>
      {isBeforeStart && (
        <Paper p="sm" my="sm" withBorder>
          <Stack gap="xs">
            <Text fz="xs" c="dimmed">
              {t("Board.Practice.Build.BeforeStart")}
            </Text>
            <Button
              leftSection={<IconPlayerPlay size={16} />}
              variant="light"
              size="xs"
              onClick={() => goToMove(startPath)}
            >
              {t("Board.Practice.Build.GoToStart")}
            </Button>
          </Stack>
        </Paper>
      )}

      {!hasStart && !isEmptyTree && (
        <Paper p="sm" my="sm" withBorder>
          <Stack gap="xs">
            <Text fz="xs" c="dimmed">
              {t("Board.Practice.MarkStart")}
            </Text>
            <Button
              leftSection={<IconFlag size={16} />}
              variant="light"
              size="xs"
              onClick={() => setStart(position)}
            >
              {t("Board.Practice.Build.SetAsStart")}
            </Button>
          </Stack>
        </Paper>
      )}

      {isEmptyTree && position.length === 0 && (
        <Paper p="sm" my="sm" withBorder>
          <Stack gap="xs">
            <Text fz="sm" fw={600}>
              {t("Board.Practice.Build.Presets")}
            </Text>
            <Text fz="xs" c="dimmed">
              {t("Board.Practice.Build.PresetsDesc")}
            </Text>
            <Stack gap={4}>
              {(orientation === "white"
                ? [
                    {
                      name: "Italian Game",
                      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
                    },
                    {
                      name: "Ruy Lopez",
                      moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
                    },
                    { name: "Catalan", moves: ["d4", "Nf6", "c4", "e6", "g3"] },
                  ]
                : [
                    { name: "French Defense", moves: ["e4", "e6", "d4", "d5"] },
                    { name: "King's Indian", moves: ["d4", "Nf6", "c4", "g6"] },
                    {
                      name: "Najdorf",
                      moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
                    },
                  ]
              ).map((preset) => (
                <Button
                  key={preset.name}
                  variant="default"
                  size="xs"
                  justify="start"
                  onClick={() => {
                    makeMoves({ payload: preset.moves });
                    setStart(Array(preset.moves.length).fill(0));
                  }}
                >
                  {preset.name}
                </Button>
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}

      <MovesView
        isUserTurn={isUserTurn}
        currentNode={currentNode}
        positionMoves={positionMoves}
        coverageMap={coverageMap}
        coverageLoading={coverageLoading}
        currentPosLoading={currentPosLoading}
        root={root}
        nextGap={nextGap}
        biggestGap={biggestGap}
        goToMove={goToMove}
        onMoveClick={handleMoveClick}
        t={t}
        minGames={minGames}
        boardStateMap={boardStateMap}
        nodeToPath={nodeToPath}
        startPath={startPath}
      />

      <Divider pb="sm" />
      <TreeStatsBar stats={stats} t={t} />
    </Stack>
  );
}

function TreeStatsBar({
  stats,
  t,
}: {
  stats: { leafs: number; depth: number; total: number };
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <Group gap="md">
      <Text fz="xs" c="dimmed">
        {t("Board.Practice.Variations")}: {stats.leafs}
      </Text>
      <Text fz="xs" c="dimmed">
        {t("Board.Practice.MaxDepth")}: {stats.depth}
      </Text>
      <Text fz="xs" c="dimmed">
        {t("Board.Practice.TotalMoves")}: {stats.total}
      </Text>
    </Group>
  );
}

type TResponse = {
  san: string;
  halfMoves: number;
  childPath: number[];
  coverage: number;
  dbGames: number;
  dbFrequency: number;
  white: number;
  draw: number;
  black: number;
};

function MovesView({
  isUserTurn,
  currentNode,
  positionMoves,
  coverageMap,
  coverageLoading,
  root,
  nextGap,
  biggestGap,
  goToMove,
  onMoveClick,
  t,
  minGames,
  boardStateMap,
  nodeToPath,
  startPath,
}: {
  isUserTurn: boolean;
  currentNode: TreeNode;
  positionMoves: PositionMove[];
  coverageMap: Map<string, number>;
  coverageLoading: boolean;
  currentPosLoading: boolean;
  root: TreeNode;
  nextGap: number[] | null;
  biggestGap: number[] | null;
  goToMove: (path: number[]) => void;
  onMoveClick: (move: PositionMove) => void;
  t: ReturnType<typeof useTranslation>["t"];
  minGames: number;
  boardStateMap: Record<string, { node: TreeNode; path: number[] }[]>;
  nodeToPath: Map<TreeNode, number[]>;
  startPath: number[];
}) {
  const unifiedUserResponses: TResponse[] = useMemo(() => {
    if (!isUserTurn) return [];
    const boardFen = getBoardState(currentNode.fen);
    const entries = boardStateMap[boardFen] || [];
    const seenSans = new Set<string>();
    const responses: TResponse[] = [];

    for (const { node, path } of entries) {
      if (!isPrefix(startPath, path)) continue;
      for (const child of node.children) {
        if (child.san && !seenSans.has(child.san)) {
          const childPath = nodeToPath.get(child);
          if (childPath && isPrefix(startPath, childPath)) {
            seenSans.add(child.san);
            const coveragePath = childPath.join(",");
            const coverage = coverageMap.get(coveragePath) ?? 0;
            const dbEntry = positionMoves.find((pm) => pm.san === child.san);
            responses.push({
              san: child.san,
              halfMoves: child.halfMoves,
              childPath,
              coverage,
              dbGames: dbEntry?.games ?? 0,
              dbFrequency: dbEntry?.frequency ?? 0,
              white: dbEntry?.white ?? 0,
              draw: dbEntry?.draw ?? 0,
              black: dbEntry?.black ?? 0,
            });
          }
        }
      }
    }
    return responses;
  }, [
    isUserTurn,
    currentNode.fen,
    boardStateMap,
    nodeToPath,
    coverageMap,
    positionMoves,
    startPath,
  ]);

  const hasResponses = unifiedUserResponses.length > 0;
  const [showRare, setShowRare] = useState(false);

  const relevantMoves = useMemo(
    () => (isUserTurn ? [] : positionMoves.filter((m) => m.games >= minGames)),
    [isUserTurn, positionMoves, minGames],
  );

  const rareMoves = useMemo(
    () => (isUserTurn ? [] : positionMoves.filter((m) => m.games < minGames)),
    [isUserTurn, positionMoves, minGames],
  );

  const nextGapLabel = useMemo(() => {
    if (!nextGap) return null;
    const node = getNodeAtPath(root, nextGap);
    return node.san ? formatMoveNotation(node.halfMoves, node.san) : null;
  }, [nextGap, root]);

  const biggestGapLabel = useMemo(() => {
    if (!biggestGap) return null;
    const node = getNodeAtPath(root, biggestGap);
    return node.san ? formatMoveNotation(node.halfMoves, node.san) : null;
  }, [biggestGap, root]);

  const title = isUserTurn
    ? t("Board.Practice.Build.YourResponse")
    : t("Board.Practice.Build.OpponentMoves");

  if (positionMoves.length === 0 && !hasResponses) {
    return (
      <ScrollArea style={{ flex: 1 }} pt="sm">
        <Stack gap="md">
          <Stack align="center" py="xl">
            <Text c="dimmed" fz="sm">
              {t("Board.Practice.Build.NoMovesFound")}
            </Text>
          </Stack>
          {coverageLoading ? (
            <>
              <Divider />
              <Group justify="center" py="sm" gap="xs">
                <Loader size={12} />
                <Text fz="xs" c="dimmed">
                  {t("Board.Practice.Build.Loading")}
                </Text>
              </Group>
            </>
          ) : (
            (nextGap || biggestGap) && (
              <>
                <Divider />
                <Stack gap={0}>
                  {nextGap && (
                    <GapButton
                      label={t("Board.Practice.Build.NextGap")}
                      detail={nextGapLabel}
                      onClick={() => goToMove(nextGap)}
                    />
                  )}
                  {biggestGap && (
                    <GapButton
                      label={t("Board.Practice.Build.BiggestGap")}
                      detail={biggestGapLabel}
                      onClick={() => goToMove(biggestGap)}
                    />
                  )}
                </Stack>
              </>
            )
          )}
        </Stack>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea style={{ flex: 1 }} pt="sm">
      <Stack gap="md">
        <Stack gap={0}>
          <Group justify="space-between" mb={4} px="xs">
            <Text fz="xs" fw={600} style={{ flex: 1 }}>
              {title}
            </Text>
            <Group gap="xs" wrap="nowrap">
              <Text fz="xs" c="dimmed" w={50} ta="center">
                %
              </Text>
              <Text fz="xs" c="dimmed" w={70} ta="center">
                {t("Common.Games")}
              </Text>
              <Text fz="xs" c="dimmed" w={100} ta="center">
                {t("Board.Practice.Build.Results")}
              </Text>
              {(hasResponses || coverageLoading) && (
                <Group gap={4} w={100} justify="center" wrap="nowrap">
                  <Text fz="xs" c="dimmed" ta="center">
                    {t("Board.Practice.Build.YourCoverage")}
                  </Text>
                  {coverageLoading && <Loader size={10} />}
                </Group>
              )}
            </Group>
          </Group>

          {isUserTurn &&
            hasResponses &&
            unifiedUserResponses.map((response) => (
              <MoveRow
                key={response.san}
                move={{
                  san: response.san,
                  games: response.dbGames,
                  totalGames: 0,
                  frequency: response.dbFrequency,
                  white: response.white,
                  draw: response.draw,
                  black: response.black,
                  inRepertoire: true,
                  coverage: response.coverage,
                  path: response.childPath,
                }}
                halfMoves={response.halfMoves}
                onClick={() => goToMove(response.childPath)}
                dimmed={false}
                showCoverage
                minGames={minGames}
              />
            ))}

          {isUserTurn &&
            !hasResponses &&
            positionMoves.map((move) => (
              <MoveRow
                key={move.san}
                move={move}
                halfMoves={currentNode.halfMoves + 1}
                onClick={() => onMoveClick(move)}
                dimmed={false}
                showCoverage={false}
                minGames={minGames}
              />
            ))}

          {!isUserTurn &&
            relevantMoves.map((move) => (
              <MoveRow
                key={move.san}
                move={move}
                halfMoves={currentNode.halfMoves + 1}
                onClick={() => onMoveClick(move)}
                dimmed={false}
                minGames={minGames}
              />
            ))}

          {!isUserTurn && rareMoves.length > 0 && relevantMoves.length > 0 && (
            <UnstyledButton
              onClick={() => setShowRare((v) => !v)}
              px="xs"
              py={6}
              style={{ width: "100%" }}
            >
              <Group gap="xs" justify="center">
                <Divider style={{ flex: 1 }} />
                <Group gap={4} wrap="nowrap">
                  {showRare ? (
                    <IconChevronDown size={12} color="var(--mantine-color-dimmed)" />
                  ) : (
                    <IconChevronRight size={12} color="var(--mantine-color-dimmed)" />
                  )}
                  <Text fz="xs" c="dimmed">
                    {t("Board.Practice.Build.RareMoves")}
                  </Text>
                </Group>
                <Divider style={{ flex: 1 }} />
              </Group>
            </UnstyledButton>
          )}

          {!isUserTurn &&
            (showRare || relevantMoves.length === 0) &&
            rareMoves.map((move) => (
              <MoveRow
                key={move.san}
                move={move}
                halfMoves={currentNode.halfMoves + 1}
                onClick={() => onMoveClick(move)}
                dimmed
                minGames={minGames}
              />
            ))}
        </Stack>

        {coverageLoading && (
          <>
            <Divider />
            <Group justify="center" py="sm" gap="xs">
              <Loader size={12} />
              <Text fz="xs" c="dimmed">
                {t("Board.Practice.Build.Loading")}
              </Text>
            </Group>
          </>
        )}

        {!coverageLoading && (
          <>
            {(nextGap || biggestGap) && (
              <>
                <Divider />
                <Stack gap={0}>
                  {nextGap && (
                    <GapButton
                      label={t("Board.Practice.Build.NextGap")}
                      detail={nextGapLabel}
                      onClick={() => goToMove(nextGap)}
                    />
                  )}
                  {biggestGap && (
                    <GapButton
                      label={t("Board.Practice.Build.BiggestGap")}
                      detail={biggestGapLabel}
                      onClick={() => goToMove(biggestGap)}
                    />
                  )}
                </Stack>
              </>
            )}

            {!nextGap && !biggestGap && (isUserTurn ? hasResponses : positionMoves.length > 0) && (
              <>
                <Divider />
                <Paper p="sm" withBorder>
                  <Group gap="xs" justify="center">
                    <ThemeIcon size="sm" color="green" variant="light" radius="xl">
                      <IconCheck size={14} />
                    </ThemeIcon>
                    <Text fz="sm" c="green" fw={500}>
                      {t("Board.Practice.Build.NoGapsFound")}
                    </Text>
                  </Group>
                </Paper>
              </>
            )}
          </>
        )}
      </Stack>
    </ScrollArea>
  );
}

function getCoverageColor(coverage: number): string {
  if (coverage <= 0) return "gray";
  if (coverage < 0.33) return "red";
  if (coverage < 0.67) return "yellow";
  return "green";
}

function MoveRow({
  move,
  halfMoves,
  onClick,
  dimmed,
  showCoverage = true,
  minGames,
}: {
  move: PositionMove;
  halfMoves: number;
  onClick: () => void;
  dimmed: boolean;
  showCoverage?: boolean;
  minGames: number;
}) {
  const { t } = useTranslation();
  const notation = formatMoveNotation(halfMoves, move.san);
  const coverageColor = getCoverageColor(move.coverage);
  const pct = move.frequency > 0 ? `${(move.frequency * 100).toFixed(0)}%` : "—";
  const [wPct, dPct, bPct] = roundKeepSum([move.white * 100, move.draw * 100, move.black * 100]);

  return (
    <UnstyledButton
      onClick={onClick}
      py="sm"
      px="xs"
      className={classes.moveRow}
      style={{
        borderBottom: "1px solid var(--mantine-color-dark-5)",
        borderRadius: 0,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} fz="sm">
            {notation}
          </Text>
          {move.inRepertoire && (
            <ThemeIcon size="xs" color="green" variant="transparent">
              <IconCheck size={12} />
            </ThemeIcon>
          )}
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Text fz="sm" c="dimmed" w={50} ta="center">
            {pct}
          </Text>
          <Text fz="sm" c="dimmed" w={70} ta="center">
            {move.games > 0 ? move.games.toLocaleString() : "—"}
          </Text>
          <Tooltip label={`${wPct}% / ${dPct}% / ${bPct}%`} position="top" withArrow>
            <Progress.Root size="xl" w={100}>
              <Progress.Section value={wPct} color="white">
                {wPct > 20 && <Progress.Label c="black">{wPct}</Progress.Label>}
              </Progress.Section>
              <Progress.Section value={dPct} color="gray">
                {dPct > 20 && <Progress.Label>{dPct}</Progress.Label>}
              </Progress.Section>
              <Progress.Section value={bPct} color="dark">
                {bPct > 20 && <Progress.Label>{bPct}</Progress.Label>}
              </Progress.Section>
            </Progress.Root>
          </Tooltip>
          {showCoverage && (
            <Box w={100}>
              {dimmed || move.games < minGames ? (
                <Tooltip label={t("Board.Practice.Build.RareTooltip")} withArrow>
                  <Text fz="xs" c="dimmed" ta="center">
                    N/A
                  </Text>
                </Tooltip>
              ) : (
                <Progress
                  value={move.inRepertoire ? Math.max(move.coverage * 100, 3) : 0}
                  color={coverageColor}
                  size="sm"
                  radius="xl"
                />
              )}
            </Box>
          )}
        </Group>
      </Group>
    </UnstyledButton>
  );
}

function GapButton({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string | null;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      py="sm"
      px="xs"
      style={{
        borderBottom: "1px solid var(--mantine-color-dark-5)",
        borderRadius: 0,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Text fz="sm" fw={500}>
          {label}
        </Text>
        <Group gap="xs" wrap="nowrap">
          {detail && (
            <Text fz="sm" c="dimmed">
              {detail}
            </Text>
          )}
          <IconChevronRight size={16} color="var(--mantine-color-dimmed)" />
        </Group>
      </Group>
    </UnstyledButton>
  );
}

export default RepertoireInfo;
