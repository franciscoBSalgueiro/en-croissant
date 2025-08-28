import { useAtomValue, useSetAtom } from "jotai";
import { activeTabAtom, botsAtom, enginesAtom, playersAtom, defaultPlayerIdAtom } from "@/state/atoms";
import { Group, Paper, Select, Stack, Text, Box, useMantineTheme, Button } from "@mantine/core";
import { memo, useEffect, useMemo, useContext, useRef } from "react";
import type { OpponentSettings } from "./types";
import type { PiecesCount } from "@/utils/chess";
import Clock from "./Clock";
import { playedMovesFamily } from "@/state/playedMoves";
import PlayedMovesTable from "@/components/panels/analysis/PlayedMovesTable";
import { ANNOTATION_INFO, isBasicAnnotation, type Annotation } from "@/utils/annotation";
import { normalizeScore } from "@/utils/score";
import { Chessground } from "@/chessground/Chessground";
import { TreeStateContext } from "../common/TreeStateContext";
import { useStore } from "zustand";
import Board from "./Board";

// Helper: format centipawn to pawn string
function formatPawnEval(cp: number | undefined) {
  if (!Number.isFinite(cp as any)) return undefined;
  return ((cp as number) / 100).toFixed(2) + "p";
}

// Helper: humanize a list with commas and 'and'
function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// Helper: convert count to readable quantity
function quantityWord(count: number): string {
  const map: Record<number, string> = {
    1: "a",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
  };
  return map[count] || String(count);
}

// Helper: piece name singular/plural
function pieceName(letter: string, count: number): string {
  switch (letter) {
    case "p":
      return count === 1 ? "pawn" : "pawns";
    case "n":
      return count === 1 ? "knight" : "knights";
    case "b":
      return count === 1 ? "bishop" : "bishops";
    case "r":
      return count === 1 ? "rook" : "rooks";
    case "q":
      return count === 1 ? "queen" : "queens";
    default:
      return letter;
  }
}

// Standalone: translate compact material string like "ppqn" into natural language
export function translateMaterialString(material: string | undefined | null): string | undefined {
  if (!material || material.trim().length === 0) return undefined;
  const counts: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const ch of material) {
    if (counts.hasOwnProperty(ch)) counts[ch] += 1;
  }
  // Order: pawns first, then queen, rook, bishop, knight (can be tweaked)
  const order = ["p", "q", "r", "b", "n"] as const;
  const parts: string[] = [];
  for (const l of order) {
    const c = counts[l];
    if (!c) continue;
    const qty = quantityWord(c);
    parts.push(`${qty} ${pieceName(l, c)}`);
  }
  if (parts.length === 0) return undefined;
  return formatList(parts);
}

// Helper: build tinted box style from a move's annotation
function styleFromMove(theme: any, move: any): React.CSSProperties {
  const ann = (move?.annotation ?? "") as Annotation;
  const colorName = ANNOTATION_INFO[ann]?.color as any;
  const darkText = (theme.colors as any)?.dark?.[9] ?? "#111";
  if (colorName) {
    const bg = (theme.colors as any)[colorName]?.[0] ?? theme.colors.gray[0];
    const border = (theme.colors as any)[colorName]?.[4] ?? theme.colors.gray[4];
    return { backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 6, padding: 8, color: darkText };
  }
  const lightBg = theme.colors.gray[0];
  const lightBorder = theme.colors.gray[3];
  return { backgroundColor: lightBg, border: `1px solid ${lightBorder}`, borderRadius: 6, padding: 8, color: darkText };
}

// Standalone: describe a move in sentences
function describeMove(
  move: any | undefined,
  opts: {
    color: "white" | "black";
    labelForFirstSentence?: string; // e.g., "You played" or "Best move is"
    compareTo?: any; // optional: compare vs best move
    includeAnnotationPrefix?: boolean;
  },
): Array<React.ReactNode> {
  if (!move) return ["No data."];

  const sentences: Array<React.ReactNode> = [];
  const san = move?.san || move?.move;
  const hasScore = move?.score && (move.score as any).value !== undefined;
  const cp = hasScore ? normalizeScore((move.score as any).value, "white") : undefined;
  const evalStr = formatPawnEval(cp);
  const engine = move?.engineName;
  const depth = move?.depth;

  const firstLabel = opts.labelForFirstSentence || "Move";
  const engineDepth = engine ? `${engine}${typeof depth === "number" ? ` (d${depth})` : ""}` : "";

  // Determine if this move is the same as best (so we can skip annotation prefix when best)
  let isSameAsBest = false;
  if (opts.compareTo) {
    const best = opts.compareTo;
    const bestSan = best?.san || best?.move;
    if (san && bestSan && san === bestSan) isSameAsBest = true;
  }

  // Optional annotation prefix (skip if best)
  if (opts.includeAnnotationPrefix !== false && !isSameAsBest) {
    const ann = (move?.annotation ?? '') as string;
    const label = ann && isBasicAnnotation(ann) ? (ANNOTATION_INFO[ann as Annotation]?.name || '').trim() : '';
    if (label) sentences.push(`${label}.`);
  }

  if (san) {
    sentences.push(
      <>
        {firstLabel + " "}
        <Text span fw={700}>{san}</Text>
        {`, evaluated by ${engineDepth || 'Engine'} at ${evalStr || 'unknown'}.`}
      </>
    );
  } else {
    sentences.push(`${firstLabel}, evaluated by ${engineDepth || 'Engine'} at ${evalStr || 'unknown'}.`);
  }

  // Comparison sentence vs best
  if (opts.compareTo) {
    const best = opts.compareTo;
    const bestSan = best?.san || best?.move;
    const bestHasScore = best?.score && (best.score as any).value !== undefined;
    const bestCp = bestHasScore ? normalizeScore((best.score as any).value, "white") : undefined;
    const bestEvalStr = formatPawnEval(bestCp);
    const pctBest = typeof move?.pctBest === "number" ? move.pctBest.toFixed(1) : undefined;
    const isSame = san && bestSan && san === bestSan;
    if (isSame) {
      sentences.push("This is the best move.");
    } else {
      if (pctBest) {
        sentences.push(
          <>
            {`This is `}<Text span td="underline">{pctBest}%</Text>{` as good as the best move, `}
            {bestSan ? <><Text span fw={700}>{`${bestSan}`}</Text>{bestEvalStr ? ` (${bestEvalStr})` : ""}</> : null}
            {`.`}
          </>
        );
      } else if (bestSan) {
        sentences.push(
          <>
            {`Compared to the best move, `}
            <Text span fw={700}>{bestSan}</Text>
            {bestEvalStr ? ` (${bestEvalStr})` : ""}
            {`.`}
          </>
        );
      }
    }
  }

  // Tags / flags
  const tags: string[] = [];
  if (move?.isOnlyMove) tags.push("This was the only move.");
  if (move?.punishesMistake) tags.push("It punishes the opponent's mistake.");
  if (move?.isSacrifice) tags.push("It is a sacrifice.");
  if (move?.isThreat) tags.push("Evaluated in a threat context.");
  if (tags.length > 0) sentences.push(tags.join(" "));

  // Metrics sentence
  const metrics: string[] = [];
  if (typeof move?.winChance === "number") metrics.push(`Your chance of winning is now ${move.winChance.toFixed(1)}%`);
  if (typeof move?.winDelta === "number" && Math.abs(move.winDelta) >= 0.01)
    metrics.push(`a change of ${(move.winDelta > 0 ? "+" : "") + move.winDelta.toFixed(2)}%`);
  if (typeof move?.confidence === "number") metrics.push(`and the obviousness of this move was ${move.confidence.toFixed(1)}%`);
  // if (typeof move?.pctBest === "number") metrics.push(`percent of best ${move.pctBest.toFixed(1)}%`);
  if (metrics.length > 0) sentences.push(metrics.join(", ") + ".");

  // Material sentence from PV
  let md = typeof move?.materialDelta === "number" ? move.materialDelta : 0;
  if (opts.color === 'black') md = -md;
  const gained = typeof move?.materialGained === "string" ? move.materialGained : "";
  const lost = typeof move?.materialLost === "string" ? move.materialLost : "";
  // if (md !== 0 || gained || lost) {
  if (md !== 0) {
    const parts: string[] = [];
    parts.push(`Over the principal variation, material changes by ${(md > 0 ? "+" : "") + md}`);
    const gainedText = translateMaterialString(gained);
    const lostText = translateMaterialString(lost);
    if (gainedText && lostText) parts.push(`you gain ${gainedText} and lose ${lostText}`);
    else if (gainedText) parts.push(`you gain ${gainedText}`);
    else if (lostText) parts.push(`you lose ${lostText}`);
    sentences.push(parts.join("; ") + ".");
  }

  return sentences;
}

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
  const theme = useMantineTheme();
  const bots = useAtomValue(botsAtom);
  const players = useAtomValue(playersAtom);
  const engines = useAtomValue(enginesAtom);

  const options = [
    { value: "human", label: "Human" },
    ...players.map((p) => ({ value: `player:${p.id}`, label: p.name })),
    ...bots.map((b) => ({ value: `bot:${b.id}`, label: b.name })),
  ];

  const select = (
    <Select
      label={inline ? undefined : "Player"}
      placeholder="Select player"
      data={options}
      value={
        opponent.type === 'human'
          ? (opponent as any).playerId ? `player:${(opponent as any).playerId}` : 'human'
          : (opponent as any).botId ? `bot:${(opponent as any).botId}` : undefined
      }
      onChange={(val) => {
        if (!val || val === "human") {
          setOpponent((prev) => ({ ...prev, type: "human", name: "Player", timeControl: undefined, botId: undefined, playerId: undefined }));
          return;
        }
        if (val.startsWith('player:')) {
          const id = val.slice('player:'.length);
          const player = players.find((p) => p.id === id);
          if (!player) return;
          setOpponent((prev) => ({ ...prev, type: 'human', name: player.name, playerId: player.id, timeControl: undefined, botId: undefined } as any));
          return;
        }
        if (val.startsWith('bot:')) {
          const id = val.slice('bot:'.length);
          const bot = bots.find((b) => b.id === id);
          if (!bot) return;
          const strategy = bot.strategy || { mode: "rank", rank: bot.pickRank ?? 1 };
          setOpponent((prev) => ({
            ...(prev.type === "engine" ? prev : ({} as any)),
            type: "engine",
            engine: (prev as any).engine ?? null,
            pickRank: bot.pickRank,
            strategy: strategy as any,
            elo: (bot as any).earnedELO ?? (bot as any).elo,
            skillLevel: (bot as any).skillLevel,
            confThreshold: (bot as any).confThreshold,
            thinkingDelayMinMs: (bot as any).thinkingDelayMinMs,
            thinkingDelayMaxMs: (bot as any).thinkingDelayMaxMs,
            timeControl: undefined,
            botId: bot.id,
            playerId: undefined,
          }));
          return;
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
  prevMoveInfo,
  movable,
  onCapturedChange,
  onMaterialDiffChange,
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
  prevMoveInfo?: {
    playedSan?: string;
    actualMoveInfo?: any; // UnifiedMove
    bestMoveInfo?: any; // UnifiedMove
    actualPreview?: { fen: string; lastMove: string[]; isCheck: boolean; turnColor: "white" | "black" };
    bestPreview?: { fen: string; lastMove: string[]; isCheck: boolean; turnColor: "white" | "black" };
  };
  movable: "both" | "white" | "black" | "turn" | "none";
  onCapturedChange?: (captured: { white: PiecesCount; black: PiecesCount }) => void;
  onMaterialDiffChange?: (diff: number) => void;
}) {
  const theme = useMantineTheme();
  const store = useContext(TreeStateContext)!;
  const setResult = useStore(store, (s) => s.setResult);
  const headers = useStore(store, (s) => s.headers);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const activeTab = useAtomValue(activeTabAtom)!;
  const defaultPlayerId = useAtomValue(defaultPlayerIdAtom);
  const setPlayedMoves = useSetAtom(playedMovesFamily({ tab: activeTab, color }));
  const playedMoves = useAtomValue(playedMovesFamily({ tab: activeTab, color }));
  const copiedTimeRef = (globalThis as any).__timeCopiedOnce || ((globalThis as any).__timeCopiedOnce = new Map<string, boolean>());

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
    let rankSum = 0;
    let rankCount = 0;
    const tally = new Map<string, number>();

    const inc = (label: string) => {
      const key = label.trim();
      tally.set(key, (tally.get(key) || 0) + 1);
    };

    for (const m of playedMoves) {
      if (m.score && m.score.value !== undefined) {
        try {
          const cp = normalizeScore(m.score.value as any, "white");
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
      if (typeof m.rank === "number") {
        rankSum += m.rank;
        rankCount++;
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
      avgRank: rankCount > 0 ? rankSum / rankCount : undefined,
      tally,
    };
  }, [playedMoves, color]);

  const prevMoveBoxStyle = useMemo(() => {
    const ann = (prevMoveInfo?.actualMoveInfo?.annotation ?? "") as Annotation;
    const colorName = ANNOTATION_INFO[ann]?.color as any;
    const darkText = (theme.colors as any)?.dark?.[9] ?? '#111';
    if (colorName) {
      const bg = (theme.colors as any)[colorName]?.[0] ?? theme.colors.gray[0];
      const border = (theme.colors as any)[colorName]?.[4] ?? theme.colors.gray[4];
      return { backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 6, padding: 6, color: darkText } as React.CSSProperties;
    }
    const lightBg = theme.colors.gray[0];
    const lightBorder = theme.colors.gray[3];
    return { backgroundColor: lightBg, border: `1px solid ${lightBorder}`, borderRadius: 6, padding: 6, color: darkText } as React.CSSProperties;
  }, [prevMoveInfo?.actualMoveInfo?.annotation]);

  function onResign() {
    if (headers.result && headers.result !== "*") return;
    const outcome = color === "white" ? "0-1" : "1-0";
    setResult(outcome as any);
  }

  const boardRef = useRef<HTMLDivElement | null>(null);

  const topRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const movesRef = useRef<HTMLDivElement | null>(null);

  return (
    <Paper withBorder shadow="sm" p="md" h="100%" style={{ minHeight: 300, overflow: 'hidden', color: color === 'white' ? 'inherit' : 'white', display: 'flex', flexDirection: 'column' }}>
      <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
        <Box ref={topRef}>
          <Group align="center" gap="xs">
          {color === 'white' ? (
            <>
              <OpponentForm inline opponent={opponent} setOpponent={setOpponent} setOtherOpponent={setOtherOpponent} />
              <Select
                placeholder="Time"
                data={["Unlimited", "1|0", "2|1", "5|0", "10|0", "15|10", "30|0", "60|0"].map((v) => ({ value: v, label: v === "Unlimited" ? "Unlimited" : v.replace("|", " | ") }))}
                value={(opponent as any).timeControl ?? "Unlimited"}
                onChange={(val) => {
                  const newVal = val === "Unlimited" ? undefined : val || undefined;
                  const key = `${activeTab}-tc-copied`;
                  const firstChange = !copiedTimeRef.get(key);

                  // update opponents panel state
                  setOpponent((prev) => ({ ...prev, timeControl: newVal } as any));
                  if (firstChange) {
                    setOtherOpponent((prev) => ({ ...prev, timeControl: newVal } as any));
                  }

                  // Update headers so clocks switch mode immediately for one or both sides
                  const toHeader = (s: string | undefined): string | undefined => {
                    if (!s) return undefined; // Unlimited
                    const [mStr, incStr] = s.split("|");
                    const minutes = Number(mStr || 0);
                    const inc = Number(incStr || 0);
                    const seconds = Math.max(0, Math.round(minutes * 60));
                    return `${seconds}${inc ? "+" + inc : ""}`;
                  };
                  const headerVal: any = toHeader(newVal as any);
                  const payload: any = { ...headers } as any;
                  (payload as any)['white_time_control'] = headerVal;
                  if (firstChange) {
                    (payload as any)['black_time_control'] = headerVal;
                  }
                  setHeaders(payload);

                  if (firstChange) copiedTimeRef.set(key, true);
                }}
                allowDeselect
                clearable={false}
                w={100}
              />
              <Button size="xs" variant="light" color="red" onClick={onResign}>Resign</Button>
              <Clock color={color} turn={turn || 'white'} whiteTime={whiteTime ?? undefined} blackTime={blackTime ?? undefined} />
            </>
          ) : (
            <>
              <Clock color={color} turn={turn || 'white'} whiteTime={whiteTime ?? undefined} blackTime={blackTime ?? undefined} />
              <OpponentForm inline opponent={opponent} setOpponent={setOpponent} setOtherOpponent={setOtherOpponent} />
              <Select
                placeholder="Time"
                data={["Unlimited", "1|0", "2|1", "5|0", "10|0", "15|10", "30|0", "60|0"].map((v) => ({ value: v, label: v === "Unlimited" ? "Unlimited" : v.replace("|", " | ") }))}
                value={(opponent as any).timeControl ?? "Unlimited"}
                onChange={(val) => {
                  const newVal = val === "Unlimited" ? undefined : val || undefined;
                  const key = `${activeTab}-tc-copied`;
                  const firstChange = !copiedTimeRef.get(key);

                  // update opponents panel state
                  setOpponent((prev) => ({ ...prev, timeControl: newVal } as any));
                  if (firstChange) {
                    setOtherOpponent((prev) => ({ ...prev, timeControl: newVal } as any));
                  }

                  // Update headers so clocks switch mode immediately for one or both sides
                  const toHeader = (s: string | undefined): string | undefined => {
                    if (!s) return undefined; // Unlimited
                    const [mStr, incStr] = s.split("|");
                    const minutes = Number(mStr || 0);
                    const inc = Number(incStr || 0);
                    const seconds = Math.max(0, Math.round(minutes * 60));
                    return `${seconds}${inc ? "+" + inc : ""}`;
                  };
                  const headerVal: any = toHeader(newVal as any);
                  const payload: any = { ...headers } as any;
                  (payload as any)['black_time_control'] = headerVal;
                  if (firstChange) {
                    (payload as any)['white_time_control'] = headerVal;
                  }
                  setHeaders(payload);

                  if (firstChange) copiedTimeRef.set(key, true);
                }}
                allowDeselect
                clearable={false}
                w={100}
              />
              <Button size="xs" variant="light" color="red" onClick={onResign}>Resign</Button>
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
                  <Text size="xs" c="dimmed">Avg Eval</Text>
                  <Text size="sm" fw={600}>{summary.avgCp !== undefined ? `${(summary.avgCp / 100).toFixed(2)}p` : "-"}</Text>
                  <Text size="xs" c="dimmed">Avg %Best</Text>
                  <Text size="sm" fw={600}>{summary.avgPctBest !== undefined ? `${summary.avgPctBest.toFixed(1)}%` : "-"}</Text>
                  <Text size="xs" c="dimmed">Avg Rank</Text>
                  <Text size="sm" fw={600}>{summary.avgRank !== undefined ? `${summary.avgRank.toFixed(1)}` : "-"}</Text>
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
        </Box>

        {/* Embedded board from this player's perspective */}
        <Box style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Box style={{ height: '100%', width: '100%', display: 'flex', minWidth: 0, minHeight: 0 }}>
            <Board
              dirty={false}
              editingMode={false}
              toggleEditingMode={() => undefined}
              viewOnly={false}
              boardRef={boardRef}
              canTakeBack={true}
              movable={movable}
              whiteTime={whiteTime ?? undefined}
              blackTime={blackTime ?? undefined}
              fitContainer
              compact
              forcedOrientation={color}
              onCapturedChange={onCapturedChange}
              onMaterialDiffChange={onMaterialDiffChange}
            />
          </Box>
        </Box>
        
        {/* Insights moved into AnalysisBar; keep a minimal spacer for measurement */}
        <Group ref={bottomRef as any} gap="xs" />
        {/* Played moves moved to AnalysisBar 'Played Moves' tab */}
        <div ref={movesRef as any} style={{ flex: 0, minHeight: 0 }} />
      </Stack>
    </Paper>
  );
}

export default memo(PlayerPanel);


