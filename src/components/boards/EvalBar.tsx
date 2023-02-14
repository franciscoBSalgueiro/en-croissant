import { Box } from "@mantine/core";
import { Score } from "../../utils/chess";
import { formatScore } from "../../utils/format";

function EvalBar({ score }: { score: Score }) {
  const { text, value } = formatScore(score);
  const progress = value + 50;
  console.log(value);

  return (
    <Box sx={{ width: 25 }}>
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
    </Box>
  );
}

export default EvalBar;
