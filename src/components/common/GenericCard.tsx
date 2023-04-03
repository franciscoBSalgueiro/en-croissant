import { Card, Stack, Text, createStyles } from "@mantine/core";
import { ReactNode } from "react";

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

      borderStyle: "solid",
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

type Props<T> = {
  id: T;
  isSelected: boolean;
  setSelected: (id: T | ((prevId: T) => T)) => void;
  stats?: {
    label: string;
    value: string;
  }[];
  Header: ReactNode;
};

export default function GenericCard<T>({
  id,
  isSelected,
  setSelected,
  stats,
  Header,
}: Props<T>) {
  const { classes } = useStyles({ selected: isSelected });

  return (
    <>
      <Card
        radius="md"
        className={classes.card}
        onClick={() => setSelected(id)}
      >
        <Stack h="100%" justify="space-between">
          {Header}

          {stats && (
            <div className={classes.info}>
              {stats.map((stat) => (
                <div>
                  <Text
                    size="sm"
                    color="dimmed"
                    className={classes.label}
                    mt={15}
                  >
                    {stat.label}
                  </Text>
                  <Text weight={700} size="xl" sx={{ lineHeight: 1 }}>
                    {stat.value}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </Stack>
      </Card>
    </>
  );
}
