import { Color, PieceSymbol, Square } from "chess.js";
import { useRef } from "react";
import Draggable from "react-draggable";

function Piece({
  piece,
  color,
  boardRef,
  addPiece,
}: {
  piece: PieceSymbol;
  color: Color;
  boardRef?: React.RefObject<HTMLDivElement>;
  addPiece?: (square: Square, piece: PieceSymbol, color: Color) => void;
}) {
  const pieceRef = useRef<HTMLDivElement>(null);
  if (!boardRef || !addPiece) {
    return (
      <div
        ref={pieceRef}
        className={getPieceName(piece, color)}
        style={{
          width: 75,
          height: 75,
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

      addPiece(
        `${String.fromCharCode(97 + x)}${8 - y}` as Square,
        piece,
        color
      );
    }
  };

  return (
    <Draggable
      position={{ x: 0, y: 0 }}
      onStop={(e) => {
        /// @ts-ignore
        handleDrop({ x: e.clientX, y: e.clientY });
      }}
      scale={1}
    >
      <div
        ref={pieceRef}
        className={getPieceName(piece, color)}
        style={{
          width: 75,
          height: 75,
          backgroundSize: "cover",
          zIndex: 100,
        }}
      />
    </Draggable>
  );
}

function getPieceName(piece: PieceSymbol, color: Color) {
  const colorText = color === "w" ? "white" : "black";
  switch (piece) {
    case "p":
      return `${colorText} pawn`;
    case "r":
      return `${colorText} rook`;
    case "n":
      return `${colorText} knight`;
    case "b":
      return `${colorText} bishop`;
    case "q":
      return `${colorText} queen`;
    case "k":
      return `${colorText} king`;
  }
}

export default Piece;
