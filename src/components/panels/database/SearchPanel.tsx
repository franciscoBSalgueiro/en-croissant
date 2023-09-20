import { referenceDbAtom } from "@/atoms/atoms";
import PiecesGrid from "@/components/boards/PiecesGrid";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { EMPTY_BOARD } from "@/utils/chess";
import { NormalizedGame, searchPosition } from "@/utils/db";
import { getNodeAtPath } from "@/utils/treeReducer";
import { ScrollArea, Stack, Group, Button, Box } from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { useAtomValue } from "jotai";
import { useRef, useContext, useState } from "react";
import GamesTable from "./GamesTable";
import { Chessground } from "@/chessground/Chessground";

async function similarStructure(fen: string) {
  return await invoke<string>("similar_structure", { fen });
}

function SearchPanel() {
  const boardRef = useRef(null);
  const tree = useContext(TreeStateContext);
  const node = getNodeAtPath(tree.root, tree.position);
  const [fen, setFen] = useState(EMPTY_BOARD);
  const [games, setGames] = useState<NormalizedGame[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSimilarStructure = async (fen: string) => {
    const fenResult = await similarStructure(fen);
    setFen(fenResult);
  };

  const referenceDb = useAtomValue(referenceDbAtom);

  return (
    <ScrollArea h={600}>
      <Stack>
        <Group>
          <Button onClick={() => setFen(node.fen)}>Game</Button>
          <Button onClick={() => fetchSimilarStructure(node.fen)}>
            Similar Structure
          </Button>
          <Button onClick={() => setFen(EMPTY_BOARD)}>Empty</Button>
        </Group>
        <Group>
          <Box ref={boardRef}>
            <Chessground
              width={450}
              height={450}
              fen={fen}
              coordinates={false}
              movable={{
                free: true,
                color: "both",
                events: {
                  after: (orig, dest) => {
                    invoke<string>("make_move", {
                      fen,
                      from: orig,
                      to: dest,
                    }).then((newFen) => {
                      setFen(newFen);
                    });
                  },
                },
              }}
            />
          </Box>
          <PiecesGrid
            boardRef={boardRef}
            fen={fen}
            vertical
            onPut={(newFen) => {
              setFen(newFen);
            }}
          />
        </Group>
        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            const openings = await searchPosition(referenceDb!, "partial", fen);
            setGames(openings[1]);
            setLoading(false);
          }}
        >
          Search
        </Button>
        {games.length > 0 && (
          <GamesTable games={games} height={300} loading={false} />
        )}
      </Stack>
    </ScrollArea>
  );
}

export default SearchPanel;
