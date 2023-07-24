import {
  ActionIcon,
  Box,
  Button,
  createStyles,
  Group,
  Progress,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { DataTable } from "mantine-datatable";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  memo,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { NormalizedGame, Opening, searchPosition } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import { invoke, useThrottledEffect } from "@/utils/misc";
import { createTab } from "@/utils/tabs";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import { activeTabAtom, referenceDbAtom, tabsAtom } from "@/atoms/atoms";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import PiecesGrid from "@/components/boards/PiecesGrid";
import Chessground from "react-chessground";
import { getNodeAtPath } from "@/utils/treeReducer";

const useStyles = createStyles(() => ({
  clickable: {
    cursor: "pointer",
  },
  whiteLabel: {
    "& .mantine-Progress-label": {
      color: "black",
    },
  },
}));

function sortOpenings(openings: Opening[]) {
  return openings.sort(
    (a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white)
  );
}

function DatabasePanel({ height, fen }: { height: number; fen: string }) {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [games, setGames] = useState<NormalizedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const referenceDatabase = useAtomValue(referenceDbAtom);

  useThrottledEffect(
    () => {
      if (!referenceDatabase) return;
      let ignore = false;

      setLoading(true);

      searchPosition(referenceDatabase, "exact", fen).then((openings) => {
        if (!ignore) {
          startTransition(() => {
            setOpenings(sortOpenings(openings[0]));
            setGames(openings[1]);
            setLoading(false);
          });
        }
      });

      return () => {
        ignore = true;
      };
    },
    50,
    [referenceDatabase, fen]
  );

  return (
    <Tabs
      defaultValue="stats"
      orientation="vertical"
      placement="right"
      keepMounted={false}
    >
      <Tabs.List>
        <Tabs.Tab value="stats">Stats</Tabs.Tab>
        <Tabs.Tab value="games">Games</Tabs.Tab>
        <Tabs.Tab value="search">Search</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="stats" pt="xs" mr="xs">
        <OpeningsTable
          openings={openings}
          height={height}
          loading={loading}
          referenceDatabase={referenceDatabase}
        />
      </Tabs.Panel>
      <Tabs.Panel value="games" pt="xs" mr="xs">
        <GamesTable games={games} height={height} loading={loading} />
      </Tabs.Panel>
      <Tabs.Panel value="search" pt="xs" mr="xs">
        <SearchPanel />
      </Tabs.Panel>
    </Tabs>
  );
}

async function similarStructure(fen: string) {
  return await invoke<string>("similar_structure", { fen });
}

function SearchPanel() {
  const boardRef = useRef(null);
  const tree = useContext(TreeStateContext);
  const node = getNodeAtPath(tree.root, tree.position);
  const [fen, setFen] = useState("");
  const [games, setGames] = useState<NormalizedGame[]>([]);

  useEffect(() => {
    const fetchSimilarStructure = async () => {
      const fenResult = await similarStructure(node.fen);
      setFen(fenResult);
    };

    fetchSimilarStructure();
  }, [node.fen]);
  const referenceDb = useAtomValue(referenceDbAtom);
  console.log(fen);

  return (
    <ScrollArea h={600}>
      <Stack>
        <Group>
          <Box ref={boardRef}>
            <Chessground
              width={450}
              height={450}
              fen={fen}
              coordinates={false}
              movable={{
                free: true,
                color: "both",
                events: {
                  after: (orig, dest) => {
                    invoke<string>("make_move", {
                      fen,
                      from: orig,
                      to: dest,
                    }).then((newFen) => {
                      setFen(newFen);
                    });
                  },
                },
              }}
            />
          </Box>
          <PiecesGrid
            boardRef={boardRef}
            fen={fen}
            vertical
            onPut={(newFen) => {
              setFen(newFen);
            }}
          />
        </Group>
        <Button
          onClick={() => {
            searchPosition(referenceDb, "partial", fen).then((openings) => {
              console.log(openings);
              setGames(openings[1]);
            });
          }}
        >
          Search
        </Button>
        {games.length > 0 && (
          <GamesTable games={games} height={300} loading={false} />
        )}
      </Stack>
    </ScrollArea>
  );
}

const OpeningsTable = memo(function OpeningsTable({
  openings,
  height,
  loading,
  referenceDatabase,
}: {
  openings: Opening[];
  height: number;
  loading: boolean;
  referenceDatabase: string | null;
}) {
  const { classes } = useStyles();
  const dispatch = useContext(TreeDispatchContext);
  return (
    <DataTable
      withBorder
      highlightOnHover
      height={height}
      records={openings}
      fetching={loading || openings === null}
      columns={[
        {
          accessor: "move",
          width: 100,
          render: ({ move }) => {
            if (move === "*") return <Text fs="italic">Game end</Text>;
            return <Text>{move}</Text>;
          },
        },
        {
          accessor: "total",
          width: 100,
          textAlignment: "right",
          render: ({ white, draw, black }) => {
            const total = white + draw + black;
            return formatNumber(total);
          },
        },
        {
          accessor: "results",
          render: ({ black, white, draw }) => {
            const total = white + draw + black;
            const whitePercent = (white / total) * 100;
            const drawPercent = (draw / total) * 100;
            const blackPercent = (black / total) * 100;
            return (
              <Progress
                mt="md"
                size="xl"
                radius="xl"
                animate={false}
                sections={[
                  {
                    className: classes.whiteLabel,
                    value: whitePercent,
                    color: "white",
                    label: whitePercent.toFixed(1) + "%",
                  },
                  {
                    value: drawPercent,
                    color: "gray",
                    label: drawPercent.toFixed(1) + "%",
                  },
                  {
                    value: blackPercent,
                    color: "black",
                    label: blackPercent.toFixed(1) + "%",
                  },
                ]}
              />
            );
          },
        },
      ]}
      idAccessor="move"
      emptyState={
        referenceDatabase ? (
          "No games found"
        ) : (
          <Text
            sx={{
              pointerEvents: "all",
            }}
          >
            No reference database selected. Please{" "}
            <Link href="/databases">Add a database</Link> first.
          </Text>
        )
      }
      onRowClick={({ move }) => {
        dispatch({
          type: "MAKE_MOVE",
          payload: move,
        });
      }}
    />
  );
});

const GamesTable = memo(function GamesTable({
  games,
  height,
  loading,
}: {
  games: NormalizedGame[];
  height: number;
  loading: boolean;
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const theme = useMantineTheme();
  const router = useRouter();
  return (
    <DataTable
      withBorder
      highlightOnHover
      height={height}
      records={games}
      fetching={loading}
      columns={[
        {
          accessor: "actions",
          title: "",
          render: (game) => (
            <ActionIcon
              variant="filled"
              color={theme.primaryColor}
              onClick={() => {
                createTab({
                  tab: {
                    name: `${game.white} - ${game.black}`,
                    type: "analysis",
                  },
                  setTabs,
                  setActiveTab,
                  pgn: game.moves,
                  headers: game,
                });
                router.push("/boards");
              }}
            >
              <IconEye size={16} stroke={1.5} />
            </ActionIcon>
          ),
        },
        {
          accessor: "white",
          render: ({ white, white_elo }) => (
            <div>
              <Text size="sm" weight={500}>
                {white}
              </Text>
              <Text size="xs" color="dimmed">
                {white_elo}
              </Text>
            </div>
          ),
        },
        {
          accessor: "black",
          render: ({ black, black_elo }) => (
            <div>
              <Text size="sm" weight={500}>
                {black}
              </Text>
              <Text size="xs" color="dimmed">
                {black_elo}
              </Text>
            </div>
          ),
        },
        { accessor: "date" },
        { accessor: "result" },
        { accessor: "ply_count" },
      ]}
      noRecordsText="No games found"
    />
  );
});

export default memo(DatabasePanel);
