import {
  ActionIcon,
  Box,
  Card,
  Center,
  Collapse,
  createStyles,
  Flex,
  Grid,
  Group,
  NumberInput,
  Text,
  TextInput
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconDotsVertical, IconSearch } from "@tabler/icons-react";
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { useEffect, useState } from "react";
import { Database, Player, query_players } from "../../utils/db";
import PlayerCard from "./PlayerCard";

const useStyles = createStyles((theme) => ({
  selected: {
    backgroundColor: `${
      theme.colorScheme === "dark"
        ? theme.fn.rgba(theme.colors[theme.primaryColor][7], 0.3)
        : theme.colors[theme.primaryColor][0]
    } !important`,
  },
}));

function PlayerTable({ database }: { database: Database }) {
  const file = database.file;
  const [players, setplayers] = useState<Player[]>([]);
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[number, number]>([0, 3000]);
  const [tempRange, setTempRange] = useState<[number, number]>([0, 3000]);
  const [limit, setLimit] = useState(25);
  const [activePage, setActivePage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [newSort, setNewSort] = useState<DataTableSortStatus>({
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
      sort: newSort.columnAccessor,
      direction: newSort.direction,
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
      sort: newSort.columnAccessor,
      direction: newSort.direction,
    }).then((res) => {
      setLoading(false);
      setplayers(res.data);
      setCount(res.count);
    });
  }, [activePage, newSort]);

  console.log(tempRange);

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
        <Card mb="xl" withBorder>
          <Flex sx={{ alignItems: "center", gap: 10 }}>
            <TextInput
              sx={{ flexGrow: 1 }}
              placeholder="Search player..."
              icon={<IconSearch size={16} />}
              value={name}
              onChange={(v) => setName(v.currentTarget.value)}
            />
            <ActionIcon
              sx={{ flexGrow: 0 }}
              onClick={() => setOpen((prev) => !prev)}
            >
              <IconDotsVertical size={16} />
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
        </Card>
        <Box sx={{ height: 500 }}>
          <DataTable
            withBorder
            highlightOnHover
            records={players}
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
            sortStatus={newSort}
            onSortStatusChange={setNewSort}
            recordsPerPageOptions={[10, 25, 50]}
            onRowClick={(_, i) => {
              setSelectedPlayer(i);
            }}
          />
        </Box>
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
