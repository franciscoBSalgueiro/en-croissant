import { Box, Group, Select, Text, UnstyledButton } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import cx from "clsx";
import dayjs from "dayjs";
import { memo, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { createStore, useStore } from "zustand";
import type { Outcome } from "@/bindings";
import type { GameHeaders } from "@/utils/treeReducer";
import FideInfo from "../databases/FideInfo";
import classes from "./GameInfo.module.css";
import { TreeStateContext } from "./TreeStateContext";

const EMPTY_STORE = createStore(() => ({ setHeaders: (_headers: GameHeaders) => {} }));

function detail(value: string | null | undefined) {
  return value && !/^[?.]+$/.test(value) ? value : "";
}

function GameInfo({
  headers,
  simplified,
  changeTitle,
}: {
  headers: GameHeaders;
  simplified?: boolean;
  changeTitle?: (title: string) => void;
}) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext) || EMPTY_STORE;
  const disabled = store === EMPTY_STORE;
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const [player, setPlayer] = useState<"white" | "black" | null>(null);
  const event = detail(headers.event);
  const site = detail(headers.site);
  const roundValue = detail(headers.round?.trim());
  const round = /^[-–—]+$/.test(roundValue) ? "" : roundValue;
  const date = detail(headers.date);
  const parsedDate =
    date && dayjs(date, "YYYY.MM.DD").isValid() ? dayjs(date, "YYYY.MM.DD").toDate() : null;
  const siteName = site.startsWith("https://lichess.org/")
    ? "Lichess"
    : site.startsWith("https://www.chess.com/")
      ? "Chess.com"
      : undefined;

  const eventField = disabled ? (
    <Text size="sm" fw={500} className={classes.event}>
      {event}
    </Text>
  ) : (
    <input
      className={cx(classes.input, classes.event)}
      value={event}
      placeholder={simplified ? "Enter Opening Title" : "Unknown Event"}
      onChange={(e) => {
        setHeaders({ ...headers, event: e.currentTarget.value });
        changeTitle?.(e.currentTarget.value);
      }}
    />
  );

  const roundField = round && (
    <span className={classes.round}>
      <span>Round</span>
      {disabled ? (
        <span>{round}</span>
      ) : (
        <input
          className={cx(classes.input, classes.roundInput)}
          placeholder="?"
          value={round}
          onChange={(e) => setHeaders({ ...headers, round: e.currentTarget.value })}
        />
      )}
    </span>
  );

  if (simplified) {
    return (
      <Box className={classes.header}>
        <Group gap="xs">
          {eventField}
          {round && roundField}
        </Group>
        <Group gap={4}>
          <Text size="sm">{t("GameInfo.OpeningFor")}</Text>
          <Select
            allowDeselect={false}
            readOnly={disabled}
            value={headers.orientation || "white"}
            variant="unstyled"
            rightSection={null}
            rightSectionWidth={0}
            fw="bold"
            styles={{ input: { textDecoration: "underline" } }}
            onChange={(value) =>
              setHeaders({ ...headers, orientation: value === "white" ? "white" : "black" })
            }
            data={[
              { value: "white", label: t("Fen.White") },
              { value: "black", label: t("Fen.Black") },
            ]}
          />
        </Group>
      </Box>
    );
  }

  return (
    <Box className={cx(classes.header, classes.gameHeader)}>
      {player && (
        <FideInfo
          opened
          setOpened={(opened) => !opened && setPlayer(null)}
          name={headers[player]}
        />
      )}
      <div className={classes.matchup}>
        {(["white", "black"] as const).map((color) => {
          const label = color === "white" ? t("Fen.White") : t("Fen.Black");
          const rating = headers[`${color}_elo`];
          return (
            <div key={color} className={classes.player} data-color={color}>
              <UnstyledButton className={classes.playerLabel} onClick={() => setPlayer(color)}>
                {label}
              </UnstyledButton>
              {disabled ? (
                <UnstyledButton className={classes.name} onClick={() => setPlayer(color)}>
                  {detail(headers[color]) || t("Common.Unknown")}
                </UnstyledButton>
              ) : (
                <input
                  className={cx(classes.input, classes.name)}
                  placeholder={t("Common.Unknown")}
                  value={headers[color]}
                  onChange={(e) => setHeaders({ ...headers, [color]: e.currentTarget.value })}
                />
              )}
              {disabled ? (
                <Text size="xs" c="dimmed">
                  {rating === 0 ? "Unrated" : (rating ?? "—")}
                </Text>
              ) : (
                <input
                  className={cx(classes.input, classes.rating)}
                  placeholder="Unknown ELO"
                  value={rating === 0 ? "Unrated" : (rating ?? "")}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setHeaders({
                      ...headers,
                      [`${color}_elo`]:
                        value.toLowerCase() === "unrated" || value === "-"
                          ? 0
                          : value === "" || Number.isNaN(Number.parseInt(value))
                            ? undefined
                            : Number.parseInt(value),
                    });
                  }}
                />
              )}
            </div>
          );
        })}
        <div className={classes.result} data-editable={!disabled || undefined}>
          {disabled ? (
            <Text fw={600}>
              {headers.result === "1/2-1/2" ? "½–½" : headers.result.replace("-", "–")}
            </Text>
          ) : (
            <Select
              size="xs"
              w="4rem"
              comboboxProps={{ width: 128, position: "bottom", offset: 4 }}
              checkIconPosition="right"
              allowDeselect={false}
              data={[
                { value: "1-0", label: "1–0" },
                { value: "0-1", label: "0–1" },
                { value: "1/2-1/2", label: "½–½" },
                { value: "*", label: "*" },
              ]}
              value={headers.result}
              variant="unstyled"
              rightSection={null}
              rightSectionWidth={0}
              classNames={{
                input: cx(classes.input, classes.resultInput),
                option: classes.resultOption,
              }}
              onChange={(result) => setHeaders({ ...headers, result: result as Outcome })}
            />
          )}
        </div>
      </div>
      {(!disabled || event || site || date || round) && (
        <div className={classes.details}>
          <div className={classes.eventRow}>
            {(!disabled || event) && eventField}
            {roundField}
          </div>
          <div className={classes.metadata}>
            {disabled ? (
              site &&
              (siteName ? (
                <a href={site} target="_blank" rel="noreferrer">
                  {siteName}
                </a>
              ) : (
                <span>{site}</span>
              ))
            ) : (
              <input
                className={cx(classes.input, classes.site)}
                value={site}
                placeholder="Unknown Site"
                onChange={(e) => setHeaders({ ...headers, site: e.currentTarget.value })}
              />
            )}
            {disabled ? (
              date && <span>{date}</span>
            ) : (
              <DateInput
                w="6rem"
                size="xs"
                variant="unstyled"
                valueFormat="YYYY.MM.DD"
                placeholder="????.??.??"
                value={parsedDate}
                allowDeselect
                onChange={(value) =>
                  setHeaders({
                    ...headers,
                    date: value ? dayjs(value).format("YYYY.MM.DD") : undefined,
                  })
                }
              />
            )}
          </div>
        </div>
      )}
    </Box>
  );
}

export default memo(GameInfo);
