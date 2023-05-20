import {
  Box,
  Center,
  Flex,
  Grid,
  Text,
  TextInput
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { useEffect, useState } from "react";
import { DatabaseInfo, Player, query_tournaments } from "../../utils/db";
import TournamentCard from "./TournamentCard";
import useStyles from "./styles";

function TournamentTable({ database }: { database: DatabaseInfo }) {
  const file = database.file;
  const [tournaments, setTournaments] = useState<Player[]>([]);
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(25);
  const [activePage, setActivePage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [sort, setSort] = useState<DataTableSortStatus>({
    columnAccessor: "id",
    direction: "asc",
  });

  const { classes } = useStyles();

  useEffect(() => {
    setActivePage(1);
    setSelected(null);
    setLoading(true);
    query_tournaments(file, {
      name: name,
      page: 1,
      pageSize: limit,
      sort: sort.columnAccessor,
      direction: sort.direction,
    }).then((res) => {
      setLoading(false);
      setTournaments(res.data);
      setCount(res.count);
    });
  }, [name, limit, file]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    query_tournaments(file, {
      name: name === "" ? undefined : name,
      page: activePage,
      pageSize: limit,
      sort: sort.columnAccessor,
      direction: sort.direction,
    }).then((res) => {
      setLoading(false);
      setTournaments(res.data);
      setCount(res.count);
    });
  }, [activePage, sort]);

  useHotkeys([
    [
      "ArrowUp",
      () => {
        setSelected((prev) => {
          if (prev === null) {
            return null;
          }
          if (prev === 0) {
            return 0;
          }
          return prev - 1;
        });
      },
    ],
    [
      "ArrowDown",
      () => {
        setSelected((prev) => {
          if (prev === null) {
            return 0;
          }
          if (prev === tournaments.length - 1) {
            return tournaments.length - 1;
          }
          return prev + 1;
        });
      },
    ],
  ]);

  return (
    <Grid my="md" grow>
      <Grid.Col span={3}>
        <Box mb="xl" className={classes.search}>
          <Flex sx={{ alignItems: "center", gap: 10 }}>
            <TextInput
              sx={{ flexGrow: 1 }}
              placeholder="Search tournament..."
              icon={<IconSearch size={16} />}
              value={name}
              onChange={(v) => setName(v.currentTarget.value)}
            />
          </Flex>
        </Box>
        <DataTable
          height={500}
          withBorder
          highlightOnHover
          records={tournaments}
          columns={[
            { accessor: "id", sortable: true },
            { accessor: "name", sortable: true },
          ]}
          rowClassName={(_, i) =>
            i === selected ? classes.selected : ""
          }
          noRecordsText="No tournaments found"
          totalRecords={count}
          recordsPerPage={limit}
          page={activePage}
          onPageChange={setActivePage}
          onRecordsPerPageChange={setLimit}
          sortStatus={sort}
          onSortStatusChange={setSort}
          recordsPerPageOptions={[10, 25, 50]}
          onRowClick={(_, i) => {
            setSelected(i);
          }}
        />
      </Grid.Col>

      <Grid.Col span={2}>
        {selected !== null ? (
          <TournamentCard tournament={tournaments[selected]} file={database.file} />
        ) : (
          <Center h="100%">
            <Text>No tournament selected</Text>
          </Center>
        )}
      </Grid.Col>
    </Grid>
  );
}

export default TournamentTable;
