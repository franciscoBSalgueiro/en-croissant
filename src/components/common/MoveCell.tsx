import { moveNotationTypeAtom } from "@/state/atoms";
import {
  ANNOTATION_INFO,
  type Annotation,
  addPieceSymbol,
} from "@/utils/annotation";
import { Box, rgba, useMantineTheme } from "@mantine/core";
import { IconFlag } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { type ForwardedRef, forwardRef } from "react";
import * as classes from "./MoveCell.css";

interface MoveCellProps {
  annotations: Annotation[];
  isStart: boolean;
  isCurrentVariation: boolean;
  move: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const MoveCell = forwardRef(function MoveCell(
  props: MoveCellProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const [moveNotationType] = useAtom(moveNotationTypeAtom);

  const color = ANNOTATION_INFO[props.annotations[0]]?.color || "gray";
  const theme = useMantineTheme();
  const hoverOpacity = props.isCurrentVariation ? 0.25 : 0.1;
  let baseLight = theme.colors.gray[8];
  let hoverLight = rgba(baseLight, hoverOpacity);
  let baseDark = theme.colors.gray[1];
  let hoverDark = rgba(baseDark, hoverOpacity);
  let darkBg = "transparent";
  let lightBg = "transparent";

  if (color !== "gray") {
    baseLight = theme.colors[color][6];
    hoverLight = rgba(baseLight, hoverOpacity);
    baseDark = theme.colors[color][6];
    hoverDark = rgba(baseDark, hoverOpacity);
  }

  if (props.isCurrentVariation) {
    darkBg = rgba(theme.colors[color][6], 0.2);
    lightBg = rgba(theme.colors[color][6], 0.2);
    hoverLight = rgba(lightBg, 0.25);
    hoverDark = rgba(darkBg, 0.25);
  }

  return (
    <Box
      ref={ref}
      component="button"
      className={classes.cell}
      style={{
        "--light-color": baseLight,
        "--light-hover-color": hoverLight,
        "--dark-color": baseDark,
        "--dark-hover-color": hoverDark,
        "--dark-bg": darkBg,
        "--light-bg": lightBg,
      }}
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
    >
      {props.isStart && <IconFlag style={{ marginRight: 5 }} size="0.875rem" />}
      {moveNotationType === "symbols" ? addPieceSymbol(props.move) : props.move}
      {props.annotations.join("")}
    </Box>
  );
});

export default MoveCell;
