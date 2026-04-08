import {
  Alert,
  Button,
  Group,
  Modal,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { IconDatabaseExport } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { resolve } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import useSWR from "swr/immutable";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { commands, type GameQuery, type PlayerSide } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  currentDbTabAtom,
  currentDbTypeAtom,
  currentLocalOptionsAtom,
  currentTabAtom,
  lichessOptionsAtom,
  masterOptionsAtom,
  referenceDbAtom,
  sessionsAtom,
} from "@/state/atoms";
import {
  export_board_filtered_games,
  getDatabases,
  type Opening,
  searchPosition,
} from "@/utils/db";
import { getDatabasesDir } from "@/utils/directories";
import { formatNumber } from "@/utils/format";
import { convertToNormalized, getLichessGames, getMasterGames } from "@/utils/lichess/api";
import type { LichessGamesOptions, MasterGamesOptions } from "@/utils/lichess/explorer";
import DatabaseLoader from "./DatabaseLoader";
import GamesTable from "./GamesTable";
import NoDatabaseWarning from "./NoDatabaseWarning";
import OpeningsTable from "./OpeningsTable";
import LichessOptionsPanel from "./options/LichessOptionsPanel";
import LocalOptionsPanel from "./options/LocalOptionsPanel";
import MasterOptionsPanel from "./options/MastersOptionsPanel";

type DBType =
  | { type: "local"; options: LocalOptions }
  | {
      type: "lch_all";
      options: LichessGamesOptions;
      fen: string;
      token: string;
    }
  | {
      type: "lch_master";
      options: MasterGamesOptions;
      fen: string;
      token: string;
    };

export type LocalOptions = {
  path: string | null;
  fen: string;
  type: "exact" | "partial";
  player: number | null;
  player2: number | null;
  player1Side: PlayerSide;
  player2Side: PlayerSide;
  start_date?: string;
  end_date?: string;
  result: "any" | "whitewon" | "draw" | "blackwon";
};

function sortOpenings(openings: Opening[]) {
  return openings.sort((a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white));
}

function sanitizeDatabaseFilename(name: string): string {
  const trimmed = name.trim().replace(/\.db3$/i, "");
  if (!trimmed) return "filtered-games";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return safe || "filtered-games";
}

/** Same `GameQuery` shape as `searchPosition` for local databases (board filters). */
function buildBoardLocalExportQuery(options: LocalOptions): GameQuery {
  return {
    player1: options.player ?? undefined,
    player2: options.player2 ?? undefined,
    player1Side: options.player1Side,
    player2Side: options.player2Side,
    position: {
      fen: options.fen,
      type_: options.type,
    },
    start_date: options.start_date,
    end_date: options.end_date,
    wanted_result: options.result === "any" ? undefined : options.result,
  };
}

async function fetchOpening(db: DBType, tab: string) {
  return match(db)
    .with({ type: "lch_all" }, async ({ fen, options, token }) => {
      const data = await getLichessGames(fen, options, token);
      return {
        openings: data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        })),
        games: await convertToNormalized(data.topGames || data.recentGames || []),
      };
    })
    .with({ type: "lch_master" }, async ({ fen, options, token }) => {
      const data = await getMasterGames(fen, options, token);
      return {
        openings: data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        })),
        games: await convertToNormalized(data.topGames || data.recentGames || []),
      };
    })
    .with({ type: "local" }, async ({ options }) => {
      if (!options.path) throw Error("Missing reference database");
      const positionData = await searchPosition(options, tab);
      return {
        openings: sortOpenings(positionData[0]),
        games: positionData[1],
      };
    })
    .exhaustive();
}

function DatabasePanel() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const [referenceDatabase, setReferenceDatabase] = useAtom(referenceDbAtom);
  const sessions = useAtomValue(sessionsAtom);
  const [debouncedFen] = useDebouncedValue(fen, 50);
  const [lichessOptions, setLichessOptions] = useAtom(lichessOptionsAtom);
  const [masterOptions, setMasterOptions] = useAtom(masterOptionsAtom);
  const [localOptions, setLocalOptions] = useAtom(currentLocalOptionsAtom);
  const [db, setDb] = useAtom(currentDbTypeAtom);
  const explorerToken = sessions.find((session) => session.lichess?.accessToken)?.lichess
    ?.accessToken;
  const missingExplorerToken = db !== "local" && !explorerToken;

  const { data: databases } = useSWR(db === "local" ? "databases" : null, () => getDatabases());

  const dbSelectData = (databases ?? [])
    .filter((d) => d.type === "success")
    .map((d) => ({ value: d.file, label: d.title || d.filename }));

  useEffect(() => {
    if (db === "local") {
      setLocalOptions((q) => ({ ...q, fen: debouncedFen }));
    }
  }, [debouncedFen, setLocalOptions, setMasterOptions, setLichessOptions, db]);

  useEffect(() => {
    if (db === "local") {
      setLocalOptions((q) => ({ ...q, path: referenceDatabase }));
    }
  }, [referenceDatabase, setLocalOptions, db]);

  const dbType: DBType = match(db)
    .with("local", (v) => ({
      type: v,
      options: localOptions,
    }))
    .with("lch_all", (v) => ({
      type: v,
      options: lichessOptions,
      fen: debouncedFen,
      token: explorerToken ?? "",
    }))
    .with("lch_master", (v) => ({
      type: v,
      options: masterOptions,
      fen: debouncedFen,
      token: explorerToken ?? "",
    }))
    .exhaustive();

  const tab = useAtomValue(currentTabAtom);
  const [tabType, setTabType] = useAtom(currentDbTabAtom);

  const [exportModalOpen, exportModalHandlers] = useDisclosure(false);
  const [exportName, setExportName] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  async function onConfirmBoardExport() {
    const title = exportName.trim();
    if (!title) {
      notifications.show({
        color: "red",
        title: t("Common.Error"),
        message: t("Databases.Game.ExportNameRequired"),
      });
      return;
    }
    if (!referenceDatabase) {
      return;
    }
    setExportLoading(true);
    try {
      const base = sanitizeDatabaseFilename(title);
      const dir = await getDatabasesDir();
      const destPath = await resolve(dir, `${base}.db3`);
      if (await exists(destPath)) {
        notifications.show({
          color: "red",
          title: t("Common.Error"),
          message: t("Databases.Game.ExportFileExists"),
        });
        return;
      }
      const q = buildBoardLocalExportQuery({ ...localOptions, path: referenceDatabase });
      const n = await export_board_filtered_games(referenceDatabase, q, destPath, title);
      notifications.show({
        color: "green",
        title: t("Databases.Game.ExportSuccessTitle"),
        message: t("Databases.Game.ExportSuccessMessage", { count: n }),
      });
      exportModalHandlers.close();
      setExportName("");
    } catch (e) {
      notifications.show({
        color: "red",
        title: t("Common.Error"),
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExportLoading(false);
    }
  }

  const {
    data: openingData,
    isLoading,
    error,
  } = useSWR(
    tabType !== "options" && !missingExplorerToken ? dbType : null,
    async (dbType: DBType) => {
      return fetchOpening(dbType, tab?.value || "");
    },
  );

  const grandTotal = openingData?.openings?.reduce(
    (acc, curr) => acc + curr.black + curr.white + curr.draw,
    0,
  );

  const header = (
    <>
      <Group justify="space-between" w="100%" wrap="wrap" gap="xs">
        <Group wrap="nowrap">
          <SegmentedControl
            data={[
              { label: t("Board.Database.Local"), value: "local" },
              { label: t("Board.Database.LichessAll"), value: "lch_all" },
              { label: t("Board.Database.LichessMaster"), value: "lch_master" },
            ]}
            value={db}
            onChange={(value) => setDb(value as "local" | "lch_all" | "lch_master")}
          />

          {db === "local" && (
            <Select
              data={dbSelectData}
              value={referenceDatabase}
              onChange={async (value) => {
                await commands.clearGames();
                setReferenceDatabase(value);
              }}
              placeholder={t("Board.Database.SelectReference")}
              size="sm"
              flex={1}
              maw={200}
              allowDeselect={false}
            />
          )}
        </Group>

        <Group gap="xs" wrap="nowrap">
          {db === "local" && referenceDatabase && tabType !== "options" && (
            <Button
              size="compact-sm"
              variant="light"
              leftSection={<IconDatabaseExport size={14} />}
              onClick={() => {
                setExportName("");
                exportModalHandlers.open();
              }}
            >
              {t("Databases.Game.ExportFiltered")}
            </Button>
          )}
          {tabType !== "options" && (
            <Text style={{ whiteSpace: "nowrap" }}>
              {t("Board.Database.Matches", {
                matches: formatNumber(Math.max(grandTotal || 0, openingData?.games.length || 0)),
              })}
            </Text>
          )}
        </Group>
      </Group>
      <DatabaseLoader isLoading={isLoading} tab={tab?.value ?? null} />
    </>
  );

  return (
    <>
      <Modal
        opened={exportModalOpen}
        onClose={exportModalHandlers.close}
        title={t("Databases.Game.ExportModalTitle")}
      >
        <Stack>
          <TextInput
            label={t("Databases.Game.ExportNameLabel")}
            placeholder={t("Databases.Game.ExportNamePlaceholder")}
            value={exportName}
            onChange={(e) => setExportName(e.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={exportModalHandlers.close}>
              {t("Common.Cancel")}
            </Button>
            <Button loading={exportLoading} onClick={() => void onConfirmBoardExport()}>
              {t("Databases.Game.ExportConfirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Stack h="100%" gap={0}>
        <Tabs
          defaultValue="stats"
          orientation="vertical"
          placement="right"
          value={tabType}
          onChange={(v) => setTabType(v!)}
          display="flex"
          flex={1}
          style={{ overflow: "hidden" }}
        >
          <Tabs.List>
            <Tabs.Tab
              value="stats"
              disabled={dbType.type === "local" && dbType.options.type === "partial"}
            >
              {t("Board.Database.Stats")}
            </Tabs.Tab>
            <Tabs.Tab value="games">{t("Board.Database.Games")}</Tabs.Tab>
            <Tabs.Tab value="options">{t("Board.Database.Options")}</Tabs.Tab>
          </Tabs.List>

          <PanelWithError
            value="stats"
            error={error}
            type={db}
            header={header}
            missingExplorerToken={missingExplorerToken}
          >
            <OpeningsTable openings={openingData?.openings || []} loading={isLoading} />
          </PanelWithError>
          <PanelWithError
            value="games"
            error={error}
            type={db}
            header={header}
            missingExplorerToken={missingExplorerToken}
          >
            <GamesTable
              games={openingData?.games || []}
              loading={isLoading}
              databasePath={dbType.type === "local" ? dbType.options.path : null}
            />
          </PanelWithError>
          <PanelWithError
            value="options"
            error={error}
            type={db}
            header={header}
            missingExplorerToken={missingExplorerToken}
          >
            <ScrollArea flex={1} offsetScrollbars pt="sm">
              {match(db)
                .with("local", () => <LocalOptionsPanel boardFen={debouncedFen} />)
                .with("lch_all", () => <LichessOptionsPanel />)
                .with("lch_master", () => <MasterOptionsPanel />)
                .exhaustive()}
            </ScrollArea>
          </PanelWithError>
        </Tabs>
      </Stack>
    </>
  );
}

function PanelWithError(props: {
  value: string;
  error: string;
  type: string;
  header: React.ReactNode;
  children: React.ReactNode;
  missingExplorerToken: boolean;
}) {
  const referenceDatabase = useAtomValue(referenceDbAtom);
  const { t } = useTranslation();
  let children = props.children;
  if (props.type === "local" && !referenceDatabase) {
    children = <NoDatabaseWarning />;
  }
  if (props.missingExplorerToken && props.type !== "local") {
    children = (
      <Alert color="yellow">
        {t("Board.Database.ExplorerAuthRequired1")} <Link to="/accounts">Users</Link>{" "}
        {t("Board.Database.ExplorerAuthRequired2")}
      </Alert>
    );
  }
  if (props.error && props.type !== "local") {
    children = <Alert color="red">{props.error.toString()}</Alert>;
  }

  return (
    <Tabs.Panel
      py="xs"
      px="sm"
      value={props.value}
      flex={1}
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {props.header}
      {children}
    </Tabs.Panel>
  );
}

export default memo(DatabasePanel);
