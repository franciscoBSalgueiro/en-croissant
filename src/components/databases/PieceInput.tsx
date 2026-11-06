import { Box, Button, Group, NumberInput, Stack, Text } from "@mantine/core";
import { useId } from "react";
import classes from "./PieceInput.module.css";

type PieceRole = "K" | "Q" | "R" | "B" | "N" | "P";

const PIECES: { role: PieceRole; symbol: string; label: string }[] = [
  { role: "K", symbol: "♔", label: "King" },
  { role: "Q", symbol: "♕", label: "Queen" },
  { role: "R", symbol: "♖", label: "Rook" },
  { role: "B", symbol: "♗", label: "Bishop" },
  { role: "N", symbol: "♘", label: "Knight" },
  { role: "P", symbol: "♙", label: "Pawn" },
];
const COUNTED_PIECES = PIECES.filter((piece) => piece.role !== "K");

function parsePieceCounts(s: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ch of s.toUpperCase()) {
    if ("KQRBNP".includes(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  return counts;
}

function serializeCounts(counts: Record<string, number>): string {
  return PIECES.flatMap(({ role }) => Array(counts[role] ?? 0).fill(role)).join("");
}

function PieceCountCell({
  symbol,
  label,
  count,
  onChange,
}: {
  symbol: string;
  label: string;
  count: number;
  onChange: (count: number) => void;
}) {
  const id = useId();
  return (
    <Box className={classes.countCell} data-active={count > 0 || undefined}>
      <label htmlFor={id} className={classes.pieceLabel}>
        <span className={classes.pieceSymbol}>{symbol}</span>
        <span className={classes.pieceName}>{label}</span>
      </label>
      <NumberInput
        id={id}
        value={count}
        onChange={(value) => onChange(typeof value === "number" ? value : 0)}
        min={0}
        max={9}
        allowDecimal={false}
        allowNegative={false}
        allowLeadingZeros={false}
        clampBehavior="strict"
        size="xs"
        classNames={{ input: classes.countInput }}
      />
    </Box>
  );
}

export function PieceToggleBar({
  value,
  onChange,
  excludeKing = false,
}: {
  value: string;
  onChange: (v: string) => void;
  excludeKing?: boolean;
}) {
  const counts = parsePieceCounts(value);
  const pieces = PIECES.filter((piece) => !excludeKing || piece.role !== "K");
  return (
    <Stack gap={4}>
      <Group gap={4}>
        {pieces.map((piece) => (
          <Button
            key={piece.role}
            variant={counts[piece.role] ? "light" : "default"}
            size="compact-xs"
            className={classes.pieceToggle}
            title={piece.label}
            aria-pressed={!!counts[piece.role]}
            onClick={() =>
              onChange(serializeCounts({ ...counts, [piece.role]: counts[piece.role] ? 0 : 1 }))
            }
          >
            <span className={classes.pieceSymbol}>{piece.symbol}</span>
          </Button>
        ))}
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          disabled={!value}
          onClick={() => onChange("")}
        >
          Clear
        </Button>
      </Group>
      {!value && excludeKing && (
        <Text size="xs" c="dimmed">
          Quiet move
        </Text>
      )}
    </Stack>
  );
}

export function PieceCountEditor({
  type,
  value,
  onChange,
}: {
  type: "material" | "imbalance";
  value: string;
  onChange: (value: string) => void;
}) {
  const { whiteCounts, blackCounts } =
    type === "material" ? parseMaterial(value) : parseImbalance(value);
  const build = type === "material" ? buildMaterial : buildImbalance;
  const onWhiteChange = (counts: Record<string, number>) => onChange(build(counts, blackCounts));
  const onBlackChange = (counts: Record<string, number>) => onChange(build(whiteCounts, counts));
  return (
    <Group gap={8} align="flex-start" wrap="nowrap" className={classes.countEditor}>
      <Box className={classes.countGrid}>
        {[
          { side: "White", counts: whiteCounts, onChange: onWhiteChange },
          { side: "Black", counts: blackCounts, onChange: onBlackChange },
        ].map(({ side, counts, onChange }) => (
          <Box key={side} className={classes.sideRow}>
            <Text size="xs" fw={600} className={classes.sideLabel}>
              {side}
            </Text>
            <Box className={classes.sideCounts}>
              {COUNTED_PIECES.map((piece) => (
                <PieceCountCell
                  key={piece.role}
                  symbol={piece.symbol}
                  label={piece.label}
                  count={counts[piece.role] ?? 0}
                  onChange={(count) => onChange({ ...counts, [piece.role]: count })}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
      <Button
        className={classes.clearCounts}
        size="compact-xs"
        variant="subtle"
        color="gray"
        disabled={!value}
        onClick={() => onChange("")}
      >
        Clear
      </Button>
    </Group>
  );
}

function parseMaterial(s: string): {
  whiteCounts: Record<string, number>;
  blackCounts: Record<string, number>;
} {
  const parts = s.toUpperCase().split("K");
  const whiteStr = parts[1] || "";
  const blackStr = parts[2] || "";
  return {
    whiteCounts: parsePieceCounts(whiteStr),
    blackCounts: parsePieceCounts(blackStr),
  };
}

function buildMaterial(white: Record<string, number>, black: Record<string, number>): string {
  const wStr = serializeCounts(white);
  const bStr = serializeCounts(black);
  return `K${wStr}K${bStr}`;
}

function parseImbalance(s: string): {
  whiteCounts: Record<string, number>;
  blackCounts: Record<string, number>;
} {
  const idx = s.indexOf("v");
  if (idx < 0) {
    return {
      whiteCounts: parsePieceCounts(s),
      blackCounts: {},
    };
  }
  return {
    whiteCounts: parsePieceCounts(s.slice(0, idx).toUpperCase()),
    blackCounts: parsePieceCounts(s.slice(idx + 1).toUpperCase()),
  };
}

function buildImbalance(white: Record<string, number>, black: Record<string, number>): string {
  const wStr = serializeCounts(white);
  const bStr = serializeCounts(black);
  if (!wStr && !bStr) return "";
  return `${wStr}v${bStr}`;
}
