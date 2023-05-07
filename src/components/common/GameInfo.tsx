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
import { memo, useContext } from "react";
import { GameHeaders } from "../../utils/treeReducer";
import { TreeDispatchContext } from "./TreeStateContext";

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

function GameInfo({ headers }: { headers: GameHeaders }) {
  const dispatch = useContext(TreeDispatchContext);
  // check if dispatch has default value of () => {}
  const disabled = dispatch.length === 0;
  const date = headers.date
    ? dayjs(headers.date, "YYYY.MM.DD").isValid()
      ? dayjs(headers.date, "YYYY.MM.DD").toDate()
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
              value={headers.white.name}
              onChange={(e) =>
                dispatch({
                  type: "SET_HEADERS",
                  payload: {
                    ...headers,
                    white: {
                      ...headers.white,
                      name: e.currentTarget.value,
                    },
                  },
                })
              }
              disabled={disabled}
            />
            <NumberInput
              variant="unstyled"
              size="md"
              className={classes.eloInput}
              placeholder="Unknown ELO"
              value={headers.white_elo || ""}
              onChange={(n) =>
                dispatch({
                  type: "SET_HEADERS",
                  payload: {
                    ...headers,
                    white_elo: n === "" ? null : n,
                  },
                })
              }
              disabled={disabled}
            />
          </div>
        </Group>
      </Stack>
      <Stack align="center" justify="end" spacing={0}>
        <Text>{headers.result}</Text>
        {/* <Text>{outcome.replaceAll("1/2", "½")}</Text> */}
        <DateInput
          variant="unstyled"
          valueFormat="YYYY.MM.DD"
          placeholder="????.??.??"
          value={date}
          allowDeselect
          onChange={(date) => {
            dispatch({
              type: "SET_HEADERS",
              payload: {
                ...headers,
                date: dayjs(date, "YYYY.MM.DD").isValid()
                  ? dayjs(date, "YYYY.MM.DD").format("YYYY.MM.DD")
                  : undefined,
              },
            });
          }}
          disabled={disabled}
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
              value={headers.black.name}
              onChange={(e) =>
                dispatch({
                  type: "SET_HEADERS",
                  payload: {
                    ...headers,
                    black: {
                      ...headers.black,
                      name: e.currentTarget.value,
                    },
                  },
                })
              }
              disabled={disabled}
            />
            <NumberInput
              variant="unstyled"
              size="md"
              className={classes.eloInput}
              sx={{ "& input": { textAlign: "right" } }}
              placeholder="Unknown ELO"
              value={headers.black_elo || ""}
              onChange={(n) =>
                dispatch({
                  type: "SET_HEADERS",
                  payload: {
                    ...headers,
                    black_elo: n === "" ? null : n,
                  },
                })
              }
              disabled={disabled}
            />
          </div>
        </Group>
      </Stack>
    </Group>
  );
}

export default memo(GameInfo);
