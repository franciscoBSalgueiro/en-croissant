import {
  ActionIcon,
  Box,
  createStyles,
  Group,
  LoadingOverlay,
  ScrollArea,
  Table,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import { IconEye } from "@tabler/icons-react";
import router from "next/router";
import { useRef, useState } from "react";
import { CompleteGame, NormalizedGame } from "../../utils/db";
import { genID, Tab } from "../tabs/BoardsPage";

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

function GameSubTable({
  height,
  games,
  loading,
  selectedGame,
  setSelectedGame,
}: {
  height: number | string;
  games: NormalizedGame[];
  loading: boolean;
  selectedGame: number | null;
  setSelectedGame: (i: number | null) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { classes, cx } = useStyles();
  const theme = useMantineTheme();
  const firstId = genID();

  const [tabs, setTabs] = useSessionStorage<Tab[]>({
    key: "tabs",
    defaultValue: [],
  });
  const [activeTab, setActiveTab] = useSessionStorage<string | null>({
    key: "activeTab",
    defaultValue: firstId,
  });

  function createTab(name: string) {
    const id = genID();

    setTabs((prev) => [
      ...prev,
      {
        name,
        value: id,
        type: "analysis",
      },
    ]);
    setActiveTab(id);
    return id;
  }

  const rows =
    games.length === 0 ? (
      <tr>
        <td colSpan={6}>
          <Text weight={500} align="center" p={20}>
            No games found
          </Text>
        </td>
      </tr>
    ) : (
      games.map((game, i) => (
        <tr
          key={i}
          onClick={() => {
            i == selectedGame ? setSelectedGame(null) : setSelectedGame(i);
          }}
          className={cx(classes.row, {
            [classes.rowSelected]: i == selectedGame,
          })}
        >
          <td>
            <ActionIcon
              variant="filled"
              color={theme.primaryColor}
              onClick={() => {
                const id = createTab(`${game.white.name} - ${game.black.name}`);
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
          </td>
          <td>
            <Group spacing="sm" noWrap>
              {/* <Avatar size={40} src={game.white.image} radius={40} /> */}
              <div>
                <Text size="sm" weight={500}>
                  {game.white.name}
                </Text>
                <Text size="xs" color="dimmed">
                  {game.white_elo}
                </Text>
              </div>
            </Group>
          </td>
          <td>{game.result}</td>
          {/* <td>{game.outcome.replaceAll("1/2", "½")}</td> */}
          <td>
            <Group spacing="sm" noWrap>
              {/* <Avatar size={40} src={game.black.image} radius={40} /> */}
              <div>
                <Text size="sm" weight={500}>
                  {game.black.name}
                </Text>
                <Text size="xs" color="dimmed">
                  {game.black_elo}
                </Text>
              </div>
            </Group>
          </td>
          <td>{game.date}</td>
          <td>{game.event.name}</td>
          <td>{game.site.name}</td>
        </tr>
      ))
    );

  return (
    <Box sx={{ position: "relative" }}>
      <ScrollArea
        h={height}
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
              <th />
              <th>White</th>
              <th>Result</th>
              <th>Black</th>
              <th>Date</th>
              <th>Event</th>
              <th>Site</th>
            </tr>
          </thead>
          <tbody>
            <>{rows}</>
          </tbody>
        </Table>
      </ScrollArea>
      <LoadingOverlay visible={loading} />
    </Box>
  );
}

export default GameSubTable;
