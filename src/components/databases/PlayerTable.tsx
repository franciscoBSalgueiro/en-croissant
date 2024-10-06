import type { Player, PlayerSort } from "@/bindings";
import { type SuccessDatabaseInfo, query_players } from "@/utils/db";
import {
  ActionIcon,
  Center,
  Collapse,
  Flex,
  Group,
  NumberInput,
  Text,
  TextInput,
} from "@mantine/core";
import { IconDotsVertical, IconSearch } from "@tabler/icons-react";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import GridLayout from "./GridLayout";
import PlayerCard from "./PlayerCard";
import * as classes from "./styles.css";

function PlayerTable({ database }: { database: SuccessDatabaseInfo }) {
  const file = database.file;
  const [players, setPlayers] = useState<Player[]>([]);
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[number, number]>([0, 3000]);
  const [limit, setLimit] = useState(25);
  const [activePage, setActivePage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<DataTableSortStatus<Player>>({
    columnAccessor: "id",
    direction: "asc",
  });

  useEffect(() => {
    setActivePage(1);
    setSelectedPlayer(null);
    setLoading(true);
    query_players(file, {
      name: name,
      range: range,
      options: {
        page: 1,
        pageSize: limit,
        sort: sort.columnAccessor as PlayerSort,
        direction: sort.direction,
        skipCount: false,
      },
    }).then((res) => {
      setLoading(false);
      setPlayers(res.data);
      setCount(res.count!);
    });
  }, [name, range, limit, file]);

  useEffect(() => {
    setLoading(true);
    setSelectedPlayer(null);
    query_players(file, {
      name: name === "" ? undefined : name,
      range: range,
      options: {
        page: activePage,
        pageSize: limit,
        sort: sort.columnAccessor as PlayerSort,
        direction: sort.direction,
        skipCount: false,
      },
    }).then((res) => {
      setLoading(false);
      setPlayers(res.data);
      setCount(res.count!);
    });
  }, [activePage, sort]);

  useHotkeys("ArrowUp", () => {
    setSelectedPlayer((prev) => {
      if (prev === null) {
        return null;
      }
      if (prev === 0) {
        return 0;
      }
      return prev - 1;
    });
  });
  useHotkeys("ArrowDown", () => {
    setSelectedPlayer((prev) => {
      if (prev === null) {
        return 0;
      }
      if (prev === players.length - 1) {
        return players.length - 1;
      }
      return prev + 1;
    });
  });

  return (
    <GridLayout
      search={
        <>
          <Flex style={{ alignItems: "center", gap: 10 }}>
            <TextInput
              style={{ flexGrow: 1 }}
              placeholder="Search player..."
              leftSection={<IconSearch size="1rem" />}
              value={name}
              onChange={(v) => setName(v.currentTarget.value)}
            />
            <ActionIcon
              style={{ flexGrow: 0 }}
              onClick={() => setOpen((prev) => !prev)}
            >
              <IconDotsVertical size="1rem" />
            </ActionIcon>
          </Flex>
          <Collapse in={open}>
            <Group mt="md">
              <NumberInput
                label="Min ELO"
                value={range[0]}
                min={0}
                max={3000}
                step={100}
                onChange={(v) => setRange([(v || 0) as number, range[1]])}
              />
              <NumberInput
                label="Max ELO"
                value={range[1]}
                min={0}
                max={3000}
                step={100}
                onChange={(v) => setRange([range[0], (v || 0) as number])}
              />
            </Group>
          </Collapse>
        </>
      }
      table={
        <DataTable<Player>
          withTableBorder
          highlightOnHover
          records={players}
          fetching={loading}
          columns={[
            { accessor: "id", sortable: true },
            { accessor: "name", sortable: true },
            { accessor: "elo", sortable: true },
          ]}
          rowClassName={(_, i) =>
            i === selectedPlayer ? classes.selected : ""
          }
          noRecordsText="No players found"
          totalRecords={count}
          recordsPerPage={limit}
          page={activePage}
          onPageChange={setActivePage}
          onRecordsPerPageChange={setLimit}
          sortStatus={sort}
          onSortStatusChange={setSort}
          recordsPerPageOptions={[10, 25, 50]}
          onRowClick={({ index }) => {
            setSelectedPlayer(index);
          }}
        />
      }
      preview={
        selectedPlayer !== null && players[selectedPlayer] ? (
          <PlayerCard player={players[selectedPlayer]} file={database.file} />
        ) : (
          <Center h="100%">
            <Text>No player selected</Text>
          </Center>
        )
      }
    />
  );
}

export default PlayerTable;
