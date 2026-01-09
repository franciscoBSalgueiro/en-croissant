import type { Score } from "@/bindings";
import { currentEvalBarDisplayAtom, currentEvalOpenAtom } from "@/state/atoms";
import { formatScore, getWinChance } from "@/utils/score";
import type { Color } from "@lichess-org/chessground/types";
import { Box, Text, Tooltip, useMantineTheme } from "@mantine/core";
import { useAtom } from "jotai";

function EvalBar({
  score,
  orientation,
}: {
  score: Score | null;
  orientation: Color;
}) {
  const theme = useMantineTheme();
  const [evalDisplay, setEvalDisplay] = useAtom(currentEvalBarDisplayAtom);
  const [, setEvalOpen] = useAtom(currentEvalOpenAtom);

  const handleClick = () => {
    if (setEvalDisplay) {
      setEvalDisplay(evalDisplay === "cp" ? "wdl" : "cp");
    }
  };

  let ScoreBars = null;
  if (score) {
    const scoreValue = score.value;
    const wdl = score.wdl;

    if (evalDisplay === "wdl" && wdl) {
      const [w, d, l] = wdl;
      const whiteWin = w / 10;
      const draw = d / 10;
      const blackWin = l / 10;

      const sections = [
        {
          key: "black",
          height: blackWin,
          bg: theme.colors.dark[4],
          textColor: theme.colors.gray[2],
          label: blackWin >= 20 ? blackWin.toFixed(0) : "",
        },
        {
          key: "draw",
          height: draw,
          bg: theme.colors.gray[5],
          textColor: theme.colors.dark[8],
          label: draw >= 20 ? draw.toFixed(0) : "",
        },
        {
          key: "white",
          height: whiteWin,
          bg: theme.colors.gray[2],
          textColor: theme.colors.dark[8],
          label: whiteWin >= 20 ? whiteWin.toFixed(0) : "",
        },
      ];

      if (orientation === "black") {
        sections.reverse();
      }

      ScoreBars = sections.map((section) => (
        <Box
          key={section.key}
          style={{
            height: `${section.height}%`,
            backgroundColor: section.bg,
            transition: "height 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Text fz="xs" c={section.textColor} ta="center">
            {section.label}
          </Text>
        </Box>
      ));
    } else {
      const progress =
        scoreValue.type === "cp"
          ? getWinChance(scoreValue.value)
          : scoreValue.value > 0
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
            {scoreValue.value <= 0 &&
              formatScore(scoreValue, 1).replace(/\+|-/, "")}
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
            {scoreValue.value > 0 && formatScore(scoreValue, 1).slice(1)}
          </Text>
        </Box>,
      ];

      if (orientation === "black") {
        ScoreBars = ScoreBars.reverse();
      }
    }
  }

  return (
    <Tooltip
      position="right"
      color={score && score.value.value < 0 ? "dark" : undefined}
      label={score ? formatScore(score.value) : undefined}
      disabled={!score}
    >
      <Box
        onClick={handleClick}
        onContextMenu={(e) => {
          setEvalOpen(false);
          e.preventDefault();
        }}
        style={{
          width: 25,
          height: "100%",
          borderRadius: "var(--mantine-radius-xs)",
          overflow: "hidden",
        }}
      >
        {ScoreBars}
      </Box>
    </Tooltip>
  );
}

export default EvalBar;
