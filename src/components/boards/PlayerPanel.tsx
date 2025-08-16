import { useAtomValue, useSetAtom } from "jotai";
import { activeTabAtom, botsAtom, enginesAtom, playersAtom } from "@/state/atoms";
import { Group, Paper, Select, Stack, Text, Box, useMantineTheme } from "@mantine/core";
import { memo, useEffect, useMemo } from "react";
import type { OpponentSettings } from "./types";
import type { PiecesCount } from "@/utils/chess";
import Clock from "./Clock";
import { playedMovesFamily } from "@/state/playedMoves";
import PlayedMovesTable from "@/components/panels/analysis/PlayedMovesTable";
import { ANNOTATION_INFO, isBasicAnnotation, type Annotation } from "@/utils/annotation";
import { normalizeScore } from "@/utils/score";
import { Chessground } from "@/chessground/Chessground";

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
}) {
  const theme = useMantineTheme();
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
                <Text size="xs" c="dimmed">Avg Eval</Text>
                <Text size="sm" fw={600}>{summary.avgCp !== undefined ? `${(summary.avgCp / 100).toFixed(2)}p` : "-"}</Text>
                <Text size="xs" c="dimmed">% Best</Text>
                <Text size="sm" fw={600}>{summary.avgPctBest !== undefined ? `${summary.avgPctBest.toFixed(1)}%` : "-"}</Text>
                {/* <Text size="xs" c="dimmed">% Played</Text> */}
                {/* <Text size="sm" fw={600}>{summary.avgPercentage !== undefined ? `${summary.avgPercentage.toFixed(1)}%` : "-"}</Text> */}
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
        
        {/* Previously played move vs best move info */}
        <Group grow align="stretch" gap="xs">
          <Box style={styleFromMove(theme, prevMoveInfo?.actualMoveInfo)}>
            <Text size="xs" fw={700} mb={4}>Your move</Text>
            {prevMoveInfo?.actualPreview && (
              <Box w={140} h={140} className="mini-cg" style={{ float: 'left', marginRight: 6 }}>
                <Chessground
                  fen={prevMoveInfo.actualPreview.fen}
                  coordinates={false}
                  viewOnly
                  orientation={color}
                  lastMove={prevMoveInfo.actualPreview.lastMove as any}
                  turnColor={prevMoveInfo.actualPreview.turnColor}
                  check={prevMoveInfo.actualPreview.isCheck}
                  highlight={{ lastMove: true, check: true }}
                  drawable={{ enabled: false, visible: true }}
                />
              </Box>
            )}
            {prevMoveInfo?.actualMoveInfo ? (
              (() => {
                const lines = describeMove(prevMoveInfo.actualMoveInfo, { color, labelForFirstSentence: 'You played', compareTo: prevMoveInfo.bestMoveInfo, includeAnnotationPrefix: true });
                return (
                  <Text size="xs">
                    {lines.map((line, i) => (
                      <span key={i}>
                        {line}
                        {i < lines.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                  </Text>
                );
              })()
            ) : (
              <Text size="xs" c="dimmed">No move yet.</Text>
            )}
          </Box>
          {(() => {
            const a = prevMoveInfo?.actualMoveInfo;
            const b = prevMoveInfo?.bestMoveInfo;
            const aSan = prevMoveInfo?.playedSan || a?.san || a?.move;
            const bSan = b?.san || b?.move;
            const isBestPlayed = !!a && ((a.isBest === true) || (aSan && bSan && aSan === bSan));
            if (isBestPlayed) return null;
            return (
              <Box style={styleFromMove(theme, b)}>
                <Text size="xs" fw={700} mb={4}>Best move</Text>
                {prevMoveInfo?.bestPreview && (
                  <Box w={140} h={140} className="mini-cg" style={{ float: 'left', marginRight: 6 }}>
                    <Chessground
                      fen={prevMoveInfo.bestPreview.fen}
                      coordinates={false}
                      viewOnly
                      orientation={color}
                      lastMove={prevMoveInfo.bestPreview.lastMove as any}
                      turnColor={prevMoveInfo.bestPreview.turnColor}
                      check={prevMoveInfo.bestPreview.isCheck}
                      highlight={{ lastMove: true, check: true }}
                      drawable={{ enabled: false, visible: true }}
                    />
                  </Box>
                )}
                {b ? (
                  (() => {
                    const lines = describeMove(b, { color, labelForFirstSentence: 'Best move is', includeAnnotationPrefix: false });
                    return (
                      <Text size="xs">
                        {lines.map((line, i) => (
                          <span key={i}>
                            {line}
                            {i < lines.length - 1 ? ' ' : ''}
                          </span>
                        ))}
                      </Text>
                    );
                  })()
                ) : (
                  <Text size="xs" c="dimmed">No best move available.</Text>
                )}
              </Box>
            );
          })()}
        </Group>
        <div style={{ flex: 1, minHeight: 150 }}>
          <PlayedMovesTable color={color} />
        </div>
      </Stack>
    </Paper>
  );
}

export default memo(PlayerPanel);


