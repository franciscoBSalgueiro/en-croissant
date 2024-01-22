import { Chessground } from "@/chessground/Chessground";
import { parsePGN } from "@/utils/chess";
import treeReducer, {
  GameHeaders,
  TreeState,
  getNodeAtPath,
} from "@/utils/treeReducer";
import { Box, Group, Stack, Text } from "@mantine/core";
import { useContext } from "react";
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
}: {
  pgn: string;
  headers?: GameHeaders;
  hideControls?: boolean;
}) {
  const { data: parsedGame, isLoading } = useSWRImmutable(pgn, async (game) => {
    return await parsePGN(game, headers?.fen);
  });

  return (
    <>
      {isLoading && <Text ta="center">Loading...</Text>}
      {parsedGame && (
        <GamePreview key={pgn} game={parsedGame} hideControls={hideControls} />
      )}
    </>
  );
}

function GamePreview({
  game,
  hideControls,
}: {
  game: TreeState;
  hideControls?: boolean;
}) {
  const [treeState, dispatch] = useImmerReducer(treeReducer, game);

  return (
    <TreeStateContext.Provider value={treeState}>
      <TreeDispatchContext.Provider value={dispatch}>
        <Group grow h="100%" style={{ overflow: "hidden" }}>
          <PreviewBoard />
          {!hideControls && (
            <Stack h="100%">
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
