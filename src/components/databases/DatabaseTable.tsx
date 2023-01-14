import {
  ActionIcon,
  Box,
  Button,
  Center,
  Checkbox,
  Collapse,
  createStyles,
  Grid,
  Group,
  LoadingOverlay,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconSearch,
  IconSortDescending,
  IconSwitchVertical
} from "@tabler/icons";
import React, { useEffect, useRef, useState } from "react";
import { Database, query_players } from "../../utils/db";

const useStyles = createStyles((theme) => ({
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    transition: "box-shadow 150ms ease",

    "&::after": {
      content: '""',
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? theme.colors.dark[3]
          : theme.colors.gray[2]
      }`,
    },
  },
  scrolled: {
    boxShadow: theme.shadows.sm,
  },
  row: {
    cursor: "pointer",
    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark" ? theme.colors.dark[6] : theme.white,
    },
  },
  rowSelected: {
    backgroundColor:
      theme.colorScheme === "dark"
        ? theme.fn.rgba(theme.colors[theme.primaryColor][7], 0.2)
        : theme.colors[theme.primaryColor][0],

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.fn.rgba(theme.colors[theme.primaryColor][7], 0.2)
          : theme.colors[theme.primaryColor][0],
    },
  },
}));

interface DatabaseTableProps<Type> {
  database: Database;
  sortOptions: { label: string; value: string }[];
  PreviewCard: React.FC<{ data: Type; file: string }>;
  rowNames: string[];
  RowInfo: React.FC<{ data: Type }>;
}

function DatabaseTable<Type>({
  database,
  sortOptions,
  PreviewCard,
  rowNames,
  RowInfo,
}: DatabaseTableProps<Type>) {
  const { classes, cx } = useStyles();
  const file = database.file;
  const [data, setData] = useState<Type[]>([]);
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [skip, toggleSkip] = useToggle();
  const [limit, setLimit] = useState(25);
  const [sort, setSort] = useState(sortOptions[0].value);
  const [activePage, setActivePage] = useState(1);
  const [selectedData, setSelectedData] = useState<number | null>(null);
  const offset = (activePage - 1) * limit;
  const [scrolled, setScrolled] = useState(false);
  const [openedSettings, toggleOpenedSettings] = useToggle();
  const viewport = useRef<HTMLDivElement>(null);
  const scrollToTop = () => viewport.current?.scrollTo({ top: 0 });

  useEffect(() => {
    setActivePage(1);
    setSelectedData(null);
    setLoading(true);
    query_players(file, {
      name: name,
      limit,
      offset: 0,
      skip_count: skip,
      sort,
    }).then((res) => {
      setLoading(false);
      setData(res.data);
      setCount(res.count);
    });
  }, [name, skip, limit, file]);

  useEffect(() => {
    setLoading(true);
    scrollToTop();
    setSelectedData(null);
    query_players(file, {
      name: name === "" ? undefined : name,
      limit,
      offset: skip ? 0 : offset,
      skip_count: skip,
      sort,
    }).then((res) => {
      setLoading(false);
      setData(res.data);
      setCount(res.count);
    });
  }, [offset, sort]);

  const rows =
    data.length === 0 ? (
      <tr>
        <td colSpan={6}>
          <Text weight={500} align="center" p={20}>
            No players found
          </Text>
        </td>
      </tr>
    ) : (
      data.map((row, i) => (
        <tr
          key={i}
          onClick={() => {
            i == selectedData ? setSelectedData(null) : setSelectedData(i);
          }}
          className={cx(classes.row, {
            [classes.rowSelected]: i == selectedData,
          })}
        >
          <RowInfo data={row} />
        </tr>
      ))
    );

  useHotkeys([
    [
      "ArrowUp",
      () => {
        setSelectedData((prev) => {
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
        setSelectedData((prev) => {
          if (prev === null) {
            return 0;
          }
          if (prev === data.length - 1) {
            return data.length - 1;
          }
          return prev + 1;
        });
      },
    ],
  ]);

  return (
    <>
      <Grid grow>
        <Grid.Col span={3}>
          <Group position="apart">
            <Button
              my={15}
              compact
              variant="outline"
              leftIcon={<IconSearch size={15} />}
              onClick={() => toggleOpenedSettings()}
            >
              Search Settings
            </Button>

            <Select
              icon={<IconSortDescending size={20} />}
              value={sort}
              onChange={(v) => {
                v && setSort(v);
              }}
              data={sortOptions}
              defaultValue={sort}
            />
            <ActionIcon>
              <IconSwitchVertical size={20} />
            </ActionIcon>
          </Group>

          <Collapse in={openedSettings} mx={10}>
            <Stack>
              <Group grow>
                <TextInput
                  label="Name"
                  value={name}
                  onChange={(v) => setName(v.currentTarget.value)}
                />
              </Group>
              <Tooltip label="Disabling this may significantly improve performance">
                <Checkbox
                  label="Include pagination"
                  checked={!skip}
                  onChange={() => toggleSkip()}
                />
              </Tooltip>
            </Stack>
          </Collapse>
          <Box sx={{ position: "relative" }}>
            <ScrollArea
              h={600}
              viewportRef={viewport}
              onScrollPositionChange={({ y }) => setScrolled(y !== 0)}
              offsetScrollbars
            >
              <Table>
                <thead
                  className={cx(classes.header, {
                    [classes.scrolled]: scrolled,
                  })}
                >
                  <tr>
                    {rowNames.map((name, i) => (
                      <th key={i}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <>{rows}</>
                </tbody>
              </Table>
            </ScrollArea>
            <LoadingOverlay visible={loading} />
          </Box>
          {!skip && (
            <>
              <Select
                label="Results per page"
                value={limit.toString()}
                onChange={(v) => {
                  v && setLimit(parseInt(v));
                }}
                sx={{ float: "right" }}
                data={["10", "25", "50", "100"]}
                defaultValue={limit.toString()}
              />
              <Stack align="center" spacing={0} mt={20}>
                <Pagination
                  page={activePage}
                  onChange={setActivePage}
                  total={Math.ceil(count / limit)}
                />
                <Text weight={500} align="center" p={20}>
                  {Intl.NumberFormat().format(count)} players
                </Text>
              </Stack>
            </>
          )}
        </Grid.Col>

        <Grid.Col span={2}>
          {selectedData !== null ? (
            <>
              <PreviewCard data={data[selectedData]} file={database.file} />
            </>
          ) : (
            <Center h="100%">
              <Text>No player selected</Text>
            </Center>
          )}
        </Grid.Col>
      </Grid>
    </>
  );
}

export default DatabaseTable;
