import { Stack, ActionIcon } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { BISHOP, KNIGHT, PieceSymbol, QUEEN, ROOK, Square } from "chess.js";
import { memo } from "react";
import Piece from "../common/Piece";

const fileToNumber: Record<string, number> = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  g: 7,
  h: 8,
};

const PromotionModal = memo(function PromotionModal({
  pendingMove,
  cancelMove,
  confirmMove,
  turn,
  orientation,
}: {
  pendingMove: { from: Square; to: Square } | null;
  cancelMove: () => void;
  confirmMove: (p: PieceSymbol) => void;
  turn?: "white" | "black";
  orientation: "white" | "black";
}) {
  let file = fileToNumber[pendingMove?.to[0] ?? "a"];
  let rank = parseInt(pendingMove?.to[1] ?? "1");
  if (orientation === "black") {
    file = 9 - file;
    rank = 9 - rank;
  }
  const ref = useClickOutside(() => cancelMove());

  const promotionPieces: PieceSymbol[] = [QUEEN, KNIGHT, ROOK, BISHOP];
  if (
    (turn === "black" && orientation === "white") ||
    (turn === "white" && orientation === "black")
  ) {
    promotionPieces.reverse();
  }

  return (
    <>
      {pendingMove && (
        <>
          <div
            style={{
              position: "absolute",
              zIndex: 100,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.5)",
            }}
          />
          <div
            ref={ref}
            style={{
              position: "absolute",
              zIndex: 100,
              left: `${(file - 1) * 12.5}%`,
              top: rank === 1 ? "50%" : "0%",
              background: "rgba(255,255,255,0.8)",
            }}
          >
            <Stack spacing={0}>
              {promotionPieces.map((p) => (
                <ActionIcon
                  key={p}
                  w="100%"
                  h="100%"
                  pos="relative"
                  onClick={() => {
                    confirmMove(p);
                  }}
                >
                  <Piece
                    size={75}
                    piece={{
                      type: p,
                      color: turn === "white" ? "w" : "b",
                    }}
                  />
                </ActionIcon>
              ))}
            </Stack>
          </div>
        </>
      )}
    </>
  );
});

export default PromotionModal;
