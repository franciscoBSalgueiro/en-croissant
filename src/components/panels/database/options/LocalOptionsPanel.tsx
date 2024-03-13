import { currentLocalOptionsAtom } from "@/atoms/atoms";
import { Chessground } from "@/chessground/Chessground";
import PiecesGrid from "@/components/boards/PiecesGrid";
import { PlayerSearchInput } from "@/components/databases/PlayerSearchInput";
import {
  Box,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { parseSquare } from "chessops";
import { EMPTY_BOARD_FEN, makeFen, parseFen } from "chessops/fen";
import { useAtom } from "jotai";
import { useRef } from "react";

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
        <Group>
          <Text fw="bold">Player:</Text>
          {options.path && (
            <PlayerSearchInput
              label={"Search"}
              file={options.path}
              setValue={(v) => setOptions((q) => ({ ...q, player: v || null }))}
            />
          )}
        </Group>
        <Group>
          <Text fw="bold">Color:</Text>
          <SegmentedControl
            data={[
              { value: "white", label: "White" },
              { value: "black", label: "Black" },
            ]}
            value={options.color}
            onChange={(v) =>
              setOptions({ ...options, color: v as "white" | "black" })
            }
          />
        </Group>
      </Group>

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
          flex={1}
          style={{ display: "flex", flexDirection: "column" }}
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
