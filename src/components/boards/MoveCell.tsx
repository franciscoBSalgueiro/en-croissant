import { Box, createStyles } from "@mantine/core";
import { ForwardedRef, forwardRef } from "react";
import { ANNOTATION_INFO, Annotation } from "@/utils/chess";
import { IconFlag } from "@tabler/icons-react";

interface MoveCellProps {
  annotation: Annotation;
  isStart: boolean;
  isCurrentVariation: boolean;
  move: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

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
      fontSize: "0.9rem",
      fontWeight: 600,
      display: "inline-block",
      padding: 6,
      borderRadius: 4,
      whiteSpace: "nowrap",
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

const MoveCell = forwardRef(function MoveCell(
  props: MoveCellProps,
  ref: ForwardedRef<HTMLButtonElement>
) {
  const color = ANNOTATION_INFO[props.annotation].color;
  const { classes } = useStyles({
    isCurrentVariation: props.isCurrentVariation,
    color,
  });

  return (
    <Box
      ref={ref}
      component="button"
      className={classes.cell}
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
    >
      {props.isStart && <IconFlag style={{ marginRight: 5 }} size="0.875rem" />}
      {props.move + props.annotation}
    </Box>
  );
});

export default MoveCell;