import { lastMoveEvaluationAtom } from "@/state/atoms";
import { getWinChance, normalizeScore } from "@/utils/score";
import { Group, Text } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useContext } from "react";
import { useStore } from "zustand";
import { TreeStateContext } from "../../common/TreeStateContext";
import ScoreBubble from "./ScoreBubble";
import { positionFromFen } from "@/utils/chessops";
import { type Score } from "@/bindings";
import { type TreeState } from "@/utils/treeReducer";

export default function LastMoveScore() {
  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s: TreeState) => s.root.fen);
  const [pos] = positionFromFen(fen);
  const lastMoveEvaluation = useAtomValue(lastMoveEvaluationAtom);

  if (!lastMoveEvaluation || !pos) {
    return null;
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="sm" fw={500}>
        LAST
      </Text>
      <ScoreBubble score={lastMoveEvaluation.score} size="sm" />
    </Group>
  );
} 