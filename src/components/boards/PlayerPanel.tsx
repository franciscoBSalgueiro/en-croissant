import { useAtomValue, useSetAtom } from "jotai";
import { activeTabAtom, botsAtom, enginesAtom } from "@/state/atoms";
import { Group, Paper, Select, Stack, Text } from "@mantine/core";
import { memo, useEffect } from "react";
import type { OpponentSettings } from "./types";
import type { PiecesCount } from "@/utils/chess";
import Clock from "./Clock";
import { playedMovesFamily } from "@/state/playedMoves";
import PlayedMovesTable from "@/components/panels/analysis/PlayedMovesTable";

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
        <div style={{ flex: 1, minHeight: 150 }}>
          <PlayedMovesTable color={color} />
        </div>
      </Stack>
    </Paper>
  );
}

export default memo(PlayerPanel);


