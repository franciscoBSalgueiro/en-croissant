import { Box, Group, Select, SimpleGrid, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { memo, useContext, useState } from "react";
import { GameHeaders } from "@/utils/treeReducer";
import { TreeDispatchContext } from "./TreeStateContext";
import { Outcome } from "@/utils/db";
import FideInfo from "../databases/FideInfo";
import * as classes from "./GameInfo.css";
import { ContentEditable } from "../tabs/ContentEditable";
import cx from "clsx";

function GameInfo({
  headers,
  simplified,
}: {
  headers: GameHeaders;
  simplified?: boolean;
}) {
  const dispatch = useContext(TreeDispatchContext);
  const disabled = dispatch.length === 0;
  const date = headers.date
    ? dayjs(headers.date, "YYYY.MM.DD").isValid()
      ? dayjs(headers.date, "YYYY.MM.DD").toDate()
      : null
    : null;
  const [whiteOpened, setWhiteOpened] = useState(false);
  const [blackOpened, setBlackOpened] = useState(false);

  const event = headers.event === "?" ? "" : headers.event;
  const site = headers.site === "?" ? "" : headers.site;

  return (
    <Box px="md" pt="md">
      <FideInfo
        opened={whiteOpened}
        setOpened={setWhiteOpened}
        name={headers.white}
      />
      <FideInfo
        opened={blackOpened}
        setOpened={setBlackOpened}
        name={headers.black}
      />

      <Group w="100%" wrap="nowrap">
        {!simplified && (
          <Text
            c="dimmed"
            tt="uppercase"
            fw="bold"
            className={classes.colorHover}
            onClick={() => setWhiteOpened(true)}
          >
            White
          </Text>
        )}
        <Group wrap="nowrap" justify={simplified ? "start" : "center"} w="100%">
          <ContentEditable
            disabled={disabled}
            html={event}
            data-placeholder="Unknown Event"
            className={cx(
              classes.contentEditable,
              !event && classes.contentEditablePlaceholder
            )}
            onChange={(e) => {
              dispatch({
                type: "SET_HEADERS",
                payload: {
                  ...headers,
                  event: e.target.value,
                },
              });
            }}
          />
          {headers.round && headers.round !== "?" && (
            <>
              {"-"}
              <Group gap={0} className={classes.textInput} wrap="nowrap">
                <Text c="dimmed" size="sm" mr="xs">
                  Round
                </Text>
                <input
                  className={classes.roundInput}
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
              </Group>
            </>
          )}
        </Group>
        {!simplified && (
          <Text
            c="dimmed"
            tt="uppercase"
            fw="bold"
            ta="right"
            onClick={() => setBlackOpened(true)}
            className={classes.colorHover}
          >
            Black
          </Text>
        )}
      </Group>
      {!simplified && (
        <SimpleGrid cols={3} spacing={0}>
          <input
            className={classes.textInput}
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
          <Group justify="center">
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
              <ContentEditable
                className={cx(
                  classes.contentEditable,
                  !site && classes.contentEditablePlaceholder
                )}
                data-placeholder="Unknown Site"
                html={site}
                onChange={(e) =>
                  dispatch({
                    type: "SET_HEADERS",
                    payload: {
                      ...headers,
                      site: e.target.value,
                    },
                  })
                }
                disabled={disabled}
              />
            )}
            <DateInput
              w="4.5rem"
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
              readOnly={disabled}
              className={classes.dateInput}
            />
          </Group>
          <input
            className={cx(classes.textInput, classes.right)}
            placeholder="?"
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
          <input
            className={classes.textInput}
            placeholder="Unknown ELO"
            value={headers.white_elo || ""}
            onChange={(n) =>
              dispatch({
                type: "SET_HEADERS",
                payload: {
                  ...headers,
                  white_elo: parseInt(n.currentTarget.value),
                },
              })
            }
            disabled={disabled}
          />
          <Select
            readOnly={disabled}
            allowDeselect={false}
            data={["1-0", "0-1", "1/2-1/2", "*"]}
            value={headers.result}
            variant="unstyled"
            rightSection={<></>}
            rightSectionWidth={0}
            styles={{
              input: { textAlign: "center" },
            }}
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
          <input
            className={cx(classes.textInput, classes.right)}
            placeholder="Unknown ELO"
            value={headers.black_elo || ""}
            onChange={(n) =>
              dispatch({
                type: "SET_HEADERS",
                payload: {
                  ...headers,
                  black_elo: parseInt(n.currentTarget.value),
                },
              })
            }
            disabled={disabled}
          />
        </SimpleGrid>
      )}
    </Box>
  );
}

export default memo(GameInfo);
