import { ActionIcon, Badge, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconMinus, IconPlus, IconRefresh } from "@tabler/icons-react";

type PieceRole = "K" | "Q" | "R" | "B" | "N" | "P";

const WHITE_PIECES: { role: PieceRole; symbol: string; label: string }[] = [
  { role: "K", symbol: "♔", label: "King" },
  { role: "Q", symbol: "♕", label: "Queen" },
  { role: "R", symbol: "♖", label: "Rook" },
  { role: "B", symbol: "♗", label: "Bishop" },
  { role: "N", symbol: "♘", label: "Knight" },
  { role: "P", symbol: "♙", label: "Pawn" },
];

const BLACK_PIECES: { role: PieceRole; symbol: string; label: string }[] = [
  { role: "K", symbol: "♚", label: "King" },
  { role: "Q", symbol: "♛", label: "Queen" },
  { role: "R", symbol: "♜", label: "Rook" },
  { role: "B", symbol: "♝", label: "Bishop" },
  { role: "N", symbol: "♞", label: "Knight" },
  { role: "P", symbol: "♟", label: "Pawn" },
];

function parsePieceCounts(s: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ch of s.toUpperCase()) {
    if ("KQRBNP".includes(ch)) {
      counts[ch] = (counts[ch] ?? 0) + 1;
    }
  }
  return counts;
}

function serializeCounts(counts: Record<string, number>): string {
  return (["K", "Q", "R", "B", "N", "P"] as PieceRole[])
    .flatMap((r) => Array(counts[r] ?? 0).fill(r))
    .join("");
}

function PieceCountControl({
  symbol,
  label,
  count,
  onIncrement,
  onDecrement,
  color = "default",
  maxCount = 9,
}: {
  symbol: string;
  label: string;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  color?: "default" | "blue" | "dark";
  maxCount?: number;
}) {
  const isActive = count > 0;
  return (
    <Tooltip label={label} withArrow>
      <Box
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <ActionIcon
          variant={isActive ? "filled" : "default"}
          size="lg"
          onClick={count < maxCount ? onIncrement : undefined}
          style={{
            fontSize: "1.4rem",
            fontFamily: "serif",
            position: "relative",
            opacity: count >= maxCount ? 0.5 : 1,
          }}
        >
          {symbol}
          {isActive && (
            <Badge
              size="xs"
              variant="filled"
              color={color === "blue" ? "blue" : "gray"}
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                padding: "0 3px",
                fontSize: 9,
                lineHeight: "16px",
                pointerEvents: "none",
              }}
            >
              {count}
            </Badge>
          )}
        </ActionIcon>
        <Group gap={2}>
          <ActionIcon size="xs" variant="subtle" disabled={count <= 0} onClick={onDecrement}>
            <IconMinus size="0.6rem" />
          </ActionIcon>
          <ActionIcon size="xs" variant="subtle" disabled={count >= maxCount} onClick={onIncrement}>
            <IconPlus size="0.6rem" />
          </ActionIcon>
        </Group>
      </Box>
    </Tooltip>
  );
}

export function PieceToggleBar({
  value,
  onChange,
  label,
  description,
  allowMultiple = true,
  excludeKing = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  description?: string;
  allowMultiple?: boolean;
  excludeKing?: boolean;
}) {
  const counts = parsePieceCounts(value);
  const maxCount = allowMultiple ? 9 : 1;

  const increment = (role: PieceRole) => {
    const current = counts[role] ?? 0;
    if (current >= maxCount) return;
    const next = { ...counts, [role]: current + 1 };
    onChange(serializeCounts(next));
  };

  const decrement = (role: PieceRole) => {
    const current = counts[role] ?? 0;
    if (current <= 0) return;
    const next = { ...counts, [role]: current - 1 };
    onChange(serializeCounts(next));
  };

  const reset = () => onChange("");

  const hasAny = Object.values(counts).some((n) => n > 0);

  return (
    <Stack gap={4}>
      {label && (
        <Text size="xs" fw={500}>
          {label}
        </Text>
      )}
      <Group gap="xs" align="flex-start">
        {WHITE_PIECES.filter((p) => !excludeKing || p.role !== "K").map((p) => (
          <PieceCountControl
            key={p.role}
            symbol={p.symbol}
            label={p.label}
            count={counts[p.role] ?? 0}
            onIncrement={() => increment(p.role)}
            onDecrement={() => decrement(p.role)}
            maxCount={maxCount}
          />
        ))}
        {hasAny && (
          <Tooltip label="Clear selection" withArrow>
            <ActionIcon variant="subtle" color="red" size="sm" mt={6} onClick={reset}>
              <IconRefresh size="0.75rem" />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      {description && (
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      )}
      {hasAny && (
        <Group gap={4}>
          <Text size="xs" c="dimmed">
            Pattern:
          </Text>
          <Text size="xs" style={{ fontFamily: "monospace" }} c="blue" fw={600}>
            {value}
          </Text>
          {!allowMultiple && value.length > 1 && (
            <Text size="xs" c="dimmed" fs="italic">
              (matches {value.split("").join(" OR ")})
            </Text>
          )}
        </Group>
      )}
    </Stack>
  );
}

export function MaterialInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { whiteCounts, blackCounts } = parseMaterial(value);

  const setWhite = (counts: Record<string, number>) => {
    onChange(buildMaterial(counts, blackCounts));
  };
  const setBlack = (counts: Record<string, number>) => {
    onChange(buildMaterial(whiteCounts, counts));
  };

  const hasAny = value !== "";

  return (
    <Stack gap="xs">
      <Group gap="xl" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap={4}>
            <Text size="xs" fw={600} c="gray.3">
              White
            </Text>
          </Group>
          <Group gap="xs" align="flex-start">
            {WHITE_PIECES.filter((p) => p.role !== "K").map((p) => (
              <PieceCountControl
                key={p.role}
                symbol={p.symbol}
                label={`White ${p.label}`}
                count={whiteCounts[p.role] ?? 0}
                onIncrement={() =>
                  setWhite({ ...whiteCounts, [p.role]: (whiteCounts[p.role] ?? 0) + 1 })
                }
                onDecrement={() =>
                  setWhite({
                    ...whiteCounts,
                    [p.role]: Math.max(0, (whiteCounts[p.role] ?? 0) - 1),
                  })
                }
              />
            ))}
          </Group>
        </Stack>
        <Box
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--mantine-color-dimmed)",
            paddingTop: 24,
          }}
        >
          vs
        </Box>
        <Stack gap={4} style={{ flex: 1 }}>
          <Text size="xs" fw={600} c="gray.5">
            Black
          </Text>
          <Group gap="xs" align="flex-start">
            {BLACK_PIECES.filter((p) => p.role !== "K").map((p) => (
              <PieceCountControl
                key={p.role}
                symbol={p.symbol}
                label={`Black ${p.label}`}
                count={blackCounts[p.role] ?? 0}
                onIncrement={() =>
                  setBlack({ ...blackCounts, [p.role]: (blackCounts[p.role] ?? 0) + 1 })
                }
                onDecrement={() =>
                  setBlack({
                    ...blackCounts,
                    [p.role]: Math.max(0, (blackCounts[p.role] ?? 0) - 1),
                  })
                }
                color="dark"
              />
            ))}
          </Group>
        </Stack>
      </Group>
      {hasAny && (
        <Group gap={4}>
          <Text size="xs" c="dimmed">
            Pattern:
          </Text>
          <Text size="xs" style={{ fontFamily: "monospace" }} c="blue" fw={600}>
            {value || "—"}
          </Text>
          <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onChange("")}>
            <IconRefresh size="0.65rem" />
          </ActionIcon>
        </Group>
      )}
    </Stack>
  );
}

export function ImbalanceInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { whiteCounts, blackCounts } = parseImbalance(value);

  const setWhite = (counts: Record<string, number>) => {
    onChange(buildImbalance(counts, blackCounts));
  };
  const setBlack = (counts: Record<string, number>) => {
    onChange(buildImbalance(whiteCounts, counts));
  };

  const hasAny =
    Object.values(whiteCounts).some((n) => n > 0) || Object.values(blackCounts).some((n) => n > 0);

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        Add the pieces that give each side the imbalance advantage.
      </Text>
      <Group gap="xl" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1 }}>
          <Text size="xs" fw={600} c="gray.3">
            White advantage
          </Text>
          <Group gap="xs" align="flex-start">
            {WHITE_PIECES.filter((p) => p.role !== "K").map((p) => (
              <PieceCountControl
                key={p.role}
                symbol={p.symbol}
                label={`White ${p.label}`}
                count={whiteCounts[p.role] ?? 0}
                onIncrement={() =>
                  setWhite({ ...whiteCounts, [p.role]: (whiteCounts[p.role] ?? 0) + 1 })
                }
                onDecrement={() =>
                  setWhite({
                    ...whiteCounts,
                    [p.role]: Math.max(0, (whiteCounts[p.role] ?? 0) - 1),
                  })
                }
              />
            ))}
          </Group>
        </Stack>
        <Box
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--mantine-color-dimmed)",
            paddingTop: 24,
          }}
        >
          v
        </Box>
        <Stack gap={4} style={{ flex: 1 }}>
          <Text size="xs" fw={600} c="gray.5">
            Black advantage
          </Text>
          <Group gap="xs" align="flex-start">
            {BLACK_PIECES.filter((p) => p.role !== "K").map((p) => (
              <PieceCountControl
                key={p.role}
                symbol={p.symbol}
                label={`Black ${p.label}`}
                count={blackCounts[p.role] ?? 0}
                onIncrement={() =>
                  setBlack({ ...blackCounts, [p.role]: (blackCounts[p.role] ?? 0) + 1 })
                }
                onDecrement={() =>
                  setBlack({
                    ...blackCounts,
                    [p.role]: Math.max(0, (blackCounts[p.role] ?? 0) - 1),
                  })
                }
                color="dark"
              />
            ))}
          </Group>
        </Stack>
      </Group>
      {hasAny && (
        <Group gap={4}>
          <Text size="xs" c="dimmed">
            Pattern:
          </Text>
          <Text size="xs" style={{ fontFamily: "monospace" }} c="blue" fw={600}>
            {value || "—"}
          </Text>
          <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onChange("")}>
            <IconRefresh size="0.65rem" />
          </ActionIcon>
        </Group>
      )}
    </Stack>
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
