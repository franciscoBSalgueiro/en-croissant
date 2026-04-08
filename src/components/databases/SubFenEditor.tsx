import { Box, Group, ActionIcon, Text, Tooltip, Stack } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { makeFen, parseFen } from "chessops/fen";
import { parseSquare, type Piece, type SquareName } from "chessops";
import { useState, useCallback, useMemo } from "react";
import { Chessground } from "@/chessground/Chessground";

const PIECE_PALETTE: { piece: Piece; label: string; symbol: string }[] = [
  { piece: { role: "king", color: "white" }, label: "White King", symbol: "♔" },
  { piece: { role: "queen", color: "white" }, label: "White Queen", symbol: "♕" },
  { piece: { role: "rook", color: "white" }, label: "White Rook", symbol: "♖" },
  { piece: { role: "bishop", color: "white" }, label: "White Bishop", symbol: "♗" },
  { piece: { role: "knight", color: "white" }, label: "White Knight", symbol: "♘" },
  { piece: { role: "pawn", color: "white" }, label: "White Pawn", symbol: "♙" },
  { piece: { role: "king", color: "black" }, label: "Black King", symbol: "♚" },
  { piece: { role: "queen", color: "black" }, label: "Black Queen", symbol: "♛" },
  { piece: { role: "rook", color: "black" }, label: "Black Rook", symbol: "♜" },
  { piece: { role: "bishop", color: "black" }, label: "Black Bishop", symbol: "♝" },
  { piece: { role: "knight", color: "black" }, label: "Black Knight", symbol: "♞" },
  { piece: { role: "pawn", color: "black" }, label: "Black Pawn", symbol: "♟" },
];

const EMPTY_BOARD_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";

interface SubFenEditorProps {
  value: string;
  onChange: (fen: string) => void;
}

export function SubFenEditor({ value, onChange }: SubFenEditorProps) {
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(PIECE_PALETTE[0].piece);
  const [eraseMode, setEraseMode] = useState(false);

  // If value is a sub-fen (board part only), expand it to a full FEN for Chessground
  const fullFen = useMemo(() => {
    if (!value) return EMPTY_BOARD_FEN;
    // If it already has at least the turn part, use it as-is
    if (value.includes(" ")) return value;
    // Otherwise treat as board-only sub-fen, append defaults
    return `${value} w - - 0 1`;
  }, [value]);

  // Extract just the board part (first segment) for output
  const extractBoardFen = useCallback((fen: string): string => {
    return fen.split(" ")[0];
  }, []);

  const handleBoardChange = useCallback(
    (newFen: string) => {
      onChange(extractBoardFen(newFen));
    },
    [onChange, extractBoardFen],
  );

  const handleSquareClick = useCallback(
    (key: SquareName) => {
      const setup = parseFen(fullFen);
      if (setup.isErr) return;

      const s = setup.value;
      const square = parseSquare(key);
      if (square === undefined) return;

      if (eraseMode) {
        s.board.take(square);
      } else if (selectedPiece) {
        // If there's already the same piece, remove it (toggle)
        const existing = s.board.get(square);
        if (
          existing &&
          existing.role === selectedPiece.role &&
          existing.color === selectedPiece.color
        ) {
          s.board.take(square);
        } else {
          s.board.set(square, selectedPiece);
        }
      }

      onChange(extractBoardFen(makeFen(s)));
    },
    [fullFen, selectedPiece, eraseMode, onChange, extractBoardFen],
  );

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap">
        {PIECE_PALETTE.map((p) => {
          const isActive =
            !eraseMode &&
            selectedPiece?.role === p.piece.role &&
            selectedPiece?.color === p.piece.color;
          return (
            <Tooltip key={p.label} label={p.label}>
              <ActionIcon
                variant={isActive ? "filled" : "default"}
                size="lg"
                onClick={() => {
                  setSelectedPiece(p.piece);
                  setEraseMode(false);
                }}
                style={{
                  fontSize: "1.25rem",
                  fontFamily: "serif",
                }}
              >
                {p.symbol}
              </ActionIcon>
            </Tooltip>
          );
        })}
        <Tooltip label="Erase pieces">
          <ActionIcon
            variant={eraseMode ? "filled" : "default"}
            color="red"
            size="lg"
            onClick={() => {
              setEraseMode(true);
              setSelectedPiece(null);
            }}
          >
            <IconTrash size="1rem" />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Clear board">
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => {
              onChange("8/8/8/8/8/8/8/8");
            }}
          >
            <Text size="xs" fw={700}>
              CLR
            </Text>
          </ActionIcon>
        </Tooltip>
      </Group>

      <Box style={{ maxWidth: 320 }}>
        <Chessground
          fen={fullFen}
          coordinates={true}
          viewOnly={false}
          movable={{
            free: true,
            color: "both",
            events: {
              after: () => {
                // Moves handled via setBoardFen
              },
            },
          }}
          draggable={{
            enabled: true,
            deleteOnDropOff: true,
          }}
          events={{
            select: (key) => {
              handleSquareClick(key as SquareName);
            },
          }}
          setBoardFen={handleBoardChange}
        />
      </Box>

      <Text size="xs" c="dimmed" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
        {value || "8/8/8/8/8/8/8/8"}
      </Text>
    </Stack>
  );
}
