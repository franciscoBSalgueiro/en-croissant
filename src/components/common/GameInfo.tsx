import {
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
  createStyles,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { memo } from "react";
import { CompleteGame } from "../../utils/db";

const useStyles = createStyles((theme) => ({
  nameInput: {
    "& input": {
      padding: 0,
      fontWeight: 500,
      lineHeight: 0,
      height: "auto",
    },
    "& input:disabled": {
      cursor: "default",
      backgroundColor: "transparent",
      color: theme.colorScheme === "dark" ? theme.colors.gray[0] : theme.black,
    },
  },
  eloInput: {
    height: "auto",
    "& input": {
      opacity: "75%",
      padding: 0,
      lineHeight: 0,
      height: "auto",
    },
    "& input:disabled": {
      cursor: "default",
      backgroundColor: "transparent",
      color: theme.colorScheme === "dark" ? "#fff" : "#000",
    },
  },
  dateInput: {
    "& input": { textAlign: "center" },
    "& input:disabled": {
      cursor: "default",
      backgroundColor: "transparent",
    },
  },
}));

function GameInfo({
  dateString,
  setCompleteGame,
  white_elo,
  whiteName,
  black_elo,
  blackName,
  result,
}: {
  dateString?: string;
  setCompleteGame?: React.Dispatch<React.SetStateAction<CompleteGame>>;
  white_elo?: number | null;
  whiteName?: string;
  black_elo?: number | null;
  blackName?: string;
  result: string;
}) {
  const date = dateString
    ? dayjs(dateString, "YYYY.MM.DD").isValid()
      ? dayjs(dateString, "YYYY.MM.DD").toDate()
      : null
    : null;
  const { classes } = useStyles();
  return (
    <Group align="apart" my="sm" mx="md" grow>
      <Stack align="start" spacing={0}>
        <Group noWrap>
          <div>
            <Text c="dimmed" tt="uppercase" fw="bold">
              White
            </Text>
            <TextInput
              variant="unstyled"
              className={classes.nameInput}
              size="lg"
              placeholder="?"
              value={whiteName}
              onChange={(e) =>
                setCompleteGame &&
                setCompleteGame((prev) => ({
                  ...prev,
                  game: {
                    ...prev.game,
                    white: {
                      ...prev.game.white,
                      name: e.currentTarget.value,
                    },
                  },
                }))
              }
              disabled={!setCompleteGame}
            />
            <NumberInput
              variant="unstyled"
              size="md"
              className={classes.eloInput}
              placeholder="Unknown ELO"
              value={white_elo ?? ""}
              onChange={(n) =>
                setCompleteGame &&
                setCompleteGame((prev) => ({
                  ...prev,
                  game: {
                    ...prev.game,
                    white_elo: n === "" ? null : n,
                  },
                }))
              }
              disabled={!setCompleteGame}
            />
          </div>
        </Group>
      </Stack>
      <Stack align="center" justify="end" spacing={0}>
        <Text>{result}</Text>
        {/* <Text>{outcome.replaceAll("1/2", "½")}</Text> */}
        <DateInput
          variant="unstyled"
          valueFormat="YYYY.MM.DD"
          placeholder="????.??.??"
          value={date}
          allowDeselect
          disabled={!setCompleteGame}
          onChange={(date) => {
            setCompleteGame &&
              setCompleteGame((prev) => ({
                ...prev,
                game: {
                  ...prev.game,
                  date: dayjs(date, "YYYY.MM.DD").isValid()
                    ? dayjs(date, "YYYY.MM.DD").format("YYYY.MM.DD")
                    : undefined,
                },
              }));
          }}
          className={classes.dateInput}
        />
      </Stack>
      <Stack align="end" spacing={0}>
        <Group noWrap>
          <div>
            <Text c="dimmed" align="right" tt="uppercase" fw="bold">
              Black
            </Text>
            <TextInput
              variant="unstyled"
              className={classes.nameInput}
              size="lg"
              placeholder="?"
              sx={{ "& input": { textAlign: "right" } }}
              value={blackName}
              onChange={(e) =>
                setCompleteGame &&
                setCompleteGame((prev) => ({
                  ...prev,
                  game: {
                    ...prev.game,
                    black: {
                      ...prev.game.black,
                      name: e.currentTarget.value,
                    },
                  },
                }))
              }
              disabled={!setCompleteGame}
            />
            <NumberInput
              variant="unstyled"
              size="md"
              className={classes.eloInput}
              sx={{ "& input": { textAlign: "right" } }}
              placeholder="Unknown ELO"
              value={black_elo ?? ""}
              onChange={(n) =>
                setCompleteGame &&
                setCompleteGame((prev) => ({
                  ...prev,
                  game: {
                    ...prev.game,
                    black_elo: n === "" ? null : n,
                  },
                }))
              }
              disabled={!setCompleteGame}
            />
          </div>
        </Group>
      </Stack>
    </Group>
  );
}

export default memo(GameInfo);
