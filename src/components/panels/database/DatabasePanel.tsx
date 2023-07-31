import { SegmentedControl, Tabs } from "@mantine/core";
import { memo, startTransition, useState } from "react";
import { NormalizedGame, Opening, searchPosition } from "@/utils/db";
import { useThrottledEffect } from "@/utils/misc";
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

function sortOpenings(openings: Opening[]) {
  return openings.sort(
    (a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white)
  );
}

function DatabasePanel({ height, fen }: { height: number; fen: string }) {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [games, setGames] = useState<NormalizedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const referenceDatabase = useAtomValue(referenceDbAtom);
  const [db, setDb] = useState<"local" | "lch_all" | "lch_master">("local");

  useThrottledEffect(
    async () => {
      if (!referenceDatabase) return;
      let ignore = false;
      let openings: Opening[] = [];
      let games: NormalizedGame[] = [];

      setLoading(true);

      if (db === "lch_all") {
        const data = await getLichessGames(fen);
        openings = data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        }));
        games = await convertToNormalized(data.topGames);
      } else if (db === "lch_master") {
        const data = await getMasterGames(fen);
        openings = data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        }));
        games = await convertToNormalized(data.topGames);
      } else if (db === "local") {
        const positionData = await searchPosition(
          referenceDatabase,
          "exact",
          fen
        );
        openings = sortOpenings(positionData[0]);
        games = positionData[1];
      }

      if (!ignore) {
        startTransition(() => {
          setOpenings(openings);
          setGames(games);
          setLoading(false);
        });
      }

      return () => {
        ignore = true;
      };
    },
    50,
    [referenceDatabase, fen, db]
  );

  return (
    <>
      <SegmentedControl
        data={[
          { label: "Local", value: "local" },
          { label: "Lichess All", value: "lch_all" },
          { label: "Lichess Masters", value: "lch_master" },
        ]}
        value={db}
        onChange={(value) => setDb(value as "local" | "lch_all" | "lch_master")}
      />
      <Tabs
        defaultValue="stats"
        orientation="vertical"
        placement="right"
        keepMounted={false}
      >
        <Tabs.List>
          <Tabs.Tab value="stats">Stats</Tabs.Tab>
          <Tabs.Tab value="games">Games</Tabs.Tab>
          <Tabs.Tab value="search" disabled={db !== "local"}>
            Search
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="stats" pt="xs" mr="xs">
          <OpeningsTable
            openings={openings}
            height={height}
            loading={loading}
            referenceDatabase={referenceDatabase}
          />
        </Tabs.Panel>
        <Tabs.Panel value="games" pt="xs" mr="xs">
          <GamesTable games={games} height={height} loading={loading} />
        </Tabs.Panel>
        <Tabs.Panel value="search" pt="xs" mr="xs">
          <SearchPanel />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

export default memo(DatabasePanel);
