import { SimpleGrid } from "@mantine/core";
import Piece from "../common/Piece";
import { ROLES, COLORS, parseSquare } from "chessops";
import { makeFen, parseFen } from "chessops/fen";

function PiecesGrid({
  fen,
  boardRef,
  vertical,
  onPut,
  orientation = "white",
}: {
  fen: string;
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  onPut: (newFen: string) => void;
  vertical?: boolean;
  orientation?: "white" | "black";
}) {
  return (
    <SimpleGrid cols={vertical ? 2 : 6} sx={{ flex: 1 }} w="100%">
      {COLORS.map((color) =>
        ROLES.map((role) => (
          <Piece
            key={role + color}
            putPiece={(to, piece) => {
              const square = parseSquare(to);
              const setup = parseFen(fen).unwrap();
              setup.board.set(square, piece);
              onPut(makeFen(setup));
            }}
            boardRef={boardRef}
            piece={{
              role,
              color,
            }}
            orientation={orientation}
          />
        ))
      )}
    </SimpleGrid>
  );
}

export default PiecesGrid;
