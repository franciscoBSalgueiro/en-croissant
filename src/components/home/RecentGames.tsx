import {
  Card,
  createStyles,
  Group,
  ScrollArea,
  Stack,
  Text
} from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import { CompleteGame } from "../boards/BoardAnalysis";
import GamePreview from "../databases/GamePreview";
import { Tab } from "../tabs/BoardsPage";

const useStyles = createStyles((theme) => ({
  card: {
    cursor: "pointer",
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
  },

  content: {
    ":hover": {
      transform: "scale(1.03)",
      transition: "transform 500ms ease",
    },
  },

  title: {
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    lineHeight: 1,
  },
}));

function RecentGames() {
  const { classes } = useStyles();
  const [tabs] = useSessionStorage<Tab[]>({
    key: "tabs",
    defaultValue: [],
  });
  return (
    <ScrollArea offsetScrollbars>
      <Group noWrap>
        {tabs.map((tab) => {
          const value = sessionStorage.getItem(tab.value);
          if (value) {
            const game = JSON.parse(
              sessionStorage.getItem(tab.value)!
            ) as CompleteGame;
            return (
              <Card withBorder p="sm" w={300} h={230} className={classes.card}>
                <Stack>
                  <div className={classes.content}>
                    <GamePreview
                      id={tab.value}
                      pgn={game.game.moves}
                      hideControls
                    />
                  </div>
                  <Text
                    align="center"
                    size="sm"
                    weight={700}
                    className={classes.title}
                  >
                    {tab.name}
                  </Text>
                </Stack>
              </Card>
            );
          }
        })}
        {tabs.length === 0 && <Text align="center">No recent games</Text>}
      </Group>
    </ScrollArea>
  );
}

export default RecentGames;
