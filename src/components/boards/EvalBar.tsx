import { Box, useMantineTheme, Tooltip, Text } from "@mantine/core";
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

    ScoreBars = [
      <Box
        key="black"
        sx={{
          height: `${100 - progress}%`,
          backgroundColor: theme.colors.dark[4],
          transition: "height 0.2s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Text
          fz="xs"
          c={theme.colors.gray[2]}
          ta="center"
          py={3}
          mt={orientation === "black" ? "auto" : undefined}
        >
          {score.value <= 0 && formatScore(score, 1).slice(1)}
        </Text>
      </Box>,
      <Box
        key="white"
        sx={{
          height: `${progress}%`,
          backgroundColor: theme.colors.gray[2],
          transition: "height 0.2s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Text
          fz="xs"
          py={3}
          c={theme.colors.dark[8]}
          ta="center"
          mt={orientation === "white" ? "auto" : undefined}
        >
          {score.value > 0 && formatScore(score, 1).slice(1)}
        </Text>
      </Box>,
    ];
  }

  if (orientation === "black") {
    ScoreBars = ScoreBars?.reverse();
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
          borderRadius: 10,
        }}
      >
        {ScoreBars}
      </Box>
    </Tooltip>
  );
}

export default EvalBar;
