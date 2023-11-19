import {
  ActionIcon,
  Box,
  Center,
  Collapse,
  Flex,
  Grid,
  Group,
  NumberInput,
  Text,
  TextInput,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconDotsVertical, IconSearch } from "@tabler/icons-react";
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { useEffect, useState } from "react";
import { DatabaseInfo, Player, query_players } from "@/utils/db";
import PlayerCard from "./PlayerCard";
import useStyles from "./styles";

function PlayerTable({ database }: { database: DatabaseInfo }) {
  const file = database.file;
  const [players, setplayers] = useState<Player[]>([]);
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[number, number]>([0, 3000]);
  const [limit, setLimit] = useState(25);
  const [activePage, setActivePage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<DataTableSortStatus>({
    columnAccessor: "id",
    direction: "asc",
  });

  const { classes } = useStyles();

  useEffect(() => {
    setActivePage(1);
    setSelectedPlayer(null);
    setLoading(true);
    query_players(file, {
      name: name,
      range: range,
      page: 1,
      pageSize: limit,
      sort: sort.columnAccessor,
      direction: sort.direction,
    }).then((res) => {
      setLoading(false);
      setplayers(res.data);
      setCount(res.count);
    });
  }, [name, range, limit, file]);

  useEffect(() => {
    setLoading(true);
    setSelectedPlayer(null);
    query_players(file, {
      name: name === "" ? undefined : name,
      range: range,
      page: activePage,
      pageSize: limit,
      sort: sort.columnAccessor,
      direction: sort.direction,
    }).then((res) => {
      setLoading(false);
      setplayers(res.data);
      setCount(res.count);
    });
  }, [activePage, sort]);

  useHotkeys([
    [
      "ArrowUp",
      () => {
        setSelectedPlayer((prev) => {
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
        setSelectedPlayer((prev) => {
          if (prev === null) {
            return 0;
          }
          if (prev === players.length - 1) {
            return players.length - 1;
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
              placeholder="Search player..."
              icon={<IconSearch size="1rem" />}
              value={name}
              onChange={(v) => setName(v.currentTarget.value)}
            />
            <ActionIcon
              sx={{ flexGrow: 0 }}
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
                onChange={(v) => setRange([v || 0, range[1]])}
              />
              <NumberInput
                label="Max ELO"
                value={range[1]}
                min={0}
                max={3000}
                step={100}
                onChange={(v) => setRange([range[0], v || 0])}
              />
            </Group>
          </Collapse>
        </Box>
        <DataTable
          height={500}
          withBorder
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
          onRowClick={(_, i) => {
            setSelectedPlayer(i);
          }}
        />
      </Grid.Col>

      <Grid.Col span={2}>
        {selectedPlayer !== null ? (
          <PlayerCard player={players[selectedPlayer]} file={database.file} />
        ) : (
          <Center h="100%">
            <Text>No player selected</Text>
          </Center>
        )}
      </Grid.Col>
    </Grid>
  );
}

export default PlayerTable;
