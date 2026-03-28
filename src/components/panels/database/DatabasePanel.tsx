import {
  Alert,
  Group,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Link } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr/immutable";
import { parseUci } from "chessops";
import { makeSan } from "chessops/san";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { commands } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  currentMaiaDbEngineAtom,
  currentDbTabAtom,
  currentDbTypeAtom,
  currentLocalOptionsAtom,
  currentTabAtom,
  enginesAtom,
  lichessOptionsAtom,
  masterOptionsAtom,
  referenceDbAtom,
  sessionsAtom,
} from "@/state/atoms";
import { getDatabases, type Opening, searchPosition } from "@/utils/db";
import { positionFromFen } from "@/utils/chessops";
import { isLocalEngine, isMaiaEngine } from "@/utils/engines";
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
    }
  | {
      type: "maia";
      modelPath: string;
      engineId: string;
      elo: number;
      fen: string;
      tab: string;
    };

export type LocalOptions = {
  path: string | null;
  fen: string;
  type: "exact" | "partial";
  player: number | null;
  color: "white" | "black";
  start_date?: string;
  end_date?: string;
  result: "any" | "whitewon" | "draw" | "blackwon";
};

function sortOpenings(openings: Opening[]) {
  return openings.sort((a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white));
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
    .with({ type: "maia" }, async ({ modelPath, engineId, elo, fen, tab }) => {
      const evalResult = await commands.maiaEval(engineId, modelPath, tab, fen, [], elo);
      if (evalResult.status === "error") {
        throw new Error(evalResult.error);
      }
      const [pos] = positionFromFen(fen);
      if (!pos) {
        return { openings: [], games: [] };
      }
      const policy = evalResult.data.policy.filter((move) => move.probability > 0.005);
      const batchedEval = await commands.maiaEvalBatch(
        engineId,
        modelPath,
        tab,
        policy.map((move) => ({
          fen,
          moves: [move.uci],
        })),
        elo,
      );
      if (batchedEval.status === "error") {
        throw new Error(batchedEval.error);
      }
      const openings = policy
        .map((move, index) => {
          const parsedMove = parseUci(move.uci);
          if (!parsedMove) {
            return null;
          }
          const san = makeSan(pos.clone(), parsedMove);
          const moveEval = batchedEval.data[index] ?? evalResult.data;
          const total = Math.round(move.probability * 1000);
          const white = Math.round(total * moveEval.white_wr);
          const draw = Math.round(total * moveEval.draw);
          const black = Math.max(0, total - white - draw);
          return {
            move: san,
            white,
            draw,
            black,
          };
        })
        .filter((entry): entry is Opening => entry !== null);
      return {
        openings,
        games: [],
      };
    })
    .exhaustive();
}

function DatabasePanel() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const [referenceDatabase, setReferenceDatabase] = useAtom(referenceDbAtom);
  const engines = useAtomValue(enginesAtom);
  const sessions = useAtomValue(sessionsAtom);
  const [debouncedFen] = useDebouncedValue(fen, 50);
  const [lichessOptions, setLichessOptions] = useAtom(lichessOptionsAtom);
  const [masterOptions, setMasterOptions] = useAtom(masterOptionsAtom);
  const [localOptions, setLocalOptions] = useAtom(currentLocalOptionsAtom);
  const [maiaEngineId, setMaiaEngineId] = useAtom(currentMaiaDbEngineAtom);
  const [db, setDb] = useAtom(currentDbTypeAtom);
  const maiaEngines = (engines ?? [])
    .filter(isLocalEngine)
    .filter(isMaiaEngine)
    .filter((engine) => engine.showInDatabase !== false);
  const selectedMaiaEngine = maiaEngines.find((engine) => engine.id === maiaEngineId) ?? maiaEngines[0];
  const explorerToken = sessions.find((session) => session.lichess?.accessToken)?.lichess
    ?.accessToken;
  const missingExplorerToken = (db === "lch_all" || db === "lch_master") && !explorerToken;
  const canRunMaia = db !== "maia" || !!selectedMaiaEngine;

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

  useEffect(() => {
    if (!selectedMaiaEngine || maiaEngineId === selectedMaiaEngine.id) {
      return;
    }
    setMaiaEngineId(selectedMaiaEngine.id);
  }, [maiaEngineId, selectedMaiaEngine, setMaiaEngineId]);

  const tab = useAtomValue(currentTabAtom);

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
    .with("maia", () => ({
      type: "maia" as const,
      modelPath: selectedMaiaEngine?.path ?? "",
      engineId: selectedMaiaEngine?.id ?? "",
      elo: selectedMaiaEngine?.elo ?? 1500,
      fen: debouncedFen,
      tab: tab?.value || "",
    }))
    .exhaustive();
  const [tabType, setTabType] = useAtom(currentDbTabAtom);

  const {
    data: openingData,
    isLoading,
    error,
  } = useSWR(
    tabType !== "options" && !missingExplorerToken && canRunMaia ? dbType : null,
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
      <Group justify="space-between" w="100%" wrap="nowrap">
        <Group>
          <SegmentedControl
            data={[
              { label: t("Board.Database.Local"), value: "local" },
              { label: t("Board.Database.LichessAll"), value: "lch_all" },
              { label: t("Board.Database.LichessMaster"), value: "lch_master" },
              { label: t("Board.Database.Maia"), value: "maia" },
            ]}
            value={db}
            onChange={(value) => setDb(value as "local" | "lch_all" | "lch_master" | "maia")}
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
          {db === "maia" && (
            <Select
              data={maiaEngines.map((engine) => ({ value: engine.id, label: engine.name }))}
              value={selectedMaiaEngine?.id ?? null}
              onChange={(value) => {
                setMaiaEngineId(value);
              }}
              placeholder={t("Board.Database.SelectMaia")}
              size="sm"
              flex={1}
              maw={220}
              allowDeselect={false}
            />
          )}
        </Group>

        {tabType !== "options" && db !== "maia" && (
          <Text style={{ whiteSpace: "nowrap" }}>
            {t("Board.Database.Matches", {
              matches: formatNumber(Math.max(grandTotal || 0, openingData?.games.length || 0)),
            })}
          </Text>
        )}
      </Group>
      <DatabaseLoader isLoading={isLoading} tab={tab?.value ?? null} />
    </>
  );

  return (
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
            disabled={
              (dbType.type === "local" && dbType.options.type === "partial") ||
              (dbType.type === "maia" && !selectedMaiaEngine)
            }
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
          <OpeningsTable
            openings={openingData?.openings || []}
            loading={isLoading}
            showTotalRow={db !== "maia"}
            showMoveCounts={db !== "maia"}
          />
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
              .with("maia", () => (
                <Alert color="blue">{t("Board.Database.Maia.OptionsHint")}</Alert>
              ))
              .exhaustive()}
          </ScrollArea>
        </PanelWithError>
      </Tabs>
    </Stack>
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
