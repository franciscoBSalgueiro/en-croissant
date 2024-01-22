import { SimpleGrid } from "@mantine/core";
import { COLORS, ROLES, parseSquare } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import Piece from "../common/Piece";

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
    <SimpleGrid cols={vertical ? 2 : 6} flex={1} w="100%">
      {COLORS.map((color) =>
        ROLES.map((role) => (
          <Piece
            key={role + color}
            putPiece={(to, piece) => {
              const setup = parseFen(fen).unwrap();
              setup.board.set(to, piece);
              onPut(makeFen(setup));
            }}
            boardRef={boardRef}
            piece={{
              role,
              color,
            }}
            orientation={orientation}
          />
        )),
      )}
    </SimpleGrid>
  );
}

export default PiecesGrid;
