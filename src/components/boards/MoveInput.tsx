import { parseKeyboardMove } from "@/utils/chess";
import type { TreeNode } from "@/utils/treeReducer";
import { Input } from "@mantine/core";
import { useContext, useState } from "react";
import { useStore } from "zustand";
import { TreeStateContext } from "../common/TreeStateContext";

export default function MoveInput({ currentNode }: { currentNode: TreeNode }) {
  const store = useContext(TreeStateContext)!;
  const makeMove = useStore(store, (s) => s.makeMove);
  const [move, setMove] = useState("");
  const [error, setError] = useState("");

  return (
    <Input
      placeholder="Enter move"
      size="sm"
      onChange={(e) => {
        setMove(e.currentTarget.value);
        setError("");
      }}
      error={error}
      value={move}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const m = move.trim();
          if (m.length > 0) {
            const parsed = parseKeyboardMove(m, currentNode.fen);
            if (parsed) {
              makeMove({ payload: parsed });
              setMove("");
            } else {
              setError("Invalid move");
            }
          }
        }
      }}
    />
  );
}
