import type { PiecesCount } from "@/utils/chess";
import { Group } from "@mantine/core";
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
    <IconChessFilled size="1.3rem" key={i} />
  ));
  const knights = [...Array(Math.abs(pieces.n)).keys()].map((i) => (
    <IconChessKnightFilled size="1.3rem" key={i} />
  ));
  const bishops = [...Array(Math.abs(pieces.b)).keys()].map((i) => (
    <IconChessBishopFilled size="1.3rem" key={i} />
  ));
  const rooks = [...Array(Math.abs(pieces.r)).keys()].map((i) => (
    <IconChessRookFilled size="1.3rem" key={i} />
  ));
  const queens = [...Array(Math.abs(pieces.q)).keys()].map((i) => (
    <IconChessQueenFilled size="1.3rem" key={i} />
  ));

  return (
    <Group gap="xs" h="1.3rem">
      <Group gap={0}>
        {compare(pieces.p) && pawns}
        {compare(pieces.n) && knights}
        {compare(pieces.b) && bishops}
        {compare(pieces.r) && rooks}
        {compare(pieces.q) && queens}
      </Group>
      {compare(diff) && `+${Math.abs(diff)}`}
    </Group>
  );
}
