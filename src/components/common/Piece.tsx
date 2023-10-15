import { Piece, Square } from "chess.js";
import { useRef } from "react";
import Draggable from "react-draggable";
import { match } from "ts-pattern";

export default function PieceComponent({
  piece,
  boardRef,
  putPiece,
  size,
}: {
  piece: Piece;
  boardRef?: React.RefObject<HTMLDivElement>;
  putPiece?: (square: Square, piece: Piece) => void;
  size?: number | string;
}) {
  size = size ?? "100%";
  const pieceRef = useRef<HTMLDivElement>(null);
  if (!boardRef || !putPiece) {
    return (
      <div
        ref={pieceRef}
        className={getPieceName(piece)}
        style={{
          width: size,
          height: size,
          backgroundSize: "cover",
        }}
      />
    );
  }
  const handleDrop = (position: { x: number; y: number }) => {
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (
      boardRect &&
      position.x > boardRect.left &&
      position.x < boardRect.right &&
      position.y > boardRect.top &&
      position.y < boardRect.bottom
    ) {
      const boardWidth = boardRect.width;
      const boardHeight = boardRect.height;
      const squareWidth = boardWidth / 8;
      const squareHeight = boardHeight / 8;
      const x = Math.floor((position.x - boardRect.left) / squareWidth);
      const y = Math.floor((position.y - boardRect.top) / squareHeight);

      putPiece(`${String.fromCharCode(97 + x)}${8 - y}` as Square, piece);
    }
  };

  return (
    <Draggable
      position={{ x: 0, y: 0 }}
      onStop={(e) => {
        e = e as MouseEvent;
        handleDrop({ x: e.clientX, y: e.clientY });
      }}
      scale={1}
    >
      <div
        ref={pieceRef}
        className={getPieceName(piece)}
        style={{
          width: size,
          height: size,
          backgroundSize: "cover",
          zIndex: 100,
        }}
      />
    </Draggable>
  );
}

function getPieceName(piece: Piece) {
  const colorText = piece.color === "w" ? "white" : "black";
  return match(piece.type)
    .with("p", () => `${colorText} pawn`)
    .with("r", () => `${colorText} rook`)
    .with("n", () => `${colorText} knight`)
    .with("b", () => `${colorText} bishop`)
    .with("q", () => `${colorText} queen`)
    .with("k", () => `${colorText} king`)
    .exhaustive();
}
