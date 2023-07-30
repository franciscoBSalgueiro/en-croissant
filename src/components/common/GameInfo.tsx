import {
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  createStyles,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { memo, useContext } from "react";
import { GameHeaders } from "@/utils/treeReducer";
import { TreeDispatchContext } from "./TreeStateContext";
import { Outcome } from "@/utils/db";

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
  resultInput: {
    "& input": { textAlign: "center", paddingRight: 0 },
    "& input:disabled": {
      cursor: "default",
      backgroundColor: "transparent",
    },
  },
  eventInput: {
    "& input": { textAlign: "center", height: 0 },
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
    <div>
      <Stack align="center" spacing={0} mx="md" mt="sm">
        <Group>
          <TextInput
            variant="unstyled"
            size="lg"
            w={headers.round !== "?" ? "100%" : 600}
            placeholder="Unknown Event"
            className={classes.eventInput}
            value={headers.event === "?" ? "" : headers.event}
            onChange={(e) =>
              dispatch({
                type: "SET_HEADERS",
                payload: {
                  ...headers,
                  event: e.currentTarget.value,
                },
              })
            }
            disabled={disabled}
          />
          {headers.round && headers.round !== "?" && (
            <Group spacing={0} className={classes.eventInput}>
              <Text color="dimmed" size="sm">
                ( Round
              </Text>
              <TextInput
                size="sm"
                variant="unstyled"
                w={30}
                placeholder="?"
                value={headers.round}
                onChange={(e) =>
                  dispatch({
                    type: "SET_HEADERS",
                    payload: {
                      ...headers,
                      round: e.currentTarget.value,
                    },
                  })
                }
                disabled={disabled}
              />
              <Text color="dimmed" size="sm">
                )
              </Text>
            </Group>
          )}
        </Group>
      </Stack>
      <Group align="apart" mx="md" grow>
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
                value={headers.white}
                onChange={(e) =>
                  dispatch({
                    type: "SET_HEADERS",
                    payload: {
                      ...headers,
                      white: e.currentTarget.value,
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
          <Group spacing={0} noWrap>
            {headers.site.startsWith("https://lichess.org") ||
            headers.site.startsWith("https://www.chess.com") ? (
              <a href={headers.site} target="_blank" rel="noreferrer">
                <Text p="sm" w={90}>
                  {headers.site.startsWith("https://lichess.org")
                    ? "Lichess"
                    : "Chess.com"}
                </Text>
              </a>
            ) : (
              <TextInput
                variant="unstyled"
                placeholder="Unknown Site"
                className={classes.eventInput}
                value={headers.site === "?" ? "" : headers.site}
                onChange={(e) =>
                  dispatch({
                    type: "SET_HEADERS",
                    payload: {
                      ...headers,
                      site: e.currentTarget.value,
                    },
                  })
                }
                disabled={disabled}
              />
            )}
            -
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
          </Group>
          <Select
            data={["1-0", "0-1", "1/2-1/2", "*"]}
            value={headers.result}
            variant="unstyled"
            rightSection={<></>}
            rightSectionWidth={0}
            className={classes.resultInput}
            onChange={(result) =>
              dispatch({
                type: "SET_HEADERS",
                payload: {
                  ...headers,
                  result: result as Outcome,
                },
              })
            }
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
                value={headers.black}
                onChange={(e) =>
                  dispatch({
                    type: "SET_HEADERS",
                    payload: {
                      ...headers,
                      black: e.currentTarget.value,
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
    </div>
  );
}

export default memo(GameInfo);
