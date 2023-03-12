import { Box, createStyles } from "@mantine/core";
import { Annotation, annotationColor } from "../../utils/chess";

const useStyles = createStyles(
  (
    theme,
    {
      isCurrentVariation,
      color,
    }: { isCurrentVariation: boolean; color: string }
  ) => ({
    cell: {
      all: "unset",
      fontSize: 14,
      fontWeight: 600,
      display: "inline-block",
      padding: 6,
      borderRadius: 4,
      cursor: "pointer",
      color:
        color === "gray"
          ? theme.colorScheme === "dark"
            ? theme.white
            : theme.colors.gray[8]
          : theme.colors[color][6],
      backgroundColor: isCurrentVariation
        ? theme.fn.rgba(theme.colors[color][6], 0.2)
        : "transparent",
      "&:hover": {
        backgroundColor: theme.fn.rgba(
          theme.colors[color][6],
          isCurrentVariation ? 0.25 : 0.1
        ),
      },
    },
  })
);

function MoveCell({
  move,
  isCurrentVariation,
  annotation,
  comment,
  onClick,
}: {
  move: string;
  isCurrentVariation: boolean;
  annotation: Annotation;
  comment: string;
  onClick: () => void;
}) {
  const color = annotationColor(annotation);
  const { classes } = useStyles({ isCurrentVariation, color });

  return (
    <>
      <Box component="button" className={classes.cell} onClick={onClick}>
        {move + annotation}
      </Box>
    </>
  );
}

export default MoveCell;
