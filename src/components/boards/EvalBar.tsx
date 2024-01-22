import { Score } from "@/bindings";
import { formatScore, getWinChance } from "@/utils/score";
import { Box, Text, Tooltip, useMantineTheme } from "@mantine/core";
import { Color } from "chessground/types";

function EvalBar({
  score,
  orientation,
}: {
  score: Score | null;
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
        style={{
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
          {score.value <= 0 && formatScore(score, 1).replace(/\+|-/, "")}
        </Text>
      </Box>,
      <Box
        key="white"
        style={{
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
        style={{
          width: 25,
          height: "100%",
          borderRadius: 10,
        }}
      >
        {ScoreBars}
      </Box>
    </Tooltip>
  );
}

export default EvalBar;
