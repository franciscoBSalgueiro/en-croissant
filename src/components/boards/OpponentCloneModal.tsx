import {
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconX } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type EngineOption, type GoMode, type PlayerConfig } from "@/bindings";
import { enginesAtom } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";
import { buildOpponentBook, type OpponentBook } from "@/utils/opponent";
import { fetchOpponentGames } from "@/utils/opponentGames";
import { unwrap } from "@/utils/unwrap";

const DEFAULT_GO: GoMode = { t: "Depth", c: 20 };
const MAIA_ELO_MIN = 1100;
const MAIA_ELO_MAX = 1900;

type CloneStats = {
  games: number;
  positions: number;
  avgElo?: number;
};

function maiaEloFor(avgElo: number): number {
  const nearest100 = Math.round(avgElo / 100) * 100;
  return Math.min(MAIA_ELO_MAX, Math.max(MAIA_ELO_MIN, nearest100));
}

async function engineSupportsMaiaElo(engine: LocalEngine): Promise<boolean> {
  if ((engine.settings ?? []).some((setting) => setting.name === "MaiaElo")) {
    return true;
  }
  try {
    const config = unwrap(await commands.getEngineConfig(engine.path));
    return config.options.some((option) => option.value.name === "MaiaElo");
  } catch {
    return false;
  }
}

async function buildCloneEngineConfig(
  engine: LocalEngine,
  displayName: string,
  avgElo: number | undefined,
  book: OpponentBook,
): Promise<PlayerConfig> {
  const options: EngineOption[] = (engine.settings ?? [])
    .filter((setting) => setting.name !== "MultiPV")
    .map((setting) => ({ name: setting.name, value: setting.value?.toString() ?? "" }));

  if (avgElo !== undefined && (await engineSupportsMaiaElo(engine))) {
    const maiaElo = String(maiaEloFor(avgElo));
    const index = options.findIndex((option) => option.name === "MaiaElo");
    if (index >= 0) {
      options[index] = { name: "MaiaElo", value: maiaElo };
    } else {
      options.push({ name: "MaiaElo", value: maiaElo });
    }
  }

  return {
    type: "engine",
    name: displayName,
    path: engine.path,
    options,
    go: engine.go ?? DEFAULT_GO,
    opponent_book: book,
  };
}

function OpponentCloneModal({
  opened,
  onClose,
  onCloneReady,
}: {
  opened: boolean;
  onClose: () => void;
  onCloneReady: (color: "white" | "black", engineConfig: PlayerConfig) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const allEngines = useAtomValue(enginesAtom);
  const engines = (allEngines ?? []).filter((e): e is LocalEngine => e.type === "local");

  const [username, setUsername] = useState("");
  const [color, setColor] = useState<"white" | "black">("black");
  const [engineId, setEngineId] = useState<string | null>(null);
  const [maxPly, setMaxPly] = useState(12);
  const [building, setBuilding] = useState(false);
  const [stats, setStats] = useState<CloneStats | null>(null);

  function handleClose() {
    if (building) return;
    setStats(null);
    onClose();
  }

  const maiaEngine = engines.find((engine) => engine.name.toLowerCase().startsWith("maia"));
  const selectedEngine =
    engines.find((engine) => engine.id === engineId) ?? maiaEngine ?? engines[0] ?? null;

  async function handleBuildAndStart() {
    if (!selectedEngine || building) {
      return;
    }
    setBuilding(true);
    setStats(null);
    try {
      const games = await fetchOpponentGames(username.trim());
      if (games.length === 0) {
        notifications.show({
          title: t("Board.Play.Clone.FetchError", "Failed to fetch games"),
          message: t("Board.Play.Clone.NoGames", "No games found for this username"),
          color: "red",
          icon: <IconX size="1rem" />,
        });
        return;
      }

      const { book, playerCount, avgElo } = buildOpponentBook(games, Math.max(1, maxPly));
      setStats({
        games: playerCount,
        positions: Object.keys(book.positions).length,
        avgElo,
      });

      const engineConfig = await buildCloneEngineConfig(
        selectedEngine,
        `${username.trim()} (clone)`,
        avgElo,
        book,
      );
      await onCloneReady(color, engineConfig);
      onClose();
    } catch (err) {
      notifications.show({
        title: t("Board.Play.Clone.FetchError", "Failed to fetch games"),
        message: err instanceof Error ? err.message : String(err),
        color: "red",
        icon: <IconX size="1rem" />,
      });
    } finally {
      setBuilding(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Board.Play.CloneOpponent", "Clone opponent…")}
      size="lg"
    >
      <Stack>
        <TextInput
          label={t("Board.Play.Clone.Username", "Lichess username")}
          placeholder="DrNykterstein"
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
          data-autofocus
        />
        <Stack gap={4}>
          <Text fz="sm" fw={500}>
            {t("Board.Play.Clone.Color", "Opponent plays")}
          </Text>
          <SegmentedControl
            value={color}
            onChange={(value) => setColor(value as "white" | "black")}
            data={[
              { value: "white", label: "White" },
              { value: "black", label: "Black" },
            ]}
          />
        </Stack>
        <Select
          label={t("Board.Play.Clone.Engine", "Engine when out of book")}
          allowDeselect={false}
          data={engines.map((engine) => ({ label: engine.name, value: engine.id }))}
          value={selectedEngine?.id ?? ""}
          onChange={(value) => setEngineId(value)}
        />
        <NumberInput
          label={t("Board.Play.Clone.BookDepth", "Book depth (plies)")}
          description="Maximum number of plies from the starting position that the cloned opening book will be used for."
          min={1}
          max={100}
          value={maxPly}
          onChange={(value) => {
            if (typeof value === "number" && Number.isFinite(value)) {
              setMaxPly(Math.max(1, Math.trunc(value)));
            }
          }}
        />
        {stats && (
          <Paper withBorder p="xs">
            <Group gap="lg">
              <Text size="sm">
                {t("Board.Play.Clone.GamesFound", "Games found")}: <b>{stats.games}</b>
              </Text>
              <Text size="sm">
                {t("Board.Play.Clone.Positions", "Book positions")}: <b>{stats.positions}</b>
              </Text>
              {stats.avgElo !== undefined && (
                <Text size="sm">
                  {t("Board.Play.Clone.AvgElo", "Average Elo")}: <b>{stats.avgElo}</b>
                </Text>
              )}
            </Group>
          </Paper>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose} disabled={building}>
            {t("Common.Cancel")}
          </Button>
          <Button
            leftSection={<IconCopy size="1rem" />}
            loading={building}
            disabled={selectedEngine === null || username.trim().length === 0}
            onClick={handleBuildAndStart}
          >
            {t("Board.Play.Clone.Build", "Build & start")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default OpponentCloneModal;
