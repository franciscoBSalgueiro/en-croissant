import { type Event, type TournamentSort, commands } from "@/bindings";
import { unwrap } from "@/utils/unwrap";
import { Center, Flex, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { DataTable } from "mantine-datatable";
import { useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import useSWR from "swr";
import { useStore } from "zustand";
import { DatabaseViewStateContext } from "./DatabaseViewStateContext";
import GridLayout from "./GridLayout";
import TournamentCard from "./TournamentCard";
import * as classes from "./styles.css";

function TournamentTable() {
  const store = useContext(DatabaseViewStateContext)!;

  const file = useStore(store, (s) => s.database?.file)!;
  const query = useStore(store, (s) => s.tournaments.query);
  const selected = useStore(store, (s) => s.tournaments.selectedTournamet);
  const setQuery = useStore(store, (s) => s.setTournamentsQuery);
  const setSelected = useStore(store, (s) => s.setTournamentsSelectedTournamet);

  const { data, isLoading } = useSWR(["tournaments", query], () =>
    commands.getTournaments(file, query).then(unwrap),
  );
  const tournaments = data?.data ?? [];
  const count = data?.count;
  const tournament = tournaments.find((t) => t.id === selected);

  useHotkeys("ArrowUp", () => {
    if (selected != null) {
      const prevIndex = tournaments.findIndex((p) => p.id === selected) - 1;
      if (prevIndex > -1) {
        setSelected(tournaments[prevIndex].id);
      }
    }
  });
  useHotkeys("ArrowDown", () => {
    const curIndex = tournaments.findIndex((p) => p.id === selected);
    if (curIndex > -1) {
      const nextIndex = curIndex + 1;

      if (nextIndex < (count ?? 0)) {
        setSelected(tournaments[nextIndex].id);
      }
    }
  });

  return (
    <GridLayout
      search={
        <Flex style={{ alignItems: "center", gap: 10 }}>
          <TextInput
            style={{ flexGrow: 1 }}
            placeholder="Search tournament..."
            leftSection={<IconSearch size="1rem" />}
            value={query.name ?? ""}
            onChange={(v) =>
              setQuery({
                ...query,
                name: v.currentTarget.value,
              })
            }
          />
        </Flex>
      }
      table={
        <DataTable<Event>
          withTableBorder
          highlightOnHover
          records={tournaments}
          fetching={isLoading}
          columns={[
            { accessor: "id", sortable: true },
            { accessor: "name", sortable: true },
          ]}
          rowClassName={(t) => (t.id === selected ? classes.selected : "")}
          noRecordsText="No tournaments found"
          totalRecords={count!}
          recordsPerPage={query.options.pageSize ?? 25}
          page={query.options.page ?? 1}
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
                sort: value.columnAccessor as TournamentSort,
                direction: value.direction,
              },
            })
          }
          recordsPerPageOptions={[10, 25, 50]}
          onRowClick={({ index }) => {
            setSelected(tournaments[index].id);
          }}
        />
      }
      preview={
        tournament != null ? (
          <TournamentCard
            tournament={tournament}
            file={file}
            key={tournament.id}
          />
        ) : (
          <Center h="100%">
            <Text>No tournament selected</Text>
          </Center>
        )
      }
    />
  );
}

export default TournamentTable;
