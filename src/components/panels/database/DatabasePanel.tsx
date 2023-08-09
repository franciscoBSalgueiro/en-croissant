import { Alert, SegmentedControl, Tabs } from "@mantine/core";
import { memo, useState } from "react";
import { Opening, searchPosition } from "@/utils/db";
import { referenceDbAtom } from "@/atoms/atoms";
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

type DBType =
  | { type: "local"; db: string | null }
  | { type: "lch_all" }
  | { type: "lch_master" };

function sortOpenings(openings: Opening[]) {
  return openings.sort(
    (a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white)
  );
}

async function fetchOpening(fen: string, db: DBType) {
  return match(db)
    .with({ type: "lch_all" }, async () => {
      const data = await getLichessGames(fen);
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
      const data = await getMasterGames(fen);
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
      const positionData = await searchPosition(db, "exact", fen);
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

  const {
    data: openingData,
    isLoading,
    error,
  } = useSWR([debouncedFen, dbType], async ([debouncedFen, dbType]) =>
    fetchOpening(debouncedFen, dbType)
  );

  const [tab, setTab] = useState<string | null>("stats");

  return (
    <>
      <SegmentedControl
        data={[
          { label: "Local", value: "local" },
          {
            label: "Lichess All",
            value: "lch_all",
            disabled: tab === "search",
          },
          {
            label: "Lichess Masters",
            value: "lch_master",
            disabled: tab === "search",
          },
        ]}
        value={db}
        onChange={(value) => setDb(value as "local" | "lch_all" | "lch_master")}
      />
      <Tabs
        defaultValue="stats"
        orientation="vertical"
        placement="right"
        keepMounted={false}
        value={tab}
        onTabChange={setTab}
      >
        <Tabs.List>
          <Tabs.Tab value="stats">Stats</Tabs.Tab>
          <Tabs.Tab value="games">Games</Tabs.Tab>
          <Tabs.Tab value="search" disabled={db !== "local"}>
            Search
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
        <PanelWithError value="search" error={error} db={db}>
          <SearchPanel />
        </PanelWithError>
      </Tabs>
    </>
  );
}

function PanelWithError(props: {
  value: string;
  error: any;
  db: "local" | string;
  children: React.ReactNode;
}) {
  let children = props.children;
  if (props.error) {
    if (props.db === "local") children = <NoDatabaseWarning />;
    else children = <Alert color="red">{props.error.toString()}</Alert>;
  }

  return (
    <Tabs.Panel pt="xs" mr="xs" value={props.value}>
      {children}
    </Tabs.Panel>
  );
}

export default memo(DatabasePanel);
