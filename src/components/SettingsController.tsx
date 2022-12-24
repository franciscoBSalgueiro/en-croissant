import { Card, createStyles, Group, Switch, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";

const useStyles = createStyles((theme) => ({
  card: {
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
  },

  item: {
    "& + &": {
      paddingTop: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      borderTop: `1px solid ${
        theme.colorScheme === "dark"
          ? theme.colors.dark[4]
          : theme.colors.gray[2]
      }`,
    },
  },

  switch: {
    "& *": {
      cursor: "pointer",
    },
  },

  title: {
    lineHeight: 1,
  },
}));

function SettingsController() {
  const [showDests, setShowDests] = useLocalStorage<boolean>({
    key: "show-dests",
    defaultValue: true,
  });
  const [showArrows, setShowArrows] = useLocalStorage<boolean>({
    key: "show-arrows",
    defaultValue: true,
  });
  const { classes } = useStyles();

  return (
    <>
      <Card withBorder radius="md" p="xl" className={classes.card}>
        <Text size="lg" weight={500} className={classes.title}>
          Board
        </Text>
        <Text size="xs" color="dimmed" mt={3} mb="xl">
          Customize the analysis board
        </Text>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Piece Destinations</Text>
            <Text size="xs" color="dimmed">
              Show possible moves for each piece
            </Text>
          </div>
          <Switch
            onLabel="ON"
            offLabel="OFF"
            size="lg"
            checked={showDests}
            onChange={(event) => setShowDests(event.currentTarget.checked)}
            className={classes.switch}
          />
        </Group>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Arrows</Text>
            <Text size="xs" color="dimmed">
              Show best move arrows
            </Text>
          </div>
          <Switch
            onLabel="ON"
            offLabel="OFF"
            size="lg"
            checked={showArrows}
            onChange={(event) => setShowArrows(event.currentTarget.checked)}
            className={classes.switch}
          />
        </Group>
      </Card>
    </>
  );
}

export default SettingsController;
