import { squareToCoordinates } from "@/utils/chessops";
import { ActionIcon, SimpleGrid } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import type { Color } from "chessground/types";
import type { NormalMove, Role } from "chessops";
import { memo } from "react";
import Piece from "../common/Piece";

const PromotionModal = memo(function PromotionModal({
  pendingMove,
  cancelMove,
  confirmMove,
  turn,
  orientation,
}: {
  pendingMove: NormalMove | null;
  cancelMove: () => void;
  confirmMove: (p: Role) => void;
  turn: Color;
  orientation: Color;
}) {
  const ref = useClickOutside(() => cancelMove());

  if (!pendingMove) {
    return null;
  }
  const { file, rank } = squareToCoordinates(pendingMove.to, orientation);
  const promotionPieces: Role[] = ["queen", "knight", "rook", "bishop"];
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
                      role: p,
                      color: turn,
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
