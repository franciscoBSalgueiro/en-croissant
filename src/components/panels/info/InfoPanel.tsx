import { Box, ScrollArea, Stack, TextInput } from "@mantine/core";
import { useContext, useState } from "react";
import { getNodeAtPath } from "@/utils/treeReducer";
import GameInfo from "@/components/common/GameInfo";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import GameSelector from "./GameSelector";
import PgnInput from "./PgnInput";
import FileInfo from "./FileInfo";

function InfoPanel({ boardSize }: { boardSize: number }) {
  const tree = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(tree.root, tree.position);
  const [games, setGames] = useState<Map<number, string>>(new Map());

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: `${boardSize / 2}px`,
      }}
    >
      <GameSelector headers={tree.headers} games={games} setGames={setGames} />
      <ScrollArea offsetScrollbars>
        <FileInfo setGames={setGames} />
        <Stack>
          <GameInfo headers={tree.headers} />
          {currentNode && (
            <TextInput
              readOnly
              value={currentNode.fen}
              label="FEN"
              labelProps={{
                sx: {
                  fontWeight: "bold",
                  fontSize: "1rem",
                  marginBottom: "0.5rem",
                },
              }}
            />
          )}
          <PgnInput headers={tree.headers} root={tree.root} />
        </Stack>
      </ScrollArea>
    </Box>
  );
}

export default InfoPanel;
