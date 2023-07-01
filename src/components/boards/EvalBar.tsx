import { Box, useMantineTheme } from "@mantine/core";
import { Color } from "chessground/types";
import { Score, getWinChance } from "@/utils/score";

function EvalBar({
  score,
  boardSize,
  orientation,
}: {
  score: Score | null;
  boardSize: number;
  orientation: Color;
}) {
  const theme = useMantineTheme();

  let ScoreBars = null;
  if (score) {
    const progress =
      score.type === "cp"
        ? getWinChance(score.value)
        : score.value > 0
        ? 100
        : 0;

    ScoreBars = (
      <>
        <Box
          sx={{
            height: `${100 - progress}%`,
            backgroundColor: theme.colors.dark[4],
          }}
        />
        <Box
          sx={{
            height: `${progress}%`,
            backgroundColor: theme.colors.gray[2],
          }}
        />
      </>
    );
  }

  return (
    <Box
      sx={{
        width: 25,
        height: boardSize,
        rotate: orientation === "white" ? "0deg" : "180deg",
        borderRadius: 10,
      }}
    >
      {ScoreBars}
    </Box>
  );
}

export default EvalBar;
