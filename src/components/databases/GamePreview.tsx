import { AspectRatio, Group, Stack } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useRouter } from "next/router";
import { useContext, useEffect } from "react";
import Chessground from "react-chessground";
import MoveControls from "../common/MoveControls";
import { useSetAtom } from "jotai";
import { activeTabAtom } from "@/atoms/atoms";
import GameNotation from "../boards/GameNotation";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import { useImmerReducer } from "use-immer";
import { parsePGN } from "@/utils/chess";
import treeReducer, { defaultTree, getNodeAtPath } from "@/utils/treeReducer";

function GamePreview({
  id,
  pgn,
  hideControls,
}: {
  id?: string;
  pgn: string;
  hideControls?: boolean;
}) {
  const router = useRouter();

  const setActiveTab = useSetAtom(activeTabAtom);

  function goToGame() {
    if (id) {
      setActiveTab(id);
      router.push("/boards");
    }
  }

  const [treeState, dispatch] = useImmerReducer(
    treeReducer,
    undefined,
    defaultTree
  );

  useEffect(() => {
    async function loadPGN() {
      const parsed = await parsePGN(pgn);
      dispatch({ type: "SET_STATE", payload: parsed });
    }
    loadPGN();
  }, [dispatch, pgn]);

  useHotkeys([
    ["ArrowLeft", () => dispatch({ type: "GO_TO_PREVIOUS" })],
    ["ArrowRight", () => dispatch({ type: "GO_TO_NEXT" })],
  ]);

  return (
    <TreeStateContext.Provider value={treeState}>
      <TreeDispatchContext.Provider value={dispatch}>
        <Group onClick={() => goToGame()} grow>
          <AspectRatio ratio={1}>
            <PreviewBoard />
          </AspectRatio>
          {!hideControls && (
            <Stack>
              <GameNotation boardSize={700} />
              <MoveControls
                goToStart={() => dispatch({ type: "GO_TO_START" })}
                goToEnd={() => dispatch({ type: "GO_TO_END" })}
                goToNext={() => dispatch({ type: "GO_TO_NEXT" })}
                goToPrevious={() => dispatch({ type: "GO_TO_PREVIOUS" })}
              />
            </Stack>
          )}
        </Group>
      </TreeDispatchContext.Provider>
    </TreeStateContext.Provider>
  );
}

function PreviewBoard() {
  const tree = useContext(TreeStateContext);
  const node = getNodeAtPath(tree.root, tree.position);
  const fen = node.fen;

  return (
    <Chessground
      coordinates={false}
      style={{ justifyContent: "start" }}
      width={"100%"}
      height={"100%"}
      viewOnly={true}
      fen={fen}
      orientation={tree.headers.orientation || "white"}
    />
  );
}

export default GamePreview;
