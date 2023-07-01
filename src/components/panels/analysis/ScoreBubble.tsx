import { Box, Text } from "@mantine/core";
import { Score, formatScore } from "@/utils/score";

function ScoreBubble({ score }: { score: Score }) {
  const text = formatScore(score);
  return (
    <Box
      sx={(theme) => ({
        backgroundColor:
          score.value >= 0 ? theme.colors.gray[0] : theme.colors.dark[9],
        textAlign: "center",
        padding: 5,
        borderRadius: theme.radius.md,
        width: 70,
        boxShadow: theme.shadows.md,
      })}
    >
      <Text
        weight={700}
        color={score.value >= 0 ? "black" : "white"}
        size="md"
        align="center"
        sx={(theme) => ({
          fontFamily: theme.fontFamilyMonospace,
        })}
      >
        {text}
      </Text>
    </Box>
  );
}

export default ScoreBubble;
