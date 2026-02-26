import { SimpleGrid } from "@mantine/core";
import type { Piece as PieceT } from "chessops";
import { COLORS, ROLES } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import type { RefObject } from "react";
import Piece from "../common/Piece";

function PiecesGrid({
  fen,
  boardRef,
  vertical,
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
  vertical?: boolean;
  orientation?: "white" | "black";
}) {
  return (
    <SimpleGrid cols={vertical ? 2 : 6}>
      {COLORS.map((color) =>
        ROLES.map((role) => {
          const piece = { role, color };
          const isSelected =
            selectedPiece?.role === role && selectedPiece?.color === color;
          return (
            <Piece
              key={role + color}
              putPiece={(to, piece) => {
                const setup = parseFen(fen).unwrap();
                setup.board.set(to, piece);
                onPut(makeFen(setup));
              }}
              boardRef={boardRef}
              piece={piece}
              orientation={orientation}
              selected={isSelected}
              size={vertical ? 50 : 75}
              onClick={() => onSelectPiece?.(isSelected ? null : piece)}
            />
          );
        }),
      )}
    </SimpleGrid>
  );
}

export default PiecesGrid;
