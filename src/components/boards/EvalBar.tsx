import { Box } from "@mantine/core";
import { Color } from "chessground/types";
import { Score } from "../../utils/chess";
import { formatScore } from "../../utils/format";

function EvalBar({
  score,
  boardSize,
  orientation,
}: {
  score: Score | null;
  boardSize: number;
  orientation: Color;
}) {
  const { text, value } = formatScore(score ?? ({ cp: 0 } as Score));
  let progress = value / 30 + 50;
  if (score?.mate) {
    progress = score.mate > 0 ? 100 : 0;
  }

  return (
    <Box
      sx={{
        width: 25,
        height: boardSize,
        rotate: orientation === "white" ? "0" : "180deg",
      }}
    >
      {score && (
        <>
          <Box
            sx={{
              height: `${100 - progress}%`,
              backgroundColor: "black",
              borderTopRightRadius: 10,
              borderTopLeftRadius: 10,
            }}
          />
          <Box
            sx={{
              height: `${progress}%`,
              backgroundColor: "white",
              borderBottomRightRadius: 10,
              borderBottomLeftRadius: 10,
            }}
          />
        </>
      )}
    </Box>
  );
}

export default EvalBar;
