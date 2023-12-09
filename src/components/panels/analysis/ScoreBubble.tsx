import { Box, Text } from "@mantine/core";
import { formatScore } from "@/utils/score";
import { Score } from "@/bindings";

function ScoreBubble({ score }: { score: Score }) {
  const text = formatScore(score);
  return (
    <Box
      style={(theme) => ({
        backgroundColor:
          score.value >= 0 ? theme.colors.gray[0] : theme.colors.dark[9],
        textAlign: "center",
        padding: "0.3125rem",
        borderRadius: theme.radius.md,
        width: "4.5rem",
        boxShadow: theme.shadows.md,
      })}
    >
      <Text
        fw={700}
        c={score.value >= 0 ? "black" : "white"}
        size="md"
        ta="center"
        style={(theme) => ({
          fontFamily: theme.fontFamilyMonospace,
        })}
      >
        {text}
      </Text>
    </Box>
  );
}

export default ScoreBubble;
