import PiecesGrid from "@/components/boards/PiecesGrid";
import {
  Text,
  Stack,
  Group,
  Button,
  Box,
  SegmentedControl,
} from "@mantine/core";
import { useRef } from "react";
import { Chessground } from "@/chessground/Chessground";
import { useAtom } from "jotai";
import { currentLocalOptionsAtom } from "@/atoms/atoms";
import { EMPTY_BOARD_FEN, makeFen, parseFen } from "chessops/fen";
import { parseSquare } from "chessops";

function LocalOptionsPanel({ boardFen }: { boardFen: string }) {
  const boardRef = useRef(null);
  const [options, setOptions] = useAtom(currentLocalOptionsAtom);

  const setSimilarStructure = async (fen: string) => {
    const setup = parseFen(fen).unwrap();
    for (const square of setup.board.pawn.complement()) {
      setup.board.take(square);
    }
    const fenResult = makeFen(setup);
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
                    const setup = parseFen(options.fen).unwrap();
                    const p = setup.board.take(parseSquare(orig)!)!;
                    setup.board.set(parseSquare(dest)!, p);
                    setOptions((q) => ({ ...q, fen: makeFen(setup) }));
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
                setSimilarStructure(boardFen);
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
                  fen: EMPTY_BOARD_FEN,
                }));
              }}
            >
              Empty
            </Button>
          </Group>
        </Stack>

        <Box
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
          h="30rem"
        >
          <PiecesGrid
            boardRef={boardRef}
            fen={options.fen}
            vertical
            onPut={(newFen) => {
              setOptions((q) => ({ ...q, fen: newFen }));
            }}
          />
        </Box>
      </Group>

      {/* <Group>
        <Text fw="bold">Material:</Text>
      </Group> */}
    </Stack>
  );
}

export default LocalOptionsPanel;
