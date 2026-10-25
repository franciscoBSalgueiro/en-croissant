import {
  Group,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconSitemap } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { commands, events, type IdeaTree, type TreeNode, type TreeUpdateEvent } from "@/bindings";
import ProgressButton from "@/components/common/ProgressButton";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { formatNumber } from "@/utils/format";
import type { LocalEngine } from "@/utils/engines";
import { formatScore } from "@/utils/score";
import { unwrap } from "@/utils/unwrap";

/** Scores in the tree are white-POV centipawns (see backend `idea.rs`). */
function isWhiteToMove(fen: string): boolean {
  return fen.split(" ")[1] !== "b";
}

function formatCp(scoreCp: number | null): string {
  return scoreCp === null ? "–" : formatScore({ type: "cp", value: scoreCp });
}

/** Best line from the root, always picking the best evaluated child for the
 * side to move (mirrors the backend `best_line` walk, used for resumed trees). */
function bestLineOfTree(tree: IdeaTree): { sans: string[]; scoreCp: number | null } {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const root = tree.nodes[0];
  const sans: string[] = [];
  let score = root?.score_cp ?? null;
  let current = root;
  while (current) {
    const candidates = current.children
      .map((id) => byId.get(id))
      .filter((n): n is TreeNode => !!n && n.evaluated && n.score_cp !== null);
    if (candidates.length === 0) break;
    const best = candidates.reduce((a, b) => {
      const av = a.score_cp as number;
      const bv = b.score_cp as number;
      if (isWhiteToMove(current!.fen)) return bv > av ? b : a;
      return bv < av ? b : a;
    });
    sans.push(best.san);
    score = best.score_cp;
    current = best;
  }
  return { sans, scoreCp: score };
}

function TreePanel() {
  const { t } = useTranslation();

  const activeTab = useAtomValue(activeTabAtom);
  const treeId = `tree_${activeTab}`;

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.root.fen);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );

  const engines = useAtomValue(enginesAtom);
  const localEngines = useMemo(
    () => (engines ?? []).filter((e): e is LocalEngine => e.type === "local"),
    [engines],
  );

  const [engineId, setEngineId] = useState(localEngines[0]?.id ?? "");
  const [depth, setDepth] = useState(18);
  const [branching, setBranching] = useState(3);
  const [maxNodes, setMaxNodes] = useState(500);

  const [inProgress, setInProgress] = useState(false);
  const [tree, setTree] = useState<IdeaTree | null>(null);
  const [latest, setLatest] = useState<TreeUpdateEvent | null>(null);

  useEffect(() => {
    if (localEngines.length === 0) {
      setEngineId("");
      return;
    }
    if (!localEngines.some((e) => e.id === engineId)) {
      setEngineId(localEngines[0].id);
    }
  }, [localEngines, engineId]);

  // Resume view: load the persisted tree for this tab, if any.
  useEffect(() => {
    commands.getTree(treeId).then((res) => {
      if (res.status === "ok" && res.data) {
        setTree(res.data);
      }
    });
  }, [treeId]);

  // Live updates from the background tree analysis.
  useEffect(() => {
    const unlisten = events.treeUpdateEvent.listen(({ payload }) => {
      if (payload.id === treeId) {
        setLatest(payload);
        setTree(payload.tree);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [treeId]);

  const start = useCallback(() => {
    const engine = localEngines.find((e) => e.id === engineId);
    if (!engine) return;
    setInProgress(true);
    commands
      .startTreeAnalysis(treeId, activeTab!, {
        fen,
        moves,
        engine_path: engine.path,
        engine_options: [],
        depth,
        branching,
        max_nodes: maxNodes,
      })
      .then((res) => {
        unwrap(res);
      })
      .catch(() => setInProgress(false));
  }, [localEngines, engineId, treeId, activeTab, fen, moves, depth, branching, maxNodes]);

  const stop = useCallback(() => {
    commands.stopTreeAnalysis(treeId).then((res) => {
      if (res.status === "ok") {
        setLatest(null);
        setTree(res.data);
      } else {
        unwrap(res);
      }
    });
  }, [treeId]);

  const derived = useMemo(() => (tree ? bestLineOfTree(tree) : null), [tree]);

  const nodesDone = latest?.nodes_done ?? (tree ? tree.nodes.filter((n) => n.evaluated).length : 0);
  const bestLineSan = latest?.best_line_san ?? derived?.sans ?? [];
  const bestScoreCp = latest !== null ? latest.best_score_cp : (derived?.scoreCp ?? null);

  // Root moves sorted best first for the side to move in the root position.
  const rootChildren = useMemo(() => {
    if (!tree || tree.nodes.length === 0) return [];
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    const root = tree.nodes[0];
    const whiteToMove = isWhiteToMove(root.fen);
    const children = root.children.map((id) => byId.get(id)).filter((n): n is TreeNode => !!n);
    const withScore = children.filter((n) => n.score_cp !== null);
    const withoutScore = children.filter((n) => n.score_cp === null);
    withScore.sort((a, b) => {
      const av = a.score_cp as number;
      const bv = b.score_cp as number;
      return whiteToMove ? bv - av : av - bv;
    });
    return [...withScore, ...withoutScore];
  }, [tree]);

  // Relative mini bar: goodness of each child for the side to move, normalized
  // between the worst and best root move.
  const rootBars = useMemo(() => {
    const whiteToMove = tree && tree.nodes.length > 0 ? isWhiteToMove(tree.nodes[0].fen) : true;
    const sign = whiteToMove ? 1 : -1;
    const goodness = rootChildren.map((n) => (n.score_cp === null ? null : sign * n.score_cp));
    const values = goodness.filter((g): g is number => g !== null);
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    return goodness.map((g) =>
      g === null ? 0 : max === min ? 100 : ((g - min) / (max - min)) * 100,
    );
  }, [rootChildren, tree]);

  return (
    <ScrollArea offsetScrollbars>
      <Stack mb="lg" gap="0.4rem" mr="xs">
        <Paper withBorder p="xs">
          <Stack gap="xs">
            <Select
              allowDeselect={false}
              label={t("Common.Engine")}
              placeholder={t("Common.PickValue")}
              value={engineId || null}
              onChange={(id) => setEngineId(id ?? "")}
              data={localEngines.map((e) => ({ value: e.id, label: e.name }))}
            />
            <Group grow gap="xs" wrap="wrap">
              <NumberInput
                label={t("GoMode.Depth")}
                min={1}
                value={depth}
                onChange={(v) => setDepth(typeof v === "number" ? v : Number(v) || 0)}
              />
              <NumberInput
                label={t("Board.Analysis.Branching")}
                min={1}
                value={branching}
                onChange={(v) => setBranching(typeof v === "number" ? v : Number(v) || 0)}
              />
              <NumberInput
                label={t("Board.Analysis.MaxNodes")}
                min={1}
                value={maxNodes}
                onChange={(v) => setMaxNodes(typeof v === "number" ? v : Number(v) || 0)}
              />
            </Group>
            {localEngines.length === 0 && (
              <Text fz="sm" c="orange">
                {t("Board.Analysis.NoEngineHint")}
              </Text>
            )}
            <Text fz="xs" c="dimmed">
              {t("Board.Analysis.TreeResumeNote")}
            </Text>
          </Stack>
        </Paper>

        <ProgressButton
          id={treeId}
          redoable
          disabled={localEngines.length === 0}
          leftIcon={<IconSitemap size="0.875rem" />}
          onClick={start}
          onCancel={stop}
          initInstalled={false}
          labels={{
            action: t("Board.Analysis.Analyze"),
            completed: t("Board.Analysis.TreeDone"),
            inProgress: t("Board.Analysis.TreeAnalyzing"),
          }}
          inProgress={inProgress}
          setInProgress={setInProgress}
        />

        {tree ? (
          <>
            <Paper withBorder p="xs">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fz="sm" c="dimmed">
                    {t("Board.Analysis.NodesEvaluated")}: {formatNumber(nodesDone)}
                  </Text>
                </Group>
                {bestLineSan.length > 0 && (
                  <Group gap="xs" wrap="nowrap">
                    <Text fz="sm" fw={500}>
                      {bestLineSan.join(" ")}
                    </Text>
                    {bestScoreCp !== null && (
                      <Text fz="sm" c="dimmed">
                        ({formatCp(bestScoreCp)})
                      </Text>
                    )}
                  </Group>
                )}
              </Stack>
            </Paper>

            <Paper withBorder p="xs">
              <Stack gap="xs">
                <Text fw={500} fz="sm">
                  {t("Board.Analysis.RootMoves")}
                </Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("Board.Analysis.Move")}</Table.Th>
                      <Table.Th>{t("Board.Analysis.Score")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rootChildren.map((child, i) => (
                      <Table.Tr key={child.id}>
                        <Table.Td fz="sm" fw={500}>
                          {child.san}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                              {formatCp(child.score_cp)}
                            </Text>
                            <Progress value={rootBars[i]} size="sm" flex={1} />
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          </>
        ) : (
          <Text fz="sm" c="dimmed">
            {t("Board.Analysis.NoTree")}
          </Text>
        )}
      </Stack>
    </ScrollArea>
  );
}

export default memo(TreePanel);
