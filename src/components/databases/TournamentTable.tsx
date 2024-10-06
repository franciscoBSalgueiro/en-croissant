import {
  type DatabaseInfo,
  type Event,
  type TournamentSort,
  commands,
} from "@/bindings";
import { unwrap } from "@/utils/unwrap";
import { Center, Flex, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import GridLayout from "./GridLayout";
import TournamentCard from "./TournamentCard";
import * as classes from "./styles.css";

function TournamentTable({ database }: { database: DatabaseInfo }) {
  const file = database.file;
  const [tournaments, setTournaments] = useState<Event[]>([]);
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(25);
  const [activePage, setActivePage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [sort, setSort] = useState<DataTableSortStatus<Event>>({
    columnAccessor: "id",
    direction: "asc",
  });

  useEffect(() => {
    setActivePage(1);
    setSelected(null);
    setLoading(true);
    commands
      .getTournaments(file, {
        name: name,
        options: {
          page: 1,
          pageSize: limit,
          skipCount: false,
          sort: sort.columnAccessor as TournamentSort,
          direction: sort.direction,
        },
      })
      .then((res) => {
        const { data, count } = unwrap(res);
        setLoading(false);
        setTournaments(data);
        setCount(count!);
      });
  }, [name, limit, file]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    commands
      .getTournaments(file, {
        name: name === "" ? null : name,
        options: {
          page: activePage,
          pageSize: limit,
          skipCount: false,
          sort: sort.columnAccessor as TournamentSort,
          direction: sort.direction,
        },
      })
      .then((res) => {
        const { data, count } = unwrap(res);
        setLoading(false);
        setTournaments(data);
        setCount(count!);
      });
  }, [activePage, sort]);

  useHotkeys("ArrowUp", () => {
    setSelected((prev) => {
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
    setSelected((prev) => {
      if (prev === null) {
        return 0;
      }
      if (prev === tournaments.length - 1) {
        return tournaments.length - 1;
      }
      return prev + 1;
    });
  });

  return (
    <GridLayout
      search={
        <Flex style={{ alignItems: "center", gap: 10 }}>
          <TextInput
            style={{ flexGrow: 1 }}
            placeholder="Search tournament..."
            leftSection={<IconSearch size="1rem" />}
            value={name}
            onChange={(v) => setName(v.currentTarget.value)}
          />
        </Flex>
      }
      table={
        <DataTable<Event>
          withTableBorder
          highlightOnHover
          records={tournaments}
          fetching={loading}
          columns={[
            { accessor: "id", sortable: true },
            { accessor: "name", sortable: true },
          ]}
          rowClassName={(_, i) => (i === selected ? classes.selected : "")}
          noRecordsText="No tournaments found"
          totalRecords={count}
          recordsPerPage={limit}
          page={activePage}
          onPageChange={setActivePage}
          onRecordsPerPageChange={setLimit}
          sortStatus={sort}
          onSortStatusChange={setSort}
          recordsPerPageOptions={[10, 25, 50]}
          onRowClick={({ index }) => {
            setSelected(index);
          }}
        />
      }
      preview={
        selected !== null && tournaments[selected] ? (
          <TournamentCard
            tournament={tournaments[selected]}
            file={database.file}
            key={tournaments[selected].id}
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
