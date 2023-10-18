import { Alert, Group, SegmentedControl, Tabs, Text } from "@mantine/core";
import { memo, useState } from "react";
import { Opening, PositionQuery, searchPosition } from "@/utils/db";
import { currentTabAtom, referenceDbAtom } from "@/atoms/atoms";
import { useAtomValue } from "jotai";
import {
  convertToNormalized,
  getLichessGames,
  getMasterGames,
} from "@/utils/lichess";
import GamesTable from "./GamesTable";
import OpeningsTable from "./OpeningsTable";
import SearchPanel from "./SearchPanel";
import { match } from "ts-pattern";
import useSWR from "swr";
import { useDebouncedValue } from "@mantine/hooks";
import NoDatabaseWarning from "./NoDatabaseWarning";
import { formatNumber } from "@/utils/format";
import DatabaseLoader from "./DatabaseLoader";
import { LichessGamesOptions, MasterGamesOptions } from "@/utils/lichess/lichessexplorer";
import LichessOptionsPanel from "./options/LichessOptionsPanel";
import MasterOptionsPanel from "./options/MastersOptionsPanel";

type DBType =
  | { type: "local"; db: string | null }
  | { type: "lch_all" }
  | { type: "lch_master" };

function sortOpenings(openings: Opening[]) {
  return openings.sort(
    (a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white)
  );
}

async function fetchOpening(query: PositionQuery, db: DBType, tab: string, lichessOptions: LichessGamesOptions, masterOptions: MasterGamesOptions) {
  return match(db)
    .with({ type: "lch_all" }, async () => {
      const data = await getLichessGames(query.value, lichessOptions);
      return {
        openings: data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        })),
        games: await convertToNormalized(data.topGames),
      };
    })
    .with({ type: "lch_master" }, async () => {
      const data = await getMasterGames(query.value, masterOptions);
      return {
        openings: data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        })),
        games: await convertToNormalized(data.topGames),
      };
    })
    .with({ type: "local" }, async ({ db }) => {
      if (!db) throw Error("Missing reference database");
      const positionData = await searchPosition(db, query, tab);
      return {
        openings: sortOpenings(positionData[0]),
        games: positionData[1],
      };
    })
    .exhaustive();
}

function DatabasePanel({ height, fen }: { height: number; fen: string }) {
  const referenceDatabase = useAtomValue(referenceDbAtom);
  const [db, setDb] = useState<"local" | "lch_all" | "lch_master">("local");
  const [lichessOptions, setLichessOptions] = useState<LichessGamesOptions>({});
  const [masterOptions, setMasterOptions] = useState<MasterGamesOptions>({});
  const [debouncedFen] = useDebouncedValue(fen, 50);

  const dbType: DBType = match(db)
    .with("local", (v) => {
      return {
        type: v,
        db: referenceDatabase,
      };
    })
    .otherwise((v) => ({
      type: v,
    }));

  const [query, setQuery] = useState<PositionQuery>({
    value: fen,
    type: "exact",
  });

  const tab = useAtomValue(currentTabAtom);
  const {
    data: openingData,
    isLoading,
    error,
  } = useSWR([dbType, query], async ([dbType, query]) => {
    return fetchOpening(query, dbType, tab?.value || "", lichessOptions, masterOptions);
  });

  const [tabType, setTabType] = useState<string | null>("stats");
  const grandTotal = openingData?.openings?.reduce(
    (acc, curr) => acc + curr.black + curr.white + curr.draw,
    0
  );

  return (
    <>
      <Group position="apart">
        <SegmentedControl
          data={[
            { label: "Local", value: "local" },
            { label: "Lichess All", value: "lch_all" },
            { label: "Lichess Masters", value: "lch_master" },
          ]}
          value={db}
          onChange={(value) =>
            setDb(value as "local" | "lch_all" | "lch_master")
          }
        />
        <Text>
          {formatNumber(
            Math.max(grandTotal || 0, openingData?.games.length || 0)
          )}{" "}
          matches
        </Text>
      </Group>

      <DatabaseLoader isLoading={isLoading} tab={tab?.value ?? null} />

      <Tabs
        defaultValue="stats"
        orientation="vertical"
        placement="right"
        value={tabType}
        onTabChange={setTabType}
      >
        <Tabs.List>
          <Tabs.Tab value="stats" disabled={query.type === "partial"}>
            Stats
          </Tabs.Tab>
          <Tabs.Tab value="games">Games</Tabs.Tab>
          <Tabs.Tab value="options">
            Options
          </Tabs.Tab>
        </Tabs.List>

        <PanelWithError value="stats" error={error} db={db}>
          <OpeningsTable
            openings={openingData?.openings || []}
            height={height}
            loading={isLoading}
          />
        </PanelWithError>
        <PanelWithError value="games" error={error} db={db}>
          <GamesTable
            games={openingData?.games || []}
            height={height}
            loading={isLoading}
          />
        </PanelWithError>
        <PanelWithError value="options" error={error} db={db}>
          {match(db)
            .with("local", () => 
              <SearchPanel
                boardFen={debouncedFen}
                query={query}
                setQuery={setQuery}
              />
            ).with("lch_all", () =>
              <LichessOptionsPanel
                options={lichessOptions}
                setOptions={setLichessOptions}
              />
            ).with("lch_master", () =>
              <MasterOptionsPanel
                options={masterOptions}
                setOptions={setMasterOptions}
              />
            ).run()
          }
        </PanelWithError>
      </Tabs>
    </>
  );
}

function PanelWithError(props: {
  value: string;
  error: string;
  db: "local" | string;
  children: React.ReactNode;
}) {
  const referenceDatabase = useAtomValue(referenceDbAtom);
  let children = props.children;
  if (props.db === "local" && !referenceDatabase) {
    children = <NoDatabaseWarning />;
  }
  if (props.error && props.db !== "local") {
    children = <Alert color="red">{props.error.toString()}</Alert>;
  }

  return (
    <Tabs.Panel pt="xs" mr="xs" value={props.value}>
      {children}
    </Tabs.Panel>
  );
}

export default memo(DatabasePanel);
