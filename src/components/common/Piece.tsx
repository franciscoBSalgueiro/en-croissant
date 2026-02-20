import type { Color, Piece } from "@lichess-org/chessground/types";
import type { Square } from "chessops";
import { squareFromCoords } from "chessops/util";
import { type RefObject, useRef } from "react";
import Draggable from "react-draggable";

export default function PieceComponent({
  piece,
  boardRef,
  putPiece,
  size,
  orientation,
  selected,
  onClick,
}: {
  piece: Piece;
  boardRef?: RefObject<HTMLDivElement | null>;
  putPiece?: (square: Square, piece: Piece) => void;
  size?: number | string;
  orientation?: Color;
  selected?: boolean;
  onClick?: () => void;
}) {
  size = size || "100%";
  const pieceRef = useRef<HTMLDivElement>(null);
  const startPosition = useRef<{ x: number; y: number } | null>(null);

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
    if (startPosition.current) {
      const dx = position.x - startPosition.current.x;
      const dy = position.y - startPosition.current.y;

      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        onClick?.();
        return;
      }
    }

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
      nodeRef={pieceRef as RefObject<HTMLElement>}
      position={{ x: 0, y: 0 }}
      onStart={(e) => {
        const { clientX, clientY } = e as MouseEvent;
        startPosition.current = { x: clientX, y: clientY };
      }}
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
          height: size,
          width: size,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          zIndex: 100,
          cursor: onClick ? "pointer" : "default",
          border: selected ? "2px solid #228be6" : "2px solid transparent",
          borderRadius: "4px",
        }}
      />
    </Draggable>
  );
}

const getPieceName = (piece: Piece) => `${piece.color} ${piece.role}`;
