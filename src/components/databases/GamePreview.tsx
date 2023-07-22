import { AspectRatio, Container } from "@mantine/core";
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
        {" "}
        <Container sx={{ width: "100%" }} onClick={() => goToGame()}>
          <AspectRatio ratio={1} mx="15%">
            <PreviewBoard />
          </AspectRatio>
          {!hideControls && (
            <>
              <GameNotation boardSize={400} />
              <MoveControls
                goToStart={() => dispatch({ type: "GO_TO_START" })}
                goToEnd={() => dispatch({ type: "GO_TO_END" })}
                goToNext={() => dispatch({ type: "GO_TO_NEXT" })}
                goToPrevious={() => dispatch({ type: "GO_TO_PREVIOUS" })}
              />
            </>
          )}
        </Container>
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
      animation={{
        enabled: false,
      }}
      style={{ justifyContent: "start" }}
      width={"100%"}
      height={"100%"}
      viewOnly={true}
      fen={fen}
    />
  );
}

export default GamePreview;
