import type { ScoreValue } from "@/bindings";
import { formatScore } from "@/utils/score";
import { Box, Text } from "@mantine/core";

function ScoreBubble({
  size,
  score,
}: { size: "sm" | "md"; score: ScoreValue }) {
  const text = formatScore(score);
  return (
    <Box
      style={(theme) => ({
        backgroundColor:
          score.value >= 0 ? theme.colors.gray[0] : theme.colors.dark[9],
        textAlign: "center",
        padding: "0.15rem",
        borderRadius: theme.radius.sm,
        width: size === "md" ? "4rem" : "3.5rem",
        boxShadow: theme.shadows.md,
      })}
    >
      <Text
        fw={700}
        c={score.value >= 0 ? "black" : "white"}
        size={size}
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
