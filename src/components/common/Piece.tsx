import type { Color, Piece } from "chessground/types";
import type { Square } from "chessops";
import { squareFromCoords } from "chessops/util";
import { useRef } from "react";
import Draggable from "react-draggable";

export default function PieceComponent({
  piece,
  boardRef,
  putPiece,
  size,
  orientation,
}: {
  piece: Piece;
  boardRef?: React.RefObject<HTMLDivElement>;
  putPiece?: (square: Square, piece: Piece) => void;
  size?: number | string;
  orientation?: Color;
}) {
  size = size || "100%";
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
      let x = Math.floor((position.x - boardRect.left) / squareWidth);
      let y = Math.floor((position.y - boardRect.top) / squareHeight);

      if (orientation === "black") {
        x = 7 - x;
        y = 7 - y;
      }
      putPiece(squareFromCoords(x, 7 - y)!, piece);
    }
  };

  return (
    <Draggable
      position={{ x: 0, y: 0 }}
      onStop={(e) => {
        const { clientX, clientY } = e as MouseEvent;
        handleDrop({ x: clientX, y: clientY });
      }}
      scale={1}
    >
      <div
        ref={pieceRef}
        className={getPieceName(piece)}
        style={{
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          zIndex: 100,
        }}
      />
    </Draggable>
  );
}

const getPieceName = (piece: Piece) => `${piece.color} ${piece.role}`;
