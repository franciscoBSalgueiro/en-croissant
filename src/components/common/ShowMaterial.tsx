import { Group, Text } from "@mantine/core";
import {
  IconChessBishopFilled,
  IconChessFilled,
  IconChessKnightFilled,
  IconChessQueenFilled,
  IconChessRookFilled,
} from "@tabler/icons-react";
import type { Color } from "chessops";
import { match } from "ts-pattern";
import { getMaterialDiff } from "@/utils/chess";

export default function ShowMaterial({
  fen,
  color,
  mode = "diff",
}: {
  fen: string;
  color: Color;
  mode?: "diff" | "all";
}) {
  const materialDiff = getMaterialDiff(fen);

  if (!materialDiff) {
    return null;
  }

  const pieces =
    mode === "all"
      ? materialDiff[color === "white" ? "whiteCaptured" : "blackCaptured"]
      : materialDiff.pieces;
  const { diff } = materialDiff;

  const shouldShow =
    mode === "all"
      ? (v: number) => v > 0
      : match(color)
          .with("white", () => (v: number) => v > 0)
          .with("black", () => (v: number) => v < 0)
          .exhaustive();

  const compare = match(color)
    .with("white", () => (v: number) => v > 0)
    .with("black", () => (v: number) => v < 0)
    .exhaustive();

  const pawns = [...Array(Math.abs(pieces.p)).keys()].map((i) => (
    <IconChessFilled size="1.1rem" key={i} style={{ marginRight: "-7px" }} />
  ));
  const knights = [...Array(Math.abs(pieces.n)).keys()].map((i) => (
    <IconChessKnightFilled
      size="1.1rem"
      key={i}
      style={{ marginRight: "-7px" }}
    />
  ));
  const bishops = [...Array(Math.abs(pieces.b)).keys()].map((i) => (
    <IconChessBishopFilled
      size="1.1rem"
      key={i}
      style={{ marginRight: "-7px" }}
    />
  ));
  const rooks = [...Array(Math.abs(pieces.r)).keys()].map((i) => (
    <IconChessRookFilled
      size="1.1rem"
      key={i}
      style={{ marginRight: "-7px" }}
    />
  ));
  const queens = [...Array(Math.abs(pieces.q)).keys()].map((i) => (
    <IconChessQueenFilled
      size="1.1rem"
      key={i}
      style={{ marginRight: "-7px" }}
    />
  ));

  return (
    <Group gap="xs">
      <Group gap="xs">
        {shouldShow(pieces.p) && <Group gap="0">{pawns}</Group>}
        {shouldShow(pieces.n) && <Group gap="0">{knights}</Group>}
        {shouldShow(pieces.b) && <Group gap="0">{bishops}</Group>}
        {shouldShow(pieces.r) && <Group gap="0">{rooks}</Group>}
        {shouldShow(pieces.q) && <Group gap="0">{queens}</Group>}
      </Group>
      {compare(diff) && (
        <Text fz="sm" lh={1}>
          +{Math.abs(diff)}
        </Text>
      )}
    </Group>
  );
}
