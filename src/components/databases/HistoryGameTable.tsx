import type { NormalizedGame } from "@/bindings";
import { activeTabAtom, historyAtom, tabsAtom } from "@/state/atoms";
import { createTab } from "@/utils/tabs";
import { Center, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo, useMemo, useState } from "react";
import GameCard from "./GameCard";
import GridLayout from "./GridLayout";

function HistoryGameTable() {
  const history = useAtomValue(historyAtom);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useAtomValue(activeTabAtom);
  const navigate = useNavigate();

  const games: NormalizedGame[] = useMemo(() => {
    return (history || []).map((h, i) => ({
      id: i,
      fen: "",
      event: "Botvinnik",
      event_id: 0 as any,
      site: "",
      site_id: 0 as any,
      date: h.date || undefined,
      time: h.time || undefined,
      round: null as any,
      white: h.white,
      white_id: 0 as any,
      white_elo: (h.whiteElo as any) ?? null,
      black: h.black,
      black_id: 0 as any,
      black_elo: (h.blackElo as any) ?? null,
      result: (h.result as any) || "*",
      time_control: null as any,
      eco: null as any,
      ply_count: (h.moves as any) ?? null,
      moves: h.pgn,
    })) as any;
  }, [history]);

  return (
    <GridLayout
      search={<div />}
      table={
        <DataTable<NormalizedGame>
          withTableBorder
          highlightOnHover
          records={games}
          columns={[
            { accessor: "white", render: ({ white, white_elo }) => (
              <div>
                <Text size="sm" fw={500}>{white}</Text>
                <Text size="xs" c="dimmed">{white_elo ?? ""}</Text>
              </div>
            ) },
            { accessor: "black", render: ({ black, black_elo }) => (
              <div>
                <Text size="sm" fw={500}>{black}</Text>
                <Text size="xs" c="dimmed">{black_elo ?? ""}</Text>
              </div>
            ) },
            { accessor: "date" },
            { accessor: "result", render: ({ result }) => (result?.replaceAll("1/2", "½") as any) },
            { accessor: "ply_count", title: "Plies" },
          ]}
          noRecordsText="No games found"
          onRowDoubleClick={({ record }) => {
            createTab({
              tab: { name: `${record.white} - ${record.black}`, type: "analysis" },
              setTabs,
              setActiveTab: (setActiveTab as any),
              pgn: record.moves,
              headers: record as any,
            });
            navigate({ to: "/" });
          }}
          onRowClick={({ index }) => setSelectedGame(index)}
        />
      }
      preview={
        selectedGame !== null && games[selectedGame] ? (
          <GameCard game={games[selectedGame]} file={"history:botvinnik"} mutate={() => {}} />
        ) : (
          <Center h="100%"><Text>No game selected</Text></Center>
        )
      }
    />
  );
}

export default memo(HistoryGameTable);


