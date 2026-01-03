import { REVIEW_INFO, type ReviewClassification } from "@/utils/annotation";
import { squareToCoordinates } from "@/utils/chessops";
import { Box } from "@mantine/core";
import type { Color, Square } from "chessops";
import { reviewGlyphToSvg } from "./AnnotationHint";

export default function ReviewHint({
  square,
  classification,
  orientation,
}: {
  square: Square;
  classification: ReviewClassification;
  orientation: Color;
}) {
  const { file, rank } = squareToCoordinates(square, orientation);
  const color = REVIEW_INFO[classification]?.color || "gray";

  return (
    <Box
      style={{
        position: "absolute",
        width: "12.5%",
        height: "12.5%",
        left: `${(file - 1) * 12.5}%`,
        bottom: `${(rank - 1) * 12.5}%`,
      }}
    >
      <Box pl="90%">
        <Box
          style={{
            transform: "translateY(-40%) translateX(-50%)",
            zIndex: 100,
            filter: "url(#review-shadow)",
            overflow: "initial",
            borderRadius: "50%",
          }}
          w="45%"
          h="45%"
          pos="absolute"
          bg={color}
        >
          <svg viewBox="0 0 100 100">
            <title>{REVIEW_INFO[classification]?.name}</title>
            <defs>
              <filter id="review-shadow">
                <feDropShadow
                  dx="0"
                  dy="1"
                  floodOpacity="0.3"
                  stdDeviation="0"
                />
              </filter>
            </defs>
            <g>{reviewGlyphToSvg[classification]}</g>
          </svg>
        </Box>
      </Box>
    </Box>
  );
}
