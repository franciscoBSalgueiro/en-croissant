import { Box, useMantineTheme, Tooltip } from "@mantine/core";
import { Color } from "chessground/types";
import { formatScore, getWinChance } from "@/utils/score";
import { Score } from "@/bindings";

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
            transition: "height 0.2s ease",
          }}
        />
        <Box
          sx={{
            height: `${progress}%`,
            backgroundColor: theme.colors.gray[2],
            transition: "height 0.2s ease",
          }}
        />
      </>
    );
  }

  return (
    <Tooltip
      position="right"
      color={score && score.value < 0 ? "dark" : undefined}
      label={score ? formatScore(score) : undefined}
      disabled={!score}
    >
      <Box
        mt={10}
        sx={{
          width: 25,
          height: boardSize,
          rotate: orientation === "white" ? "0deg" : "180deg",
          borderRadius: 10,
        }}
      >
        {ScoreBars}
      </Box>
    </Tooltip>
  );
}

export default EvalBar;
