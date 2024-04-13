import type { Score } from "@/bindings";
import { formatScore } from "@/utils/score";
import { Box, Progress, Text } from "@mantine/core";
import * as classes from "./ScoreBubble.css";

function ScoreBubble({
  size,
  score,
  evalDisplay = "cp",
  setEvalDisplay = () => {},
}: {
  size: "sm" | "md";
  score: Score;
  evalDisplay?: "cp" | "wdl";
  setEvalDisplay?: (display: "cp" | "wdl") => void;
}) {
  if (evalDisplay === "wdl" && score.wdl) {
    const [w, d, l] = score.wdl;
    return (
      <Progress.Root
        size="xl"
        onClick={() => setEvalDisplay("cp")}
        style={(theme) => ({
          borderRadius: theme.radius.sm,
          boxShadow: theme.shadows.md,
          width: size === "md" ? "4rem" : "3.5rem",
          height: size === "md" ? "1.85rem" : "1.6rem",
        })}
        fz="0.5rem"
        styles={{
          label: {
            paddingInline: 0,
          },
        }}
      >
        <Progress.Section value={w} color="white">
          {w > 200 && (
            <Progress.Label c="dark" className={classes.label}>
              {(w / 10).toFixed(0)}
            </Progress.Label>
          )}
        </Progress.Section>
        <Progress.Section value={d} color="gray">
          {d > 200 && (
            <Progress.Label className={classes.label} c="gray">
              {(d / 10).toFixed(0)}
            </Progress.Label>
          )}
        </Progress.Section>
        <Progress.Section value={l} color="black">
          {l > 200 && (
            <Progress.Label className={classes.label} c="gray">
              {(l / 10).toFixed(0)}
            </Progress.Label>
          )}
        </Progress.Section>
      </Progress.Root>
    );
  }
  return (
    <Box
      onClick={() => setEvalDisplay("wdl")}
      style={(theme) => ({
        backgroundColor:
          score.value.value >= 0 ? theme.colors.gray[0] : theme.colors.dark[9],
        textAlign: "center",
        padding: "0.15rem",
        borderRadius: theme.radius.sm,
        width: size === "md" ? "4rem" : "3.5rem",
        height: size === "md" ? "1.85rem" : "1.6rem",
        boxShadow: theme.shadows.md,
      })}
    >
      <Text
        fw={700}
        c={score.value.value >= 0 ? "black" : "white"}
        size={size}
        ta="center"
        style={(theme) => ({
          fontFamily: theme.fontFamilyMonospace,
        })}
      >
        {formatScore(score.value)}
      </Text>
    </Box>
  );
}

export default ScoreBubble;
