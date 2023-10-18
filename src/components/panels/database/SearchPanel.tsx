import PiecesGrid from "@/components/boards/PiecesGrid";
import { EMPTY_BOARD } from "@/utils/chess";
import { PositionQuery } from "@/utils/db";
import {
  Text,
  Stack,
  Group,
  Button,
  Box,
  SegmentedControl,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { useEffect, useRef } from "react";
import { Chessground } from "@/chessground/Chessground";

async function similarStructure(fen: string) {
  return await invoke<string>("similar_structure", { fen });
}

function SearchPanel({
  boardFen,
  query,
  setQuery,
}: {
  boardFen: string;
  query: PositionQuery;
  setQuery: React.Dispatch<React.SetStateAction<PositionQuery>>;
}) {
  const boardRef = useRef(null);

  useEffect(() => {
    setQuery((q) => ({ ...q, value: boardFen }));
  }, [boardFen, setQuery]);

  const fetchSimilarStructure = async (fen: string) => {
    const fenResult = await similarStructure(fen);
    setQuery({ type: "partial", value: fenResult });
  };

  return (
    <Stack>
      <Group>
        <Text fw="bold">Position:</Text>
        <SegmentedControl
          data={[
            { value: "exact", label: "Exact" },
            { value: "partial", label: "Partial" },
          ]}
          value={query.type}
          onChange={(v) =>
            setQuery({ ...query, type: v as "exact" | "partial" })
          }
        />
      </Group>

      <Group>
        <Stack>
          <Box ref={boardRef}>
            <Chessground
              width={400}
              height={400}
              fen={query.value}
              coordinates={false}
              lastMove={[]}
              movable={{
                free: true,
                color: "both",
                events: {
                  after: (orig, dest) => {
                    invoke<string>("make_move", {
                      fen: query.value,
                      from: orig,
                      to: dest,
                    }).then((newFen) => {
                      setQuery((q) => ({ ...q, value: newFen }));
                    });
                  },
                },
              }}
            />
          </Box>

          <Group>
            <Button
              variant="default"
              onClick={() => {
                setQuery(() => ({ type: "exact", value: boardFen }));
              }}
            >
              Current Position
            </Button>
            <Button
              variant="default"
              onClick={() => {
                fetchSimilarStructure(boardFen);
              }}
            >
              Similar Structure
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setQuery(() => ({
                  type: "partial",
                  value: EMPTY_BOARD,
                }));
              }}
            >
              Empty
            </Button>
          </Group>
        </Stack>

        <PiecesGrid
          size={60}
          boardRef={boardRef}
          fen={query.value}
          vertical
          onPut={(newFen) => {
            setQuery((q) => ({ ...q, value: newFen }));
          }}
        />
      </Group>

      {/* <Group>
        <Text fw="bold">Material:</Text>
      </Group> */}
    </Stack>
  );
}

export default SearchPanel;
