import { SimpleGrid } from "@mantine/core";
import type { Piece as PieceT } from "chessops";
import { COLORS, ROLES } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import type { RefObject } from "react";
import Piece from "../common/Piece";
import classes from "./PiecesGrid.module.css";

function PiecesGrid({
  fen,
  boardRef,
  onPut,
  selectedPiece,
  onSelectPiece,
  orientation = "white",
}: {
  fen: string;
  boardRef: RefObject<HTMLDivElement | null>;
  onPut: (newFen: string) => void;
  selectedPiece?: PieceT | null;
  onSelectPiece?: (piece: PieceT | null) => void;
  orientation?: "white" | "black";
}) {
  return (
    <SimpleGrid cols={6} spacing={6} className={classes.grid}>
      {COLORS.map((color) =>
        ROLES.map((role) => {
          const piece = { role, color };
          const isSelected = selectedPiece?.role === role && selectedPiece?.color === color;
          return (
            <div
              key={role + color}
              className={classes.cell}
              data-selected={isSelected || undefined}
            >
              <Piece
                putPiece={(to, piece) => {
                  const setup = parseFen(fen).unwrap();
                  setup.board.set(to, piece);
                  onPut(makeFen(setup));
                }}
                boardRef={boardRef}
                piece={piece}
                orientation={orientation}
                size="100%"
                onClick={() => onSelectPiece?.(isSelected ? null : piece)}
              />
            </div>
          );
        }),
      )}
    </SimpleGrid>
  );
}

export default PiecesGrid;
