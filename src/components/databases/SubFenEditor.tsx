import { Box, Button, Group, Text } from "@mantine/core";
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { parseSquare, type Piece, type SquareName } from "chessops";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chessground } from "@/chessground/Chessground";
import PiecesGrid from "../boards/PiecesGrid";
import classes from "./SubFenEditor.module.css";

const EMPTY_BOARD = "8/8/8/8/8/8/8/8";

interface SubFenEditorProps {
  value: string;
  onChange: (fen: string) => void;
}

export function SubFenEditor({ value, onChange }: SubFenEditorProps) {
  const { t } = useTranslation();
  const boardRef = useRef<HTMLDivElement>(null);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const inputFen = `${value.split(" ")[0] || EMPTY_BOARD} w - - 0 1`;
  const valid = parseFen(inputFen).isOk;
  const fullFen = valid ? inputFen : `${EMPTY_BOARD} w - - 0 1`;

  const handleBoardChange = useCallback((fen: string) => onChange(fen.split(" ")[0]), [onChange]);

  const handleSquareClick = useCallback(
    (key: SquareName) => {
      if (!selectedPiece) return;
      const setup = parseFen(fullFen);
      const square = parseSquare(key);
      if (setup.isErr || square === undefined) return;
      if (setup.value.board.has(square)) return;
      setup.value.board.set(square, selectedPiece);
      handleBoardChange(makeFen(setup.value));
    },
    [fullFen, selectedPiece, handleBoardChange],
  );

  return (
    <Box className={classes.editor}>
      <Box ref={boardRef} className={classes.board}>
        <Chessground
          fen={fullFen}
          orientation="white"
          coordinates={false}
          animation={{ enabled: false }}
          movable={{
            free: true,
            color: "both",
            showDests: false,
          }}
          draggable={{ enabled: true, deleteOnDropOff: true }}
          selectable={{ enabled: true }}
          drawable={{ enabled: false, visible: false }}
          events={{ select: (key) => handleSquareClick(key as SquareName) }}
          setBoardFen={handleBoardChange}
        />
      </Box>
      <Box className={classes.controls}>
        <PiecesGrid
          fen={fullFen}
          boardRef={boardRef}
          onPut={(fen) => {
            handleBoardChange(fen);
            setSelectedPiece(null);
          }}
          selectedPiece={selectedPiece}
          onSelectPiece={setSelectedPiece}
        />
        <Group gap={6}>
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => {
              setSelectedPiece(null);
              handleBoardChange(INITIAL_FEN);
            }}
          >
            {t("Fen.Start")}
          </Button>
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => {
              setSelectedPiece(null);
              onChange(EMPTY_BOARD);
            }}
          >
            {t("Fen.Empty")}
          </Button>
        </Group>
        {!valid && (
          <Text size="xs" c="red">
            Invalid board pattern. Editing starts from an empty board.
          </Text>
        )}
      </Box>
    </Box>
  );
}
