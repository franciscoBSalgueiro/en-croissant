import {
  Button,
  Group,
  InputWrapper,
  Menu,
  Popover,
  RangeSlider,
  type RangeSliderProps,
  Select,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure, useUncontrolled } from "@mantine/hooks";
import { IconCheck, IconChevronDown, IconSearch, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { GameQuery, Outcome, Sides } from "@/bindings";
import { EventSearchInput } from "./EventSearchInput";
import { PlayerSearchInput } from "./PlayerSearchInput";
import { ScoutfishQueryModal } from "./ScoutfishQueryModal";
import { SideInput } from "./SideInput";
import classes from "./GameFilters.module.css";

function RatingSlider({ value = [0, 3000], ...props }: RangeSliderProps) {
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);
  if (value[0] !== committed[0] || value[1] !== committed[1]) {
    setCommitted(value);
    setDraft(value);
  }
  return <RangeSlider {...props} value={draft} onChange={setDraft} />;
}

function FilterDropdown({
  label,
  active,
  summary,
  onClear,
  opened: controlledOpened,
  onChange,
  children,
}: {
  label: string;
  active: boolean;
  summary?: string;
  onClear: () => void;
  opened?: boolean;
  onChange?: (opened: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useUncontrolled({
    value: controlledOpened,
    defaultValue: false,
    onChange,
  });
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={340}
      shadow="md"
      trapFocus={false}
      returnFocus
      withinPortal
    >
      <Popover.Target>
        <UnstyledButton
          className={classes.filter}
          data-active={active || undefined}
          data-opened={opened || undefined}
          onClick={() => setOpened(!opened)}
          aria-expanded={opened}
          aria-label={summary ? `${label}: ${summary}` : label}
          title={summary ? `${label}: ${summary}` : label}
        >
          <span className={classes.label}>
            {label}
            {summary && <span className={classes.summary}>{summary}</span>}
          </span>
          <IconChevronDown size={14} stroke={1.5} className={classes.chevron} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown style={{ maxWidth: "calc(100vw - 32px)" }}>
        <Stack gap="sm">
          {active && (
            <Group justify="flex-end">
              <Button variant="subtle" size="compact-xs" onClick={onClear}>
                {t("Databases.Game.Filters.Clear", { defaultValue: "Clear filters" })}
              </Button>
            </Group>
          )}
          {children}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export interface GameFiltersProps {
  query: GameQuery;
  setQuery: (query: GameQuery) => void;
  file: string;
  hidePositionSearch?: boolean;
  alwaysExpanded?: boolean;
  totalCount?: number;
  matchingCount?: number;
  loading?: boolean;
  actions?: ReactNode;
}

export function GameFilters({
  query,
  setQuery: updateQuery,
  file,
  hidePositionSearch,
  alwaysExpanded,
  totalCount,
  matchingCount,
  loading,
  actions,
}: GameFiltersProps) {
  const { t } = useTranslation();
  const [advancedSearchOpened, { open: openAdvancedSearchModal, close: closeAdvancedSearch }] =
    useDisclosure(false);
  const [positionFilterOpened, setPositionFilterOpened] = useState(false);
  const openAdvancedSearch = () => {
    setPositionFilterOpened(false);
    openAdvancedSearchModal();
  };
  const [resultMenuOpened, setResultMenuOpened] = useState(false);
  const setQuery = (next: GameQuery) =>
    updateQuery({ ...next, options: next.options ? { ...next.options, page: 1 } : next.options });
  const hasScoutfishQuery = query.position?.type_ === "scoutfish";
  const playersActive = !!(
    query.player1 ||
    query.player2 ||
    (query.sides && query.sides !== "WhiteBlack")
  );
  const ratingsActive = [query.range1, query.range2].some(
    (range) => range && (range[0] !== 0 || range[1] !== 3000),
  );
  const hasFilters =
    playersActive ||
    ratingsActive ||
    !!(
      query.tournament ||
      query.start_date ||
      query.end_date ||
      query.outcome ||
      query.wanted_result ||
      query.position
    );

  const players = (
    <SimpleGrid cols={alwaysExpanded ? { base: 1, md: 2 } : 1} style={{ flex: 1 }}>
      <PlayerSearchInput
        label={t("Databases.Player.One")}
        value={query?.player1 ?? undefined}
        setValue={(value) => setQuery({ ...query, player1: value })}
        rightSection={
          <SideInput
            player={1}
            sides={query.sides || "WhiteBlack"}
            setSides={(value) => setQuery({ ...query, sides: value as Sides })}
            label={t("Board.Database.Local.Player")}
          />
        }
        withinPortal={false}
        file={file}
      />
      <PlayerSearchInput
        label={t("Databases.Player.Two")}
        value={query?.player2 ?? undefined}
        setValue={(value) => setQuery({ ...query, player2: value })}
        rightSection={
          <SideInput
            player={2}
            sides={query.sides || "WhiteBlack"}
            setSides={(value) => setQuery({ ...query, sides: value as Sides })}
            label={t("Databases.Game.Filters.Opponent")}
          />
        }
        withinPortal={false}
        file={file}
      />
    </SimpleGrid>
  );
  const ratings = (
    <SimpleGrid cols={alwaysExpanded ? { base: 1, md: 2 } : 1} mb="md" spacing="xl">
      <InputWrapper label={t("Databases.Game.Filters.PlayerOneElo")}>
        <RatingSlider
          step={10}
          min={0}
          max={3000}
          marks={[
            { value: 1000, label: "1k" },
            { value: 2000, label: "2k" },
            { value: 3000, label: "3k" },
          ]}
          value={query.range1 ?? [0, 3000]}
          thumbFromLabel={`${t("Databases.Game.Filters.PlayerOneElo")} — ${t("Common.From")}`}
          thumbToLabel={`${t("Databases.Game.Filters.PlayerOneElo")} — ${t("Common.To")}`}
          onChangeEnd={(value) => setQuery({ ...query, range1: value as [number, number] })}
        />
      </InputWrapper>
      <InputWrapper label={t("Databases.Game.Filters.PlayerTwoElo")}>
        <RatingSlider
          step={10}
          min={0}
          max={3000}
          marks={[
            { value: 1000, label: "1k" },
            { value: 2000, label: "2k" },
            { value: 3000, label: "3k" },
          ]}
          value={query.range2 ?? [0, 3000]}
          thumbFromLabel={`${t("Databases.Game.Filters.PlayerTwoElo")} — ${t("Common.From")}`}
          thumbToLabel={`${t("Databases.Game.Filters.PlayerTwoElo")} — ${t("Common.To")}`}
          onChangeEnd={(value) => setQuery({ ...query, range2: value as [number, number] })}
        />
      </InputWrapper>
    </SimpleGrid>
  );
  const event = (
    <EventSearchInput
      label={t("Databases.Game.Filters.TournamentEvent")}
      value={query.tournament ?? undefined}
      setValue={(value) => setQuery({ ...query, tournament: value })}
      withinPortal={false}
      file={file}
    />
  );
  const dates = (
    <SimpleGrid cols={alwaysExpanded ? { base: 1, md: 2 } : 2} spacing="xs">
      <DateInput
        label={t("Common.From")}
        placeholder="YYYY-MM-DD"
        popoverProps={{ withinPortal: false }}
        clearable
        valueFormat="YYYY-MM-DD"
        maxDate={query.end_date ? dayjs(query.end_date, "YYYY.MM.DD").toDate() : undefined}
        value={query.start_date ? dayjs(query.start_date, "YYYY.MM.DD").toDate() : null}
        onChange={(value) =>
          setQuery({
            ...query,
            start_date: value ? dayjs(value).format("YYYY.MM.DD") : undefined,
          })
        }
      />
      <DateInput
        label={t("Common.To")}
        placeholder="YYYY-MM-DD"
        minDate={query.start_date ? dayjs(query.start_date, "YYYY.MM.DD").toDate() : undefined}
        popoverProps={{ withinPortal: false }}
        clearable
        valueFormat="YYYY-MM-DD"
        value={query.end_date ? dayjs(query.end_date, "YYYY.MM.DD").toDate() : null}
        onChange={(value) =>
          setQuery({
            ...query,
            end_date: value ? dayjs(value).format("YYYY.MM.DD") : undefined,
          })
        }
      />
    </SimpleGrid>
  );
  const selectedResult = query.outcome ?? query.wanted_result;
  const resultOptions = [
    { label: t("Board.Database.Local.Result.Any"), value: "" },
    { label: t("Board.Analysis.Tablebase.WhiteWins"), value: "1-0" },
    { label: t("Board.Analysis.Tablebase.BlackWins"), value: "0-1" },
    { label: t("Board.Analysis.Tablebase.Draw"), value: "1/2-1/2" },
  ];
  const setResult = (value: string | null) =>
    setQuery({
      ...query,
      outcome: (value as Outcome | null) || undefined,
      wanted_result: undefined,
    });
  const result = (
    <Select
      label={t("Board.Database.Local.Result")}
      value={selectedResult}
      onChange={setResult}
      comboboxProps={{ withinPortal: false }}
      clearable
      placeholder={t("Common.PickValue")}
      data={resultOptions.slice(1)}
    />
  );
  const position = (
    <Stack gap="sm">
      {hasScoutfishQuery && (
        <Group justify="space-between" gap="xs">
          <Button color="blue" variant="light" size="compact-sm" onClick={openAdvancedSearch}>
            {t("Databases.Game.Filters.ScoutfishActive")}
          </Button>
          {alwaysExpanded && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => setQuery({ ...query, position: undefined })}
            >
              {t("Common.Remove")}
            </Button>
          )}
        </Group>
      )}
      <Button variant="light" leftSection={<IconSearch size="1rem" />} onClick={openAdvancedSearch}>
        {t("Databases.Game.Filters.AdvancedScoutfishSearch")}
      </Button>
    </Stack>
  );
  return (
    <Stack gap="sm">
      {alwaysExpanded ? (
        <>
          {players}
          {ratings}
          {event}
          {dates}
          {result}
          {!hidePositionSearch && position}
        </>
      ) : (
        <>
          <Group gap={6} wrap="nowrap">
            <FilterDropdown
              label={t("Databases.Card.Players")}
              active={playersActive}
              summary={[query.player1, query.player2].filter(Boolean).join(" / ")}
              onClear={() =>
                setQuery({ ...query, player1: undefined, player2: undefined, sides: "WhiteBlack" })
              }
            >
              {players}
            </FilterDropdown>
            <FilterDropdown
              label={t("Board.Practice.Rating")}
              active={ratingsActive}
              summary={
                ratingsActive
                  ? [query.range1 ?? [0, 3000], query.range2 ?? [0, 3000]]
                      .map((range) => range.join("–"))
                      .join(" / ")
                  : undefined
              }
              onClear={() => setQuery({ ...query, range1: [0, 3000], range2: [0, 3000] })}
            >
              {ratings}
            </FilterDropdown>
            <FilterDropdown
              label={t("Databases.Settings.Events")}
              active={!!query.tournament}
              summary={query.tournament ?? undefined}
              onClear={() => setQuery({ ...query, tournament: undefined })}
            >
              {event}
            </FilterDropdown>
            <Menu
              opened={resultMenuOpened}
              onChange={setResultMenuOpened}
              position="bottom-start"
              width={200}
              shadow="md"
            >
              <Menu.Target>
                <UnstyledButton
                  className={classes.filter}
                  data-active={!!selectedResult || undefined}
                  data-opened={resultMenuOpened || undefined}
                  aria-label={
                    selectedResult
                      ? `${t("Board.Database.Local.Result")}: ${selectedResult}`
                      : t("Board.Database.Local.Result")
                  }
                  title={
                    selectedResult
                      ? `${t("Board.Database.Local.Result")}: ${selectedResult}`
                      : t("Board.Database.Local.Result")
                  }
                >
                  <span className={classes.label}>
                    {t("Board.Database.Local.Result")}
                    {selectedResult && <span className={classes.summary}>{selectedResult}</span>}
                  </span>
                  <IconChevronDown size={14} stroke={1.5} className={classes.chevron} />
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                {resultOptions.map(({ label, value }) => (
                  <Menu.Item
                    key={value}
                    role="menuitemradio"
                    aria-checked={(selectedResult || "") === value}
                    rightSection={
                      (selectedResult || "") === value ? <IconCheck size={14} /> : undefined
                    }
                    onClick={() => setResult(value)}
                  >
                    {label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <FilterDropdown
              label={t("Common.Date")}
              active={!!(query.start_date || query.end_date)}
              summary={
                query.start_date || query.end_date
                  ? `${query.start_date ?? "…"} – ${query.end_date ?? "…"}`
                  : undefined
              }
              onClear={() => setQuery({ ...query, start_date: undefined, end_date: undefined })}
            >
              {dates}
            </FilterDropdown>
            {!hidePositionSearch && (
              <FilterDropdown
                label={t("Databases.Game.Filters.Position", { defaultValue: "Position" })}
                opened={positionFilterOpened}
                onChange={setPositionFilterOpened}
                active={!!query.position}
                onClear={() => setQuery({ ...query, position: undefined })}
              >
                {position}
              </FilterDropdown>
            )}
          </Group>
          <Group justify="space-between" gap={8} mih={26}>
            <Text size="xs" c="dimmed" aria-live="polite" style={{ flexShrink: 0 }}>
              {totalCount?.toLocaleString() ?? "—"} {t("Common.Games").toLocaleLowerCase()}
              {hasFilters && (
                <>
                  {" "}
                  · {loading ? "…" : (matchingCount?.toLocaleString() ?? "—")}{" "}
                  {t("Databases.Game.Filters.Matching", { defaultValue: "matching" })}
                </>
              )}
            </Text>
            <Group gap={8} justify="flex-end">
              {hasFilters && (
                <UnstyledButton
                  className={classes.clear}
                  onClick={() =>
                    setQuery({
                      options: query.options,
                      range1: [0, 3000],
                      range2: [0, 3000],
                      sides: "WhiteBlack",
                    })
                  }
                >
                  {t("Databases.Game.Filters.Clear", { defaultValue: "Clear filters" })}
                  <IconX size={12} />
                </UnstyledButton>
              )}
              {actions}
            </Group>
          </Group>
        </>
      )}
      {!hidePositionSearch && (
        <ScoutfishQueryModal
          opened={advancedSearchOpened}
          onClose={closeAdvancedSearch}
          onApply={(queryJson) => {
            setQuery({
              ...query,
              position: {
                fen: queryJson,
                type_: "scoutfish",
              },
            });
          }}
        />
      )}
    </Stack>
  );
}
