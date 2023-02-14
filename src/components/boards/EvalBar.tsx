import { Box } from "@mantine/core";
import { Score } from "../../utils/chess";
import { formatScore } from "../../utils/format";

function EvalBar({
  score,
  boardSize,
}: {
  score: Score | null;
  boardSize: number;
}) {
  const { text, value } = formatScore(score ?? { cp: 0, mate: 0 });
  const progress = value / 30 + 50;

  return (
    <Box sx={{ width: 25, height: boardSize }}>
      {score && (
        <>
          <Box
            sx={{
              height: `${progress}%`,
              backgroundColor: "white",
              borderTopRightRadius: 10,
              borderTopLeftRadius: 10,
            }}
          />
          <Box
            sx={{
              height: `${100 - progress}%`,
              backgroundColor: "black",
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
