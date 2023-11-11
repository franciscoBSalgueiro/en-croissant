import { ActionIcon, SimpleGrid } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { BISHOP, KNIGHT, PieceSymbol, QUEEN, ROOK, Square } from "chess.js";
import { memo } from "react";
import Piece from "../common/Piece";
import { moveToCoordinates } from "@/utils/chess";

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
  const { file, rank } = moveToCoordinates(pendingMove, orientation)
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
              width: "12.5%",
              height: "50%",
              left: `${(file - 1) * 12.5}%`,
              top: rank === 1 ? "50%" : "0%",
              background: "rgba(255,255,255,0.8)",
            }}
          >
            <SimpleGrid cols={1} spacing={0} verticalSpacing={0} h={"100%"}>
              {promotionPieces.map((p) => (
                <ActionIcon
                  key={p}
                  w="100%"
                  h="100%"
                  // pos="relative"
                  onClick={() => {
                    confirmMove(p);
                  }}
                >
                  <Piece
                    piece={{
                      type: p,
                      color: turn === "white" ? "w" : "b",
                    }}
                  />
                </ActionIcon>
              ))}
            </SimpleGrid>
          </div>
        </>
      )}
    </>
  );
});

export default PromotionModal;
