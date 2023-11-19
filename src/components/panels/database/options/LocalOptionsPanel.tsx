import PiecesGrid from "@/components/boards/PiecesGrid";
import { EMPTY_BOARD } from "@/utils/chess";
import {
  Text,
  Stack,
  Group,
  Button,
  Box,
  SegmentedControl,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { useRef } from "react";
import { Chessground } from "@/chessground/Chessground";
import { useAtom } from "jotai";
import { currentLocalOptionsAtom } from "@/atoms/atoms";

async function similarStructure(fen: string) {
  return await invoke<string>("similar_structure", { fen });
}

function LocalOptionsPanel({ boardFen }: { boardFen: string }) {
  const boardRef = useRef(null);
  const [options, setOptions] = useAtom(currentLocalOptionsAtom);

  const fetchSimilarStructure = async (fen: string) => {
    const fenResult = await similarStructure(fen);
    setOptions((q) => ({ ...q, type: "partial", fen: fenResult }));
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
          value={options.type}
          onChange={(v) =>
            setOptions({ ...options, type: v as "exact" | "partial" })
          }
        />
      </Group>

      <Group>
        <Stack>
          <Box ref={boardRef}>
            <Chessground
              width={400}
              height={400}
              fen={options.fen}
              coordinates={false}
              lastMove={[]}
              movable={{
                free: true,
                color: "both",
                events: {
                  after: (orig, dest) => {
                    invoke<string>("make_move", {
                      fen: options.fen,
                      from: orig,
                      to: dest,
                    }).then((newFen) => {
                      setOptions((q) => ({ ...q, fen: newFen }));
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
                setOptions((q) => ({ ...q, type: "exact", fen: boardFen }));
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
                setOptions((q) => ({
                  ...q,
                  type: "partial",
                  fen: EMPTY_BOARD,
                }));
              }}
            >
              Empty
            </Button>
          </Group>
        </Stack>

        <PiecesGrid
          size="3.75rem"
          boardRef={boardRef}
          fen={options.fen}
          vertical
          onPut={(newFen) => {
            setOptions((q) => ({ ...q, fen: newFen }));
          }}
        />
      </Group>

      {/* <Group>
        <Text fw="bold">Material:</Text>
      </Group> */}
    </Stack>
  );
}

export default LocalOptionsPanel;
