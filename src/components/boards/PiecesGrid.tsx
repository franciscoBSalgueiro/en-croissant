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
  size
}: {
  fen: string;
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  onPut: (newFen: string) => void;
  size: string | number;
  vertical?: boolean;
}) {
  return (
    <SimpleGrid cols={vertical ? 2 : 6}>
      {colors.map((color) =>
        pieces.map((piece) => (
          <Piece
            size={size}
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
