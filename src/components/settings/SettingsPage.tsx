import {
  showArrowsAtom,
  moveInputAtom,
  autoPromoteAtom,
  autoSaveAtom,
  percentageCoverageAtom,
  minimumGamesAtom,
  forcedEnPassantAtom,
  pieceSetAtom,
  showDestsAtom,
} from "@/atoms/atoms";
import { Card, createStyles, Group, Stack, Text } from "@mantine/core";
import ColorControl from "./ColorControl";
import SettingsNumberInput from "./SettingsNumberInput";
import SettingsSelect from "./SettingsSelect";
import SettingsSwitch from "./SettingsSwitch";
import ThemeButton from "./ThemeButton";
import { useLoaderData } from "react-router-dom";

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

  title: {
    lineHeight: 1,
  },
}));

const pieceSets = [
  { label: "Alpha", value: "alpha" },
  { label: "Anarcandy", value: "anarcandy" },
  { label: "California", value: "california" },
  { label: "Cardinal", value: "cardinal" },
  { label: "Cburnett", value: "cburnett" },
  { label: "Chess7", value: "chess7" },
  { label: "Chessnut", value: "chessnut" },
  { label: "Companion", value: "companion" },
  { label: "Disguised", value: "disguised" },
  { label: "Dubrovny", value: "dubrovny" },
  { label: "Fantasy", value: "fantasy" },
  { label: "Fresca", value: "fresca" },
  { label: "Gioco", value: "gioco" },
  { label: "Governor", value: "governor" },
  { label: "Horsey", value: "horsey" },
  { label: "ICpieces", value: "icpieces" },
  { label: "Kosal", value: "kosal" },
  { label: "Leipzig", value: "leipzig" },
  { label: "Letter", value: "letter" },
  { label: "Libra", value: "libra" },
  { label: "Maestro", value: "maestro" },
  { label: "Merida", value: "merida" },
  { label: "Pirouetti", value: "pirouetti" },
  { label: "Pixel", value: "pixel" },
  { label: "Reillycraig", value: "reillycraig" },
  { label: "Riohacha", value: "riohacha" },
  { label: "Shapes", value: "shapes" },
  { label: "Spatial", value: "spatial" },
  { label: "Staunty", value: "staunty" },
  { label: "Tatiana", value: "tatiana" },
];

export default function Page() {
  const { classes } = useStyles();
  const version = useLoaderData() as string;

  return (
    <Stack my="md" mx="md">
      <Card withBorder radius="md" p="xl" className={classes.card}>
        <Text size="lg" weight={500} className={classes.title}>
          Board
        </Text>
        <Text size="xs" color="dimmed" mt={3} mb="xl">
          Customize the analysis board and game controls
        </Text>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Piece Destinations</Text>
            <Text size="xs" color="dimmed">
              Show possible moves for each piece
            </Text>
          </div>
          <SettingsSwitch atom={showDestsAtom} />
        </Group>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Arrows</Text>
            <Text size="xs" color="dimmed">
              Show best move arrows
            </Text>
          </div>
          <SettingsSwitch atom={showArrowsAtom} />
        </Group>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Text Move Input</Text>
            <Text size="xs" color="dimmed">
              Enter moves in text format
            </Text>
          </div>
          <SettingsSwitch atom={moveInputAtom} />
        </Group>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Auto Promotion</Text>
            <Text size="xs" color="dimmed">
              Automatically promote to a queen when a pawn reaches the last rank
            </Text>
          </div>
          <SettingsSwitch atom={autoPromoteAtom} />
        </Group>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Auto Save</Text>
            <Text size="xs" color="dimmed">
              Auto save to file after each move
            </Text>
          </div>
          <SettingsSwitch atom={autoSaveAtom} />
        </Group>
      </Card>
      <Card withBorder radius="md" p="xl" className={classes.card}>
        <Text size="lg" weight={500} className={classes.title}>
          Opening Report
        </Text>
        <Text size="xs" color="dimmed" mt={3} mb="xl">
          Customize the opening report settings
        </Text>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Percentage Coverage</Text>
            <Text size="xs" color="dimmed">
              Percentage of moves covered in each position
            </Text>
          </div>
          <SettingsNumberInput
            atom={percentageCoverageAtom}
            min={50}
            max={100}
            step={1}
          />
        </Group>

        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Minimum Games</Text>
            <Text size="xs" color="dimmed">
              Minimum number of games in each position for it to be considered
            </Text>
          </div>
          <SettingsNumberInput atom={minimumGamesAtom} min={0} step={1} />
        </Group>
      </Card>
      <Card withBorder radius="md" p="xl" className={classes.card}>
        <Text size="lg" weight={500} className={classes.title}>
          Anarchy
        </Text>
        <Text size="xs" color="dimmed" mt={3} mb="xl">
          Fun options
        </Text>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Forced en-passant</Text>
            <Text size="xs" color="dimmed">
              {"Forces you to play en-passant, if it's a legal move."}
            </Text>
          </div>
          <SettingsSwitch atom={forcedEnPassantAtom} />
        </Group>
      </Card>
      <Card withBorder radius="md" p="xl" className={classes.card}>
        <Text size="lg" weight={500} className={classes.title}>
          Appearance
        </Text>
        <Text size="xs" color="dimmed" mt={3} mb="xl">
          Customize the look of the app
        </Text>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Theme</Text>
            <Text size="xs" color="dimmed">
              Overall color scheme
            </Text>
          </div>
          <ThemeButton />
        </Group>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Piece Set</Text>
            <Text size="xs" color="dimmed">
              Pieces used on the boards
            </Text>
          </div>
          <SettingsSelect
            data={pieceSets}
            atom={pieceSetAtom}
            placeholder="Select piece set"
          />
        </Group>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Accent Color</Text>
            <Text size="xs" color="dimmed">
              Main color of the app
            </Text>
          </div>
          <div style={{ width: 200 }}>
            <ColorControl />
          </div>
        </Group>
      </Card>
      <Text size="xs" color="dimmed" align="right">
        En Croissant v{version}
      </Text>
    </Stack>
  );
}
