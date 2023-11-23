import { SimpleGrid } from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import Piece from "../common/Piece";

const pieces = ["p", "n", "b", "r", "q", "k"] as const;
const colors = ["w", "b"] as const;

function PiecesGrid({
  fen,
  boardRef,
  vertical,
  onPut,
}: {
  fen: string;
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  onPut: (newFen: string) => void;
  vertical?: boolean;
}) {
  return (
    <SimpleGrid cols={vertical ? 2 : 6} sx={{ flex: 1 }} w="100%">
      {colors.map((color) =>
        pieces.map((piece) => (
          <Piece
            key={piece + color}
            putPiece={(to, piece) => {
              invoke<string>("put_piece", {
                fen,
                piece: piece.type,
                square: to,
                color: piece.color,
              }).then(onPut);
            }}
            boardRef={boardRef}
            piece={{
              type: piece,
              color,
            }}
          />
        ))
      )}
    </SimpleGrid>
  );
}

export default PiecesGrid;
