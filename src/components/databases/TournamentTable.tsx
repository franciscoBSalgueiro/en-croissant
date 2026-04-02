import { Center, Flex, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { DataTable } from "mantine-datatable";
import { useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useStore } from "zustand";
import { commands, type Event, type TournamentSort } from "@/bindings";
import { unwrap } from "@/utils/unwrap";
import { DatabaseViewStateContext } from "./DatabaseViewStateContext";
import GridLayout from "./GridLayout";
import classes from "./styles.module.css";
import TournamentCard from "./TournamentCard";

function TournamentTable() {
  const { t } = useTranslation();
  const store = useContext(DatabaseViewStateContext)!;

  const file = useStore(store, (s) => s.database?.file)!;
  const query = useStore(store, (s) => s.tournaments.query);
  const selected = useStore(store, (s) => s.tournaments.selectedTournamet);
  const setQuery = useStore(store, (s) => s.setTournamentsQuery);
  const setSelected = useStore(store, (s) => s.setTournamentsSelectedTournamet);

  const { data, error, isLoading } = useSWR(["tournaments", file, query], () =>
    commands.getTournaments(file, query).then(unwrap),
  );
  const tournaments = data?.data ?? [];
  const count = data?.count;
  const tournament = tournaments.find((t) => t.name === selected);

  useHotkeys("ArrowUp", () => {
    if (selected != null) {
      const prevIndex = tournaments.findIndex((p) => p.name === selected) - 1;
      if (prevIndex > -1) {
        setSelected(tournaments[prevIndex].name ?? undefined);
      }
    }
  });
  useHotkeys("ArrowDown", () => {
    const curIndex = tournaments.findIndex((p) => p.name === selected);
    if (curIndex > -1) {
      const nextIndex = curIndex + 1;

      if (nextIndex < (count ?? 0)) {
        setSelected(tournaments[nextIndex].name ?? undefined);
      }
    }
  });

  return (
    <GridLayout
      search={
        <Flex style={{ alignItems: "center", gap: 10 }}>
          <TextInput
            style={{ flexGrow: 1 }}
            placeholder={t("Common.Search")}
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
          columns={[{ accessor: "name", sortable: true }]}
          rowClassName={(t) => (t.name === selected ? classes.selected : "")}
          noRecordsText={
            error
              ? `${t("Common.Error")}: ${error instanceof Error ? error.message : String(error)}`
              : t("Databases.Tournament.NoneFound")
          }
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
            setSelected(tournaments[index].name ?? undefined);
          }}
        />
      }
      preview={
        tournament != null ? (
          <TournamentCard tournament={tournament} file={file} key={tournament.name} />
        ) : (
          <Center h="100%">
            <Text>{t("Databases.Tournament.NoSelection")}</Text>
          </Center>
        )
      }
    />
  );
}

export default TournamentTable;
