import { useAtom, useAtomValue } from "jotai";
import { activeTabAtom, botsAtom, enginesAtom, playersAtom, arrowColorMeaningAtom, arrowOpacityMeaningAtom, arrowSizeMeaningAtom, arrowOpacityAtom, arrowSizeScaleAtom, arrowCountPolicyAtom, arrowBestThresholdAtom, snapArrowsAtom, showConsecutiveArrowsAtom } from "@/state/atoms";
import { Group, Paper, Select, Stack, Text, Box, Menu, ActionIcon, SegmentedControl, Slider, Switch } from "@mantine/core";
import { IconChevronDown, IconPlayerPlay, IconPlayerPause, IconArrowUpRight, IconFlag } from "@tabler/icons-react";
import { memo, useContext, useRef, useState } from "react";
import type { OpponentSettings } from "./types";
import type { PiecesCount } from "@/utils/chess";
import Clock from "./Clock";
import { TreeStateContext } from "../common/TreeStateContext";
import { useStore } from "zustand";
import Board from "./Board";



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
  const store = useContext(TreeStateContext)!;
  const setResult = useStore(store, (s) => s.setResult);
  const headers = useStore(store, (s) => s.headers);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const activeTab = useAtomValue(activeTabAtom)!;
  const copiedTimeRef = (globalThis as any).__timeCopiedOnce || ((globalThis as any).__timeCopiedOnce = new Map<string, boolean>());

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

  function onResign() {
    if (headers.result && headers.result !== "*") return;
    const outcome = color === "white" ? "0-1" : "1-0";
    setResult(outcome as any);
  }

  const boardRef = useRef<HTMLDivElement | null>(null);

  const topRef = useRef<HTMLDivElement | null>(null);
  const [arrowsOn, setArrowsOn] = useState(true);
  const [enginePaused, setEnginePaused] = useState(false);
  const [arrowColorMeaning, setArrowColorMeaning] = useAtom(arrowColorMeaningAtom);
  const [arrowOpacityMeaning, setArrowOpacityMeaning] = useAtom(arrowOpacityMeaningAtom);
  const [arrowSizeMeaning, setArrowSizeMeaning] = useAtom(arrowSizeMeaningAtom);
  const [arrowOpacity, setArrowOpacity] = useAtom(arrowOpacityAtom);
  const [arrowSizeScale, setArrowSizeScale] = useAtom(arrowSizeScaleAtom);
  const [arrowCountPolicy, setArrowCountPolicy] = useAtom(arrowCountPolicyAtom);
  const [arrowBestThreshold, setArrowBestThreshold] = useAtom(arrowBestThresholdAtom);
  const [snapArrows, setSnapArrows] = useAtom(snapArrowsAtom);
  const [showConsecutiveArrows, setShowConsecutiveArrows] = useAtom(showConsecutiveArrowsAtom);

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
              <ActionIcon size="md" variant="light" color="red" onClick={onResign} aria-label="Resign">
                <IconFlag size={18} />
              </ActionIcon>

              <Group gap={4}>
                <ActionIcon size="md" variant={arrowsOn ? "filled" : "default"} onClick={() => setArrowsOn((v) => !v)} aria-label="Arrows">
                  <IconArrowUpRight size={18} />
                </ActionIcon>
                <Menu position="bottom-start" shadow="md" width={300}>
                  <Menu.Target>
                    <ActionIcon size="md" variant={arrowsOn ? "filled" : "default"} aria-label="Arrow settings">
                      <IconChevronDown size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Box p="sm" style={{ width: 280 }}>
                      <Text size="xs" fw={600} mb={4}>Color</Text>
                      <SegmentedControl
                        fullWidth
                        value={arrowColorMeaning}
                        onChange={(v) => setArrowColorMeaning(v as any)}
                        data={[{ label: "Rank", value: "rank" }, { label: "Score", value: "score" }, { label: "%Best", value: "pctBest" }, { label: "None", value: "uniform" }]}
                      />
                      <Box mt="sm">
                        <Text size="xs" fw={600} mb={4}>Opacity</Text>
                        <SegmentedControl
                          fullWidth
                          value={arrowOpacityMeaning}
                          onChange={(v) => setArrowOpacityMeaning(v as any)}
                          data={[{ label: "Rank", value: "rank" }, { label: "Score", value: "score" }, { label: "%Best", value: "pctBest" }, { label: "None", value: "uniform" }]}
                        />
                      </Box>
                      <Box mt="sm">
                        <Text size="xs" fw={600} mb={4}>Size</Text>
                        <SegmentedControl
                          fullWidth
                          value={arrowSizeMeaning}
                          onChange={(v) => setArrowSizeMeaning(v as any)}
                          data={[{ label: "Rank", value: "rank" }, { label: "Score", value: "score" }, { label: "%Best", value: "pctBest" }, { label: "None", value: "uniform" }]}
                        />
                      </Box>
                      <Box mt="md">
                        <Text size="xs" fw={600} mb={4}>Opacity ({Math.round(arrowOpacity * 100)}%)</Text>
                        <Slider min={0} max={1} step={0.05} value={arrowOpacity} onChange={setArrowOpacity} />
                      </Box>
                      <Box mt="md">
                        <Text size="xs" fw={600} mb={4}>Which arrows</Text>
                        <SegmentedControl
                          fullWidth
                          value={arrowCountPolicy}
                          onChange={(v) => setArrowCountPolicy(v as any)}
                          data={[{ label: "Top N", value: "alwaysTopN" }, { label: "Within Δ", value: "threshold" }]}
                        />
                        {arrowCountPolicy === 'threshold' && (
                          <Box mt="xs">
                            <Text size="xs" c="dimmed" mb={4}>Max gap from best (WDL %)</Text>
                            <Slider min={1} max={50} step={1} value={arrowBestThreshold} onChange={setArrowBestThreshold} />
                          </Box>
                        )}
                      </Box>
                      <Box mt="md">
                        <Group justify="space-between">
                          <Text size="sm">Snap to valid moves</Text>
                          <Switch checked={snapArrows} onChange={(e) => setSnapArrows(e.currentTarget.checked)} />
                        </Group>
                      </Box>
                      <Box mt="xs">
                        <Group justify="space-between">
                          <Text size="sm">Consecutive arrows</Text>
                          <Switch checked={showConsecutiveArrows} onChange={(e) => setShowConsecutiveArrows(e.currentTarget.checked)} />
                        </Group>
                      </Box>
                      <Box mt="md">
                        <Text size="xs" fw={600} mb={4}>Size scale ({arrowSizeScale.toFixed(2)}x)</Text>
                        <Slider min={0.5} max={2} step={0.05} value={arrowSizeScale} onChange={setArrowSizeScale} />
                      </Box>
                    </Box>
                  </Menu.Dropdown>
                </Menu>
              </Group>
              <ActionIcon size="md" variant={enginePaused ? "default" : "filled"} onClick={() => setEnginePaused((p: any) => !p)} aria-label={enginePaused ? 'Play' : 'Pause'}>
                {enginePaused ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />}
              </ActionIcon>
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
              <ActionIcon size="md" variant="light" color="red" onClick={onResign} aria-label="Resign">
                <IconFlag size={18} />
              </ActionIcon>

              <Group gap={4}>
                <ActionIcon size="md" variant={arrowsOn ? "filled" : "default"} onClick={() => setArrowsOn((v) => !v)} aria-label="Arrows">
                  <IconArrowUpRight size={18} />
                </ActionIcon>
                <Menu position="bottom-start" shadow="md" width={300}>
                  <Menu.Target>
                    <ActionIcon size="md" variant={arrowsOn ? "filled" : "default"} aria-label="Arrow settings">
                      <IconChevronDown size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Box p="sm" style={{ width: 280 }}>
                      <Text size="xs" fw={600} mb={4}>Color</Text>
                      <SegmentedControl
                        fullWidth
                        value={arrowColorMeaning}
                        onChange={(v) => setArrowColorMeaning(v as any)}
                        data={[{ label: "Rank", value: "rank" }, { label: "Score", value: "score" }, { label: "%Best", value: "pctBest" }, { label: "None", value: "uniform" }]}
                      />
                      <Box mt="sm">
                        <Text size="xs" fw={600} mb={4}>Opacity</Text>
                        <SegmentedControl
                          fullWidth
                          value={arrowOpacityMeaning}
                          onChange={(v) => setArrowOpacityMeaning(v as any)}
                          data={[{ label: "Rank", value: "rank" }, { label: "Score", value: "score" }, { label: "%Best", value: "pctBest" }, { label: "None", value: "uniform" }]}
                        />
                      </Box>
                      <Box mt="sm">
                        <Text size="xs" fw={600} mb={4}>Size</Text>
                        <SegmentedControl
                          fullWidth
                          value={arrowSizeMeaning}
                          onChange={(v) => setArrowSizeMeaning(v as any)}
                          data={[{ label: "Rank", value: "rank" }, { label: "Score", value: "score" }, { label: "%Best", value: "pctBest" }, { label: "None", value: "uniform" }]}
                        />
                      </Box>
                      <Box mt="md">
                        <Text size="xs" fw={600} mb={4}>Opacity ({Math.round(arrowOpacity * 100)}%)</Text>
                        <Slider min={0} max={1} step={0.05} value={arrowOpacity} onChange={setArrowOpacity} />
                      </Box>
                      <Box mt="md">
                        <Text size="xs" fw={600} mb={4}>Which arrows</Text>
                        <SegmentedControl
                          fullWidth
                          value={arrowCountPolicy}
                          onChange={(v) => setArrowCountPolicy(v as any)}
                          data={[{ label: "Top N", value: "alwaysTopN" }, { label: "Within Δ", value: "threshold" }]}
                        />
                        {arrowCountPolicy === 'threshold' && (
                          <Box mt="xs">
                            <Text size="xs" c="dimmed" mb={4}>Max gap from best (WDL %)</Text>
                            <Slider min={1} max={50} step={1} value={arrowBestThreshold} onChange={setArrowBestThreshold} />
                          </Box>
                        )}
                      </Box>
                      <Box mt="md">
                        <Group justify="space-between">
                          <Text size="sm">Snap to valid moves</Text>
                          <Switch checked={snapArrows} onChange={(e) => setSnapArrows(e.currentTarget.checked)} />
                        </Group>
                      </Box>
                      <Box mt="xs">
                        <Group justify="space-between">
                          <Text size="sm">Consecutive arrows</Text>
                          <Switch checked={showConsecutiveArrows} onChange={(e) => setShowConsecutiveArrows(e.currentTarget.checked)} />
                        </Group>
                      </Box>
                      <Box mt="md">
                        <Text size="xs" fw={600} mb={4}>Size scale ({arrowSizeScale.toFixed(2)}x)</Text>
                        <Slider min={0.5} max={2} step={0.05} value={arrowSizeScale} onChange={setArrowSizeScale} />
                      </Box>
                    </Box>
                  </Menu.Dropdown>
                </Menu>
              </Group>
              <ActionIcon size="md" variant={enginePaused ? "default" : "filled"} onClick={() => setEnginePaused((p: any) => !p)} aria-label={enginePaused ? 'Play' : 'Pause'}>
                {enginePaused ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />}
              </ActionIcon>
            </>
          )}
        </Group>
        <Group w="100%" align="center" style={{ height: 32, overflowX: 'auto', overflowY: 'hidden' }} justify={color === 'white' ? 'flex-end' : 'flex-start'}>
          {color === 'white' ? (
            <Group gap="xs" style={{ flexWrap: 'nowrap' }}>
              <Group gap={0} style={{ flexWrap: 'nowrap' }}>{items}</Group>
              {diffLabel && <Text size="sm" fw={600}>{diffLabel}</Text>}
            </Group>
          ) : (
            <Group gap="xs" style={{ flexWrap: 'nowrap' }}>
              {diffLabel && <Text size="sm" fw={600}>{diffLabel}</Text>}
              <Group gap={0} style={{ flexWrap: 'nowrap' }}>{items}</Group>
            </Group>
          )}
        </Group>
        {/* Summary stats for player's played moves */}
          <Box />
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
              arrowsEnabledOverride={arrowsOn}
              compact
              evalBarEnabled={false}
              forcedOrientation={color}
              onCapturedChange={onCapturedChange}
              onMaterialDiffChange={onMaterialDiffChange}
            />
          </Box>
        </Box>


      </Stack>
    </Paper>
  );
}

export default memo(PlayerPanel);


