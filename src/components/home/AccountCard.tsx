import {
  ActionIcon,
  Card,
  createStyles,
  Group,
  Stack,
  Text,
  Tooltip
} from "@mantine/core";
import {
  IconArrowDownRight,
  IconArrowRight,
  IconArrowUpRight,
  IconDownload,
  IconRefresh,
  IconX
} from "@tabler/icons";
import Image from "next/image";

const useStyles = createStyles((theme) => ({
  diff: {
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
  },

  rating: {
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 1,
    border: `1px solid ${
      theme.colorScheme === "dark" ? theme.colors.dark[5] : theme.colors.gray[3]
    }`,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,

    ":hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0],
    },
    transition: "all 100ms ease-in-out",
  },

  card: {
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
  },

  label: {
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    fontWeight: 700,
    lineHeight: 1,
  },

  lead: {
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    fontWeight: 700,
    fontSize: 22,
    lineHeight: 1,
  },
}));

interface AccountCardProps {
  title: string;
  description: string;
  total: number;
  stats: {
    value: number;
    label: string;
    diff: number;
  }[];
  logout: () => void;
  reload: () => void;
}

export function AccountCard({
  title,
  description,
  total,
  stats,
  logout,
  reload,
}: AccountCardProps) {
  const { classes, theme } = useStyles();
  const items = stats.map((stat) => {
    let color: string;
    let DiffIcon: any;
    switch (Math.sign(stat.diff)) {
      case 1:
        DiffIcon = IconArrowUpRight;
        color = "green";
        break;
      case -1:
        DiffIcon = IconArrowDownRight;
        color = "red";
        break;
      default:
        DiffIcon = IconArrowRight;
        color = "gray.5";
        break;
    }
    return (
      <div key={stat.label} className={classes.rating}>
        <Group>
          <div>
            <Text className={classes.label}>{stat.value}</Text>
            <Text size="xs" color="dimmed">
              {stat.label}
            </Text>
          </div>
          <Text color={color} size="sm" weight={500} className={classes.diff}>
            <span>{stat.diff}%</span>
            <DiffIcon size={16} stroke={1.5} />
          </Text>
        </Group>
      </div>
    );
  });

  return (
    <Card withBorder p="xl" radius="md" className={classes.card}>
      <Group grow>
        <div>
          <Group>
            <Image
              src="/lichess.svg"
              alt="Lichess logo"
              width={35}
              height={35}
            />
            <div>
              <Text size="xl" className={classes.label}>
                {title}
              </Text>
              <Text mt={5} size="sm" color="dimmed">
                {description}
              </Text>
            </div>
          </Group>
          <Group>
            <div>
              <Text className={classes.lead} mt={30}>
                {total}
              </Text>
              <Text size="xs" color="dimmed">
                Total Games
              </Text>
            </div>

            <div>
              <Text className={classes.lead} mt={30}>
                65%
              </Text>
              <Text size="xs" color="dimmed">
                Downloaded Games
              </Text>
            </div>
          </Group>
        </div>
        <Stack align="end" justify="flex-start">
          <Tooltip label="Update stats">
            <ActionIcon onClick={() => reload()}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Download games">
            <ActionIcon>
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Remove account">
            <ActionIcon onClick={() => logout()}>
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Stack>
      </Group>

      <Group grow mt="lg">
        {items}
      </Group>
    </Card>
  );
}
