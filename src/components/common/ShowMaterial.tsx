import type { PiecesCount } from "@/utils/chess";
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

export default function ShowMaterial({
  pieces,
  diff,
  color,
}: {
  pieces: PiecesCount;
  color: Color;
  diff: number;
}) {
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
        {compare(pieces.p) && <Group gap="0">{pawns}</Group>}
        {compare(pieces.n) && <Group gap="0">{knights}</Group>}
        {compare(pieces.b) && <Group gap="0">{bishops}</Group>}
        {compare(pieces.r) && <Group gap="0">{rooks}</Group>}
        {compare(pieces.q) && <Group gap="0">{queens}</Group>}
      </Group>
      {compare(diff) && (
        <Text fz="sm" lh={1}>
          +{Math.abs(diff)}
        </Text>
      )}
    </Group>
  );
}
