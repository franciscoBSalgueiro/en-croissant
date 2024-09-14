import { Chessground } from "@/chessground/Chessground";
import { parsePGN } from "@/utils/chess";
import {
  type GameHeaders,
  type TreeState,
  getNodeAtPath,
} from "@/utils/treeReducer";
import { Box, Group, Stack, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useContext, useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { useStore } from "zustand";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import OpeningName from "../common/OpeningName";
import {
  TreeStateContext,
  TreeStateProvider,
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
  const { ref: boardRef, height } = useElementSize();

  return (
    <TreeStateProvider initial={game}>
      {showOpening && <OpeningName />}
      <Group align="start" grow style={{ overflow: "hidden", height: "100%" }}>
        <Box ref={boardRef}>
          <PreviewBoard />
        </Box>
        {!hideControls && (
          <Stack style={{ height }} gap="xs">
            <GameNotation />
            <MoveControls readOnly />
          </Stack>
        )}
      </Group>
    </TreeStateProvider>
  );
}

function PreviewBoard() {
  const store = useContext(TreeStateContext)!;
  const goToNext = useStore(store, (s) => s.goToNext);
  const goToPrevious = useStore(store, (s) => s.goToPrevious);
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const headers = useStore(store, (s) => s.headers);
  const node = getNodeAtPath(root, position);
  const fen = node.fen;

  return (
    <Box
      onWheel={(e) => {
        if (e.deltaY > 0) {
          goToNext();
        } else {
          goToPrevious();
        }
      }}
    >
      <Chessground
        coordinates={false}
        viewOnly={true}
        fen={fen}
        orientation={headers.orientation || "white"}
      />
    </Box>
  );
}

export default GamePreviewWrapper;
