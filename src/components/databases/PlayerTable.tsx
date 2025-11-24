import type { Player, PlayerSort } from "@/bindings";
import { query_players } from "@/utils/db";
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
import { DataTable } from "mantine-datatable";
import { useContext, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import useSWR from "swr";
import { useStore } from "zustand";
import { DatabaseViewStateContext } from "./DatabaseViewStateContext";
import GridLayout from "./GridLayout";
import PlayerCard from "./PlayerCard";
import * as classes from "./styles.css";

function PlayerTable() {
  const store = useContext(DatabaseViewStateContext)!;

  const file = useStore(store, (s) => s.database?.file)!;
  const query = useStore(store, (s) => s.players.query);
  const setQuery = useStore(store, (s) => s.setPlayersQuery);

  const selectedPlayer = useStore(store, (s) => s.players.selectedPlayer);
  const setSelectedPlayer = useStore(store, (s) => s.setPlayersSelectedPlayer);

  const { data, isLoading } = useSWR(["players", query], () =>
    query_players(file, query),
  );
  const players = data?.data ?? [];
  const count = data?.count;
  const player = players.find((p) => p.id === selectedPlayer);

  const [open, setOpen] = useState(false);

  useHotkeys("ArrowUp", () => {
    if (selectedPlayer != null) {
      const prevIndex = players.findIndex((p) => p.id === selectedPlayer) - 1;
      if (prevIndex > -1) {
        setSelectedPlayer(players[prevIndex].id);
      }
    }
  });
  useHotkeys("ArrowDown", () => {
    const curIndex = players.findIndex((p) => p.id === selectedPlayer);
    if (curIndex > -1) {
      const nextIndex = curIndex + 1;

      if (nextIndex < (count ?? 0)) {
        setSelectedPlayer(players[nextIndex].id);
      }
    }
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
              value={query.name ?? undefined}
              onChange={(e) =>
                setQuery({
                  ...query,
                  name: e.currentTarget.value,
                  options: {
                    ...query.options,
                    page: 1,
                  },
                })
              }
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
                value={query.range?.[0]}
                onChange={(v) =>
                  setQuery({
                    ...query,
                    range: [(v || 0) as number, query.range?.[1] ?? 3000],
                  })
                }
                min={0}
                max={3000}
                step={100}
              />
              <NumberInput
                label="Max ELO"
                value={query.range?.[1]}
                min={0}
                max={3000}
                step={100}
                onChange={(v) =>
                  setQuery({
                    ...query,
                    range: [query.range?.[0] ?? 0, (v || 3000) as number],
                  })
                }
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
          fetching={isLoading}
          columns={[
            { accessor: "id", sortable: true },
            { accessor: "name", sortable: true },
            { accessor: "elo", sortable: true },
          ]}
          rowClassName={(r) =>
            r.id === selectedPlayer ? classes.selected : ""
          }
          noRecordsText="No players found"
          totalRecords={count!}
          recordsPerPage={query.options.pageSize ?? 25}
          page={query.options?.page ?? 1}
          onPageChange={(page) =>
            setQuery({
              ...query,
              options: {
                ...query.options!,
                page,
              },
            })
          }
          onRecordsPerPageChange={(value) =>
            setQuery({
              ...query,
              options: { ...query.options!, pageSize: value },
            })
          }
          sortStatus={{
            columnAccessor: query.options?.sort || "name",
            direction: query.options?.direction || "desc",
          }}
          onSortStatusChange={(value) =>
            setQuery({
              ...query,
              options: {
                ...query.options!,
                sort: value.columnAccessor as PlayerSort,
                direction: value.direction,
              },
            })
          }
          recordsPerPageOptions={[10, 25, 50]}
          onRowClick={({ index }) => {
            setSelectedPlayer(players[index].id);
          }}
        />
      }
      preview={
        player != null ? (
          <PlayerCard player={player} file={file} />
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
