import { Chessground } from "@/chessground/Chessground";
import { getLastMainlinePosition, getOpening, parsePGN } from "@/utils/chess";
import treeReducer, {
  type GameHeaders,
  type TreeState,
  getNodeAtPath,
} from "@/utils/treeReducer";
import { Box, Group, Stack, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useContext, useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { useImmerReducer } from "use-immer";
import GameNotation from "../boards/GameNotation";
import MoveControls from "../common/MoveControls";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";

function GamePreviewWrapper({
  pgn,
  headers,
  hideControls,
  showOpening,
}: {
  pgn: string;
  headers?: GameHeaders;
  hideControls?: boolean;
  showOpening?: boolean;
}) {
  const { data: parsedGame, isLoading } = useSWRImmutable(
    [pgn, headers?.fen],
    async ([pgn, fen]) => {
      return await parsePGN(pgn, fen);
    },
  );

  return (
    <>
      {parsedGame && (
        <GamePreview
          key={pgn}
          game={parsedGame}
          hideControls={hideControls}
          showOpening={showOpening}
        />
      )}
    </>
  );
}

function GamePreview({
  game,
  hideControls,
  showOpening,
}: {
  game: TreeState;
  hideControls?: boolean;
  showOpening?: boolean;
}) {
  const [treeState, dispatch] = useImmerReducer(treeReducer, game);
  const [opening, setOpening] = useState("");
  useEffect(() => {
    getOpening(treeState.root, getLastMainlinePosition(treeState.root)).then(
      (opening) => {
        setOpening(opening);
      },
    );
  }, [treeState.position, treeState.root]);

  const { ref: boardRef, height } = useElementSize();

  return (
    <TreeStateContext.Provider value={treeState}>
      <TreeDispatchContext.Provider value={dispatch}>
        {showOpening && (
          <Text h="2.5rem" fz="sm">
            {opening}
          </Text>
        )}
        <Group
          align="start"
          grow
          style={{ overflow: "hidden", height: "100%" }}
        >
          <Box ref={boardRef}>
            <PreviewBoard />
          </Box>
          {!hideControls && (
            <Stack style={{ height }} gap="xs">
              <GameNotation />
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
  const dispatch = useContext(TreeDispatchContext);
  const node = getNodeAtPath(tree.root, tree.position);
  const fen = node.fen;

  return (
    <Box
      onWheel={(e) => {
        if (e.deltaY > 0) {
          dispatch({
            type: "GO_TO_NEXT",
          });
        } else {
          dispatch({
            type: "GO_TO_PREVIOUS",
          });
        }
      }}
    >
      <Chessground
        coordinates={false}
        viewOnly={true}
        fen={fen}
        orientation={tree.headers.orientation || "white"}
      />
    </Box>
  );
}

export default GamePreviewWrapper;
