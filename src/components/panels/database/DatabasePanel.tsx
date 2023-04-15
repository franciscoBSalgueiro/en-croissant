import {
  ActionIcon,
  createStyles,
  Progress,
  Tabs,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { useLocalStorage, useSessionStorage } from "@mantine/hooks";
import { IconEye } from "@tabler/icons-react";
import { Square } from "chess.js";
import { DataTable } from "mantine-datatable";
import Link from "next/link";
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import { uciToMove } from "../../../utils/chess";
import { CompleteGame, NormalizedGame, Opening } from "../../../utils/db";
import { formatNumber } from "../../../utils/format";
import { invoke } from "../../../utils/misc";
import { createTab, Tab } from "../../../utils/tabs";
import TreeContext from "../../common/TreeContext";

const useStyles = createStyles((theme) => ({
  clickable: {
    cursor: "pointer",
  },
  whiteLabel: {
    "& .mantine-Progress-label": {
      color: "black",
    },
  },
}));

function DatabasePanel({
  makeMove,
  height,
}: {
  makeMove: (move: { from: Square; to: Square; promotion?: string }) => void;
  height: number;
}) {
  const tree = useContext(TreeContext);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [games, setGames] = useState<NormalizedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenceDatabase, setReferenceDatabase] = useLocalStorage<
    string | null
  >({
    key: "reference-database",
    defaultValue: null,
  });
  const [tabs, setTabs] = useSessionStorage<Tab[]>({
    key: "tabs",
    defaultValue: [],
  });
  const [activeTab, setActiveTab] = useSessionStorage<string | null>({
    key: "activeTab",
    defaultValue: null,
  });
  const { classes } = useStyles();
  const theme = useMantineTheme();
  const router = useRouter();

  function sortOpenings(openings: Opening[]) {
    return openings.sort(
      (a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white)
    );
  }

  useEffect(() => {
    async function getOpening(referenceDatabase: string | null, fen: string) {
      let openings: [Opening[], NormalizedGame[]] = await invoke(
        "search_position",
        {
          file: referenceDatabase,
          fen,
        },
        (s) => s === "Search stopped"
      );

      return openings;
    }
    if (!referenceDatabase) return;

    let ignore = false;

    setLoading(true);

    getOpening(referenceDatabase, tree.fen).then((openings) => {
      if (!ignore) {
        setOpenings(sortOpenings(openings[0]));
        setGames(openings[1]);
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [tree, referenceDatabase]);

  return (
    <Tabs defaultValue="stats">
      <Tabs.List>
        <Tabs.Tab value="stats">Stats</Tabs.Tab>
        <Tabs.Tab value="games">Games</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="stats" pt="xs">
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
                const chessMove = uciToMove(move, tree.fen);
                if (!chessMove) return null;
                return <Text>{chessMove.san}</Text>;
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
            const chessMove = uciToMove(move, tree.fen);
            if (!chessMove) return;
            makeMove({
              from: chessMove.from as Square,
              to: chessMove.to as Square,
              promotion: chessMove.promotion,
            });
          }}
        />
      </Tabs.Panel>
      <Tabs.Panel value="games" pt="xs">
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
                    const id = createTab(
                      `${game.white.name} - ${game.black.name}`,
                      "analysis",
                      setTabs,
                      setActiveTab
                    );
                    const completeGame: CompleteGame = {
                      game,
                      currentMove: [],
                    };
                    sessionStorage.setItem(id, JSON.stringify(completeGame));
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
                    {white.name}
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
                    {black.name}
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
      </Tabs.Panel>
    </Tabs>
  );
}

export default DatabasePanel;
