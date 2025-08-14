import { useAtomValue, useSetAtom } from "jotai";
import { activeTabAtom, botsAtom, enginesAtom } from "@/state/atoms";
import { Group, Paper, Select, Stack, Text, Box } from "@mantine/core";
import { memo, useEffect, useMemo } from "react";
import type { OpponentSettings } from "./types";
import type { PiecesCount } from "@/utils/chess";
import Clock from "./Clock";
import { playedMovesFamily } from "@/state/playedMoves";
import PlayedMovesTable from "@/components/panels/analysis/PlayedMovesTable";
import { ANNOTATION_INFO, type Annotation } from "@/utils/annotation";
import { normalizeScore } from "@/utils/score";

function OpponentForm({
  inline,
  opponent,
  setOpponent,
  setOtherOpponent,
}: {
  inline?: boolean;
  opponent: OpponentSettings;
  setOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  setOtherOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
}) {
  const bots = useAtomValue(botsAtom);
  const engines = useAtomValue(enginesAtom);

  const options = [
    { value: "human", label: "Human" },
    ...bots.map((b) => ({ value: b.id, label: b.name })),
  ];

  const select = (
    <Select
      label={inline ? undefined : "Player"}
      placeholder="Select player"
      data={options}
      value={(opponent as any).botId || (opponent.type === 'human' ? 'human' : undefined)}
      onChange={(val) => {
        if (!val || val === "human") {
          setOpponent((prev) => ({ ...prev, type: "human", name: "Player", timeControl: undefined, botId: undefined }));
        } else {
          const bot = bots.find((b) => b.id === val);
          if (!bot) return;
          const strategy = bot.strategy || { mode: "rank", rank: bot.pickRank ?? 1 };
          setOpponent((prev) => ({
            ...(prev.type === "engine" ? prev : ({} as any)),
            type: "engine",
            engine: (prev as any).engine ?? null,
            pickRank: bot.pickRank,
            strategy: strategy as any,
            confThreshold: (bot as any).confThreshold,
            thinkingDelayMinMs: (bot as any).thinkingDelayMinMs,
            thinkingDelayMaxMs: (bot as any).thinkingDelayMaxMs,
            timeControl: undefined,
            botId: bot.id,
          }));
        }
      }}
      style={{ flex: 1 }}
    />
  );

  if (inline) return select;
  return <Stack flex={1}>{select}</Stack>;
}

function PlayerPanel({
  color,
  opponent,
  setOpponent,
  setOtherOpponent,
  whiteTime,
  blackTime,
  turn,
  captured,
  materialDiff,
}: {
  color: "white" | "black";
  opponent: OpponentSettings;
  setOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  setOtherOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  whiteTime: number | null;
  blackTime: number | null;
  turn: "white" | "black" | undefined;
  captured: PiecesCount;
  materialDiff: number;
}) {
  const activeTab = useAtomValue(activeTabAtom)!;
  const setPlayedMoves = useSetAtom(playedMovesFamily({ tab: activeTab, color }));
  const playedMoves = useAtomValue(playedMovesFamily({ tab: activeTab, color }));

  // reset played moves if component remounts (optional; parent can clear on new game)
  useEffect(() => {
    setPlayedMoves([]);
  }, [activeTab, setPlayedMoves]);

  const capturedSize = 25;
  const pieceColorChar = color === "white" ? "d" : "l";
  const srcFor = (role: keyof PiecesCount) => `/svg/Chess_${role}${pieceColorChar}l45.svg`;

  const items: JSX.Element[] = [];
  for (let i = 0; i < captured.p; i++) items.push(<img key={`p${i}`} src={srcFor("p")} width={capturedSize} height={capturedSize} alt="pawn" />);
  for (let i = 0; i < captured.n; i++) items.push(<img key={`n${i}`} src={srcFor("n")} width={capturedSize} height={capturedSize} alt="knight" />);
  for (let i = 0; i < captured.b; i++) items.push(<img key={`b${i}`} src={srcFor("b")} width={capturedSize} height={capturedSize} alt="bishop" />);
  for (let i = 0; i < captured.r; i++) items.push(<img key={`r${i}`} src={srcFor("r")} width={capturedSize} height={capturedSize} alt="rook" />);
  for (let i = 0; i < captured.q; i++) items.push(<img key={`q${i}`} src={srcFor("q")} width={capturedSize} height={capturedSize} alt="queen" />);

  const sideDiff = color === "white" ? materialDiff : -materialDiff;
  const diffLabel = sideDiff > 0 ? `+${sideDiff}` : sideDiff < 0 ? `${sideDiff}` : undefined;

  const summary = useMemo(() => {
    let cpSum = 0;
    let cpCount = 0;
    let pctBestSum = 0;
    let pctBestCount = 0;
    let percentSum = 0;
    let percentCount = 0;
    const tally = new Map<string, number>();

    const inc = (label: string) => {
      const key = label.trim();
      tally.set(key, (tally.get(key) || 0) + 1);
    };

    for (const m of playedMoves) {
      if (m.score && m.score.value !== undefined) {
        try {
          const cp = normalizeScore(m.score.value as any, color);
          if (Number.isFinite(cp)) {
            cpSum += cp;
            cpCount++;
          }
        } catch {}
      }
      if (typeof m.pctBest === "number") {
        pctBestSum += m.pctBest;
        pctBestCount++;
      }
      if (typeof m.percentage === "number") {
        percentSum += m.percentage;
        percentCount++;
      }
      if (m.isBest) inc("Best");
      if (m.isOnlyMove) inc("Only");
      if (m.punishesMistake) inc("Punish");
      if (m.isSacrifice) inc("Sac");
      if (m.isThreat) inc("Threat");
      if (m.annotation) {
        const info = ANNOTATION_INFO[m.annotation as Annotation];
        const name = (info?.name || String(m.annotation)).trim();
        if (name) inc(name);
      }
    }

    return {
      avgCp: cpCount > 0 ? cpSum / cpCount : undefined,
      avgPctBest: pctBestCount > 0 ? pctBestSum / pctBestCount : undefined,
      avgPercentage: percentCount > 0 ? percentSum / percentCount : undefined,
      tally,
    };
  }, [playedMoves, color]);

  return (
    <Paper withBorder shadow="sm" p="md" h="100%" style={{ minHeight: 300, overflow: 'hidden', color: color === 'white' ? 'inherit' : 'white', display: 'flex', flexDirection: 'column' }}>
      <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
        <Group align="center" gap="xs">
          {color === 'white' ? (
            <>
              <OpponentForm inline opponent={opponent} setOpponent={setOpponent} setOtherOpponent={setOtherOpponent} />
              <Clock color={color} turn={turn || 'white'} whiteTime={whiteTime ?? undefined} blackTime={blackTime ?? undefined} />
            </>
          ) : (
            <>
              <Clock color={color} turn={turn || 'white'} whiteTime={whiteTime ?? undefined} blackTime={blackTime ?? undefined} />
              <OpponentForm inline opponent={opponent} setOpponent={setOpponent} setOtherOpponent={setOtherOpponent} />
            </>
          )}
        </Group>
        <Group justify="space-between" w="100%">
          <Group gap={0}>{items}</Group>
          {diffLabel && <Text size="sm" fw={600}>{diffLabel}</Text>}
        </Group>
        {/* Summary stats for player's played moves */}
        <Box>
          {playedMoves.length === 0 ? (
            <Text size="xs" c="dimmed">No moves yet</Text>
          ) : (
            <>
              <Group gap="md">
                <Text size="xs" c="dimmed">Eval</Text>
                <Text size="sm" fw={600}>{summary.avgCp !== undefined ? `${(summary.avgCp / 100).toFixed(1)} cp` : "-"}</Text>
                <Text size="xs" c="dimmed">% Best</Text>
                <Text size="sm" fw={600}>{summary.avgPctBest !== undefined ? `${summary.avgPctBest.toFixed(1)}%` : "-"}</Text>
                <Text size="xs" c="dimmed">% Played</Text>
                <Text size="sm" fw={600}>{summary.avgPercentage !== undefined ? `${summary.avgPercentage.toFixed(1)}%` : "-"}</Text>
              </Group>
              <Group gap="xs" mt={4}>
                {Array.from(summary.tally.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, count]) => (
                    <Text key={label} size="xs" fw={600}>{label.toUpperCase()}: {count}</Text>
                  ))}
              </Group>
            </>
          )}
        </Box>
        <div style={{ flex: 1, minHeight: 150 }}>
          <PlayedMovesTable color={color} />
        </div>
      </Stack>
    </Paper>
  );
}

export default memo(PlayerPanel);


