import {
  Card,
  createStyles,
  Group,
  Select,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { ColorControl } from "./ColorControl";
import { ThemeButton } from "./ThemeButton";
import { useAtom } from "jotai";
import {
  autoPromoteAtom,
  forcedEnPassantAtom,
  pieceSetAtom,
  showArrowsAtom,
  showDestsAtom,
  primaryColorAtom,
  moveInputAtom,
} from "@/atoms/atoms";

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

function SettingsPage() {
  const [moveInput, setMoveInput] = useAtom(moveInputAtom);
  const [showDests, setShowDests] = useAtom(showDestsAtom);
  const [showArrows, setShowArrows] = useAtom(showArrowsAtom);
  const [autoPromote, setAutoPromote] = useAtom(autoPromoteAtom);
  const [forcedEP, setForcedEP] = useAtom(forcedEnPassantAtom);
  const [primaryColor, setPrimaryColor] = useAtom(primaryColorAtom);
  const [pieceSet, setPieceSet] = useAtom(pieceSetAtom);
  const { classes } = useStyles();

  return (
    <Stack my="md" mx="md">
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
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Text Move Input</Text>
            <Text size="xs" color="dimmed">
              Enter moves in text format
            </Text>
          </div>
          <Switch
            onLabel="ON"
            offLabel="OFF"
            size="lg"
            checked={moveInput}
            onChange={(event) => setMoveInput(event.currentTarget.checked)}
            className={classes.switch}
          />
        </Group>
      </Card>
      <Card withBorder radius="md" p="xl" className={classes.card}>
        <Text size="lg" weight={500} className={classes.title}>
          Game
        </Text>
        <Text size="xs" color="dimmed" mt={3} mb="xl">
          Customize the game controls
        </Text>
        <Group position="apart" noWrap spacing="xl" className={classes.item}>
          <div>
            <Text>Auto Promotion</Text>
            <Text size="xs" color="dimmed">
              Automatically promote to a queen when a pawn reaches the last rank
            </Text>
          </div>
          <Switch
            onLabel="ON"
            offLabel="OFF"
            size="lg"
            checked={autoPromote}
            onChange={(event) => setAutoPromote(event.currentTarget.checked)}
            className={classes.switch}
          />
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
          <Switch
            onLabel="ON"
            offLabel="OFF"
            size="lg"
            checked={forcedEP}
            onChange={(event) => setForcedEP(event.currentTarget.checked)}
            className={classes.switch}
          />
        </Group>
      </Card>

      <Card withBorder radius="md" p="xl" className={classes.card}>
        <Text size="lg" weight={500} className={classes.title}>
          Personalization
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
              Overall color scheme
            </Text>
          </div>
          <Select
            data={pieceSets}
            value={pieceSet}
            onChange={(v) => setPieceSet(v!)}
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
            <ColorControl
              value={primaryColor}
              label={""}
              onChange={(color) => setPrimaryColor(color)}
            />
          </div>
        </Group>
      </Card>
    </Stack>
  );
}

export default SettingsPage;
