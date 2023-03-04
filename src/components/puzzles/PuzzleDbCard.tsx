import { Card, createStyles, Group, Stack, Text } from "@mantine/core";
import { IconDatabase } from "@tabler/icons";
import { formatBytes, formatNumber } from "../../utils/format";

const useStyles = createStyles(
  (theme, { selected }: { selected: boolean }) => ({
    card: {
      cursor: "pointer",
      backgroundColor: selected
        ? theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0]
        : theme.colorScheme === "dark"
        ? theme.colors.dark[7]
        : theme.white,

      borderColor: selected
        ? theme.colors[theme.primaryColor][6]
        : "transparent",
      borderWidth: 2,

      "&:hover": {
        backgroundColor:
          theme.colorScheme === "dark"
            ? theme.colors.dark[6]
            : theme.colors.gray[0],
        borderColor: selected
          ? theme.colors[theme.primaryColor][6]
          : theme.colors.gray[6],
      },
    },

    label: {
      marginBottom: theme.spacing.xs,
      lineHeight: 1,
      fontWeight: 700,
      fontSize: theme.fontSizes.xs,
      letterSpacing: -0.25,
      textTransform: "uppercase",
    },

    info: {
      display: "flex",
      justifyContent: "space-between",
    },
  })
);

interface PuzzleCardProps {
  id: number;
  selected: boolean;
  setSelected: (selected: number) => void;
  title: string;
  puzzles: number;
  storage: number;
}

export function PuzzleDbCard({
  id,
  selected,
  setSelected,
  title,
  puzzles,
  storage,
}: PuzzleCardProps) {
  const { classes } = useStyles({ selected });

  return (
    <>
      <Card
        withBorder
        radius="md"
        className={classes.card}
        onClick={() => setSelected(id)}
      >
        <Stack>
          <Group noWrap position="apart">
            <Group noWrap>
              <IconDatabase size={24} />
              <div>
                <Text weight={500}>{title}</Text>
              </div>
            </Group>
          </Group>

          <div className={classes.info}>
            <div>
              <Text size="sm" color="dimmed" className={classes.label} mt={15}>
                Puzzles
              </Text>
              <Text weight={700} size="xl" sx={{ lineHeight: 1 }}>
                {formatNumber(puzzles)}
              </Text>
            </div>
            <div>
              <Text size="sm" color="dimmed" className={classes.label} mt={15}>
                Storage
              </Text>
              <Text weight={700} size="xl" sx={{ lineHeight: 1 }}>
                {formatBytes(storage)}
              </Text>
            </div>
          </div>
        </Stack>
      </Card>
    </>
  );
}
