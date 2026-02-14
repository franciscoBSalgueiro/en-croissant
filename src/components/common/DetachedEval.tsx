import type { BestMoves as BestMovesType, GoMode } from "@/bindings";
import {
  activeTabAtom,
  currentDetachedEngineAtom,
  currentThreatAtom,
  engineMovesFamily,
  engineProgressFamily,
  enginesAtom,
  tabEngineSettingsFamily,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen, swapMove } from "@/utils/chessops";
import type { EngineSettings } from "@/utils/engines";
import { formatScore } from "@/utils/score";
import {
  ActionIcon,
  Code,
  Group,
  Paper,
  Text,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import {
  IconPinnedOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";
import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useDeferredValue, useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import ScoreBubble from "../panels/analysis/ScoreBubble";
import { TreeStateContext } from "./TreeStateContext";

function DetachedEval() {
  const [detachedEngineId, setDetachedEngineId] = useAtom(
    currentDetachedEngineAtom,
  );
  const engines = useAtomValue(enginesAtom);

  if (!detachedEngineId) return null;

  const engine = engines.find((e) => e.id === detachedEngineId);
  if (!engine || !engine.loaded) {
    return null;
  }

  return (
    <DetachedEvalInner
      engineId={detachedEngineId}
      engineName={engine.name}
      defaultSettings={engine.settings ?? undefined}
      defaultGo={engine.go ?? undefined}
      onClose={() => setDetachedEngineId(null)}
    />
  );
}

const DetachedEvalInner = memo(function DetachedEvalInner({
  engineId,
  engineName,
  defaultSettings,
  defaultGo,
  onClose,
}: {
  engineId: string;
  engineName: string;
  defaultSettings?: EngineSettings;
  defaultGo?: GoMode;
  onClose: () => void;
}) {
  const activeTab = useAtomValue(activeTabAtom);
  const threat = useAtomValue(currentThreatAtom);
  const store = useContext(TreeStateContext)!;
  const rootFen = useStore(store, (s) => s.root.fen);
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );
  const theme = useMantineTheme();

  const [settings, setSettings] = useAtom(
    tabEngineSettingsFamily({
      engineId,
      defaultSettings,
      defaultGo,
      tab: activeTab!,
    }),
  );

  const ev = useAtomValue(
    engineMovesFamily({ engine: engineId, tab: activeTab! }),
  );
  const progress = useAtomValue(
    engineProgressFamily({ engine: engineId, tab: activeTab! }),
  );

  const [pos] = positionFromFen(rootFen);
  if (pos) {
    for (const uci of moves) {
      const move = parseUci(uci);
      if (!move) break;
      pos.play(move);
    }
  }
  const isGameOver = pos?.isEnd() ?? false;
  const finalFen = useMemo(() => (pos ? makeFen(pos.toSetup()) : null), [pos]);

  const { searchingFen, searchingMoves } = useMemo(() => {
    if (threat) {
      return {
        searchingFen: swapMove(finalFen || INITIAL_FEN),
        searchingMoves: [] as string[],
      };
    }
    return { searchingFen: rootFen, searchingMoves: moves };
  }, [rootFen, moves, threat, finalFen]);

  const engineVariations = useDeferredValue(
    useMemo(
      () => ev.get(`${searchingFen}:${searchingMoves.join(",")}`),
      [ev, searchingFen, searchingMoves],
    ),
  );

  const hasData =
    engineVariations && engineVariations.length > 0 && !isGameOver;
  const topLine = hasData ? engineVariations[0] : null;

  return (
    <Paper withBorder px="sm" py={6}>
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <ActionIcon
            size="sm"
            variant={settings.enabled ? "filled" : "transparent"}
            color={theme.primaryColor}
            onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
          >
            {settings.enabled ? (
              <IconPlayerPause size="0.875rem" />
            ) : (
              <IconPlayerPlay size="0.875rem" />
            )}
          </ActionIcon>
          <Text fw={700} fz="sm" style={{ whiteSpace: "nowrap" }}>
            {engineName}
          </Text>
          {topLine ? (
            <>
              <ScoreBubble size="sm" score={topLine.score} />
              <Text
                fz="xs"
                c="dimmed"
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {topLine.sanMoves.slice(0, 8).join(" ")}
              </Text>
            </>
          ) : (
            <Text fz="xs" c="dimmed" lh={"1.6rem"}>
              {isGameOver ? "Game over" : "—"}
            </Text>
          )}
        </Group>
        <Tooltip label="Unpin engine">
          <ActionIcon size="sm" variant="subtle" onClick={onClose}>
            <IconPinnedOff size="0.875rem" />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  );
});

export default memo(DetachedEval);
