import {
  Group,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconChartHistogram } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { commands, events, type SimulationResult, type SimulationUpdateEvent } from "@/bindings";
import ProgressButton from "@/components/common/ProgressButton";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { formatNumber } from "@/utils/format";
import type { LocalEngine } from "@/utils/engines";
import { unwrap } from "@/utils/unwrap";

const MAX_PLIES = 150;

function ResultsBar({ white, draw, black }: { white: number; draw: number; black: number }) {
  const total = white + draw + black;
  if (total === 0) return null;
  const whitePercent = (white / total) * 100;
  const drawPercent = (draw / total) * 100;
  const blackPercent = (black / total) * 100;
  return (
    <Progress.Root size="xl" style={{ outline: "1px solid var(--mantine-color-gray-4)" }}>
      <Progress.Section value={whitePercent} color="gray.1">
        <Progress.Label c="black">
          {whitePercent > 10 ? `${whitePercent.toFixed(1)}%` : ""}
        </Progress.Label>
      </Progress.Section>
      <Progress.Section value={drawPercent} color="gray">
        <Progress.Label>{drawPercent > 10 ? `${drawPercent.toFixed(1)}%` : ""}</Progress.Label>
      </Progress.Section>
      <Progress.Section value={blackPercent} color="black">
        <Progress.Label>{blackPercent > 10 ? `${blackPercent.toFixed(1)}%` : ""}</Progress.Label>
      </Progress.Section>
    </Progress.Root>
  );
}

function MonteCarloPanel() {
  const { t } = useTranslation();

  const activeTab = useAtomValue(activeTabAtom);
  const simId = `simulation_${activeTab}`;

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.root.fen);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );

  const engines = useAtomValue(enginesAtom);
  const localEngines = useMemo(
    () => (engines ?? []).filter((e): e is LocalEngine => e.type === "local"),
    [engines],
  );

  const [engineId, setEngineId] = useState(localEngines[0]?.id ?? "");
  const [games, setGames] = useState(40);
  const [movetimeMs, setMovetimeMs] = useState(100);
  const [multipv, setMultipv] = useState(4);
  const [temperature, setTemperature] = useState(60);

  const [inProgress, setInProgress] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [tally, setTally] = useState<SimulationUpdateEvent | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (localEngines.length === 0) {
      setEngineId("");
      return;
    }
    if (!localEngines.some((e) => e.id === engineId)) {
      setEngineId(localEngines[0].id);
    }
  }, [localEngines, engineId]);

  // Live tally of finished games while the simulation runs.
  useEffect(() => {
    const unlisten = events.simulationUpdateEvent.listen(({ payload }) => {
      if (payload.id === simId) {
        setTally(payload);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [simId]);

  const start = useCallback(() => {
    const engine = localEngines.find((e) => e.id === engineId);
    if (!engine) return;
    cancelledRef.current = false;
    setTally(null);
    setInProgress(true);
    commands
      .runSimulation(simId, {
        fen,
        moves,
        engine_path: engine.path,
        engine_options: [],
        movetime_ms: movetimeMs,
        games,
        max_plies: MAX_PLIES,
        multipv,
        temperature,
      })
      .then((res) => {
        if (res.status === "ok") {
          setResult(res.data);
        } else if (!cancelledRef.current) {
          unwrap(res);
        }
      })
      .catch(() => {})
      .finally(() => setInProgress(false));
  }, [localEngines, engineId, simId, fen, moves, movetimeMs, games, multipv, temperature]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    commands.cancelSimulation(simId);
  }, [simId]);

  const firstMoves = useMemo(
    () => (result ? [...result.first_moves].sort((a, b) => b.total - a.total) : []),
    [result],
  );
  const piecePaths = useMemo(
    () => (result ? [...result.piece_paths].sort((a, b) => b.count - a.count).slice(0, 15) : []),
    [result],
  );

  return (
    <ScrollArea offsetScrollbars>
      <Stack mb="lg" gap="0.4rem" mr="xs">
        <Paper withBorder p="xs">
          <Stack gap="xs">
            <Select
              allowDeselect={false}
              label={t("Common.Engine")}
              placeholder={t("Common.PickValue")}
              value={engineId || null}
              onChange={(id) => setEngineId(id ?? "")}
              data={localEngines.map((e) => ({ value: e.id, label: e.name }))}
            />
            <Group grow gap="xs" wrap="wrap">
              <NumberInput
                label={t("Common.Games")}
                min={1}
                value={games}
                onChange={(v) => setGames(typeof v === "number" ? v : Number(v) || 0)}
              />
              <NumberInput
                label={t("Board.Analysis.MovetimeMs")}
                min={1}
                value={movetimeMs}
                onChange={(v) => setMovetimeMs(typeof v === "number" ? v : Number(v) || 0)}
              />
              <NumberInput
                label={t("Board.Analysis.Multipv")}
                min={1}
                value={multipv}
                onChange={(v) => setMultipv(typeof v === "number" ? v : Number(v) || 0)}
              />
              <NumberInput
                label={t("Board.Analysis.Temperature")}
                min={0}
                value={temperature}
                onChange={(v) => setTemperature(typeof v === "number" ? v : Number(v) || 0)}
              />
            </Group>
            {localEngines.length === 0 && (
              <Text fz="sm" c="orange">
                {t("Board.Analysis.NoEngineHint")}
              </Text>
            )}
          </Stack>
        </Paper>

        <ProgressButton
          id={simId}
          redoable
          disabled={localEngines.length === 0}
          leftIcon={<IconChartHistogram size="0.875rem" />}
          onClick={start}
          onCancel={cancel}
          initInstalled={false}
          labels={{
            action: t("Board.Analysis.Simulate"),
            completed: t("Board.Analysis.Simulated"),
            inProgress: t("Board.Analysis.Simulating"),
          }}
          inProgress={inProgress}
          setInProgress={setInProgress}
        />

        {inProgress && tally && (
          <Paper withBorder p="xs">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fz="sm" c="dimmed">
                  {t("Common.Games")}: {tally.games_done} / {games}
                </Text>
              </Group>
              <ResultsBar white={tally.white} draw={tally.draw} black={tally.black} />
            </Stack>
          </Paper>
        )}

        {result && (
          <>
            <Paper withBorder p="xs">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fz="sm">
                    {t("Common.Games")}: {formatNumber(result.games)}
                  </Text>
                  <Text fz="sm" c="dimmed">
                    {t("Board.Analysis.AvgGameLength")}: {result.avg_length.toFixed(1)}
                  </Text>
                </Group>
                <ResultsBar white={result.white} draw={result.draw} black={result.black} />
              </Stack>
            </Paper>

            <Paper withBorder p="xs">
              <Stack gap="xs">
                <Text fw={500} fz="sm">
                  {t("Board.Analysis.FirstMoves")}
                </Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("Board.Analysis.Move")}</Table.Th>
                      <Table.Th>{t("Common.Games")}</Table.Th>
                      <Table.Th>{t("Board.Analysis.Result")}</Table.Th>
                      <Table.Th>{t("Board.Analysis.AvgGameLength")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {firstMoves.map((m) => (
                      <Table.Tr key={m.uci}>
                        <Table.Td fz="sm" fw={500}>
                          {m.san}
                        </Table.Td>
                        <Table.Td fz="sm">{formatNumber(m.total)}</Table.Td>
                        <Table.Td w="50%">
                          <ResultsBar white={m.white} draw={m.draw} black={m.black} />
                        </Table.Td>
                        <Table.Td fz="sm">{m.avg_length.toFixed(1)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>

            {piecePaths.length > 0 && (
              <Paper withBorder p="xs">
                <Stack gap="xs">
                  <Text fw={500} fz="sm">
                    {t("Board.Analysis.PiecePaths")}
                  </Text>
                  <Group gap="xs">
                    {piecePaths.map((p) => (
                      <Text key={`${p.from}${p.to}`} fz="sm" c="dimmed">
                        {p.from}→{p.to} ×{formatNumber(p.count)}
                      </Text>
                    ))}
                  </Group>
                </Stack>
              </Paper>
            )}
          </>
        )}
      </Stack>
    </ScrollArea>
  );
}

export default memo(MonteCarloPanel);
