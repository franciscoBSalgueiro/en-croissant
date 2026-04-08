import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Group,
  InputWrapper,
  RangeSlider,
  Select,
  SimpleGrid,
  Stack,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { IconDotsVertical, IconSearch } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import type { GameQuery, Outcome, Sides } from "@/bindings";
import { EventSearchInput } from "./EventSearchInput";
import { PlayerSearchInput } from "./PlayerSearchInput";
import { ScoutfishQueryModal } from "./ScoutfishQueryModal";
import { SideInput } from "./SideInput";

export interface GameFiltersProps {
  query: GameQuery;
  setQuery: (query: GameQuery) => void;
  file: string;
  hidePositionSearch?: boolean;
  alwaysExpanded?: boolean;
}

export function GameFilters({
  query,
  setQuery,
  file,
  hidePositionSearch,
  alwaysExpanded,
}: GameFiltersProps) {
  const { t } = useTranslation();
  const [advancedSearchOpened, { open: openAdvancedSearch, close: closeAdvancedSearch }] =
    useDisclosure(false);
  const [advancedExpanded, { toggle: toggleAdvanced }] = useDisclosure(false);

  const hasScoutfishQuery = query.position?.type_ === "scoutfish";

  return (
    <Stack gap="sm">
      <Group align="flex-end" wrap="nowrap">
        <SimpleGrid cols={{ base: 1, md: 2 }} style={{ flex: 1 }}>
          <PlayerSearchInput
            label={t("Databases.Player.One")}
            value={query?.player1 ?? undefined}
            setValue={(value) => setQuery({ ...query, player1: value })}
            rightSection={
              <SideInput
                sides={query.sides || "WhiteBlack"}
                setSides={(value) => setQuery({ ...query, sides: value as Sides })}
                label={t("Board.Database.Local.Player")}
              />
            }
            file={file}
          />
          <PlayerSearchInput
            label={t("Databases.Player.Two")}
            value={query?.player2 ?? undefined}
            setValue={(value) => setQuery({ ...query, player2: value })}
            rightSection={
              <SideInput
                sides={query.sides || "WhiteBlack"}
                setSides={(value) => setQuery({ ...query, sides: value as Sides })}
                label={t("Databases.Game.Filters.Opponent")}
              />
            }
            file={file}
          />
        </SimpleGrid>

        {!alwaysExpanded && (
          <ActionIcon
            variant="default"
            size={36}
            onClick={toggleAdvanced}
            aria-label={t("Databases.Game.Filters.ToggleAdvanced")}
          >
            <IconDotsVertical size="1.2rem" />
          </ActionIcon>
        )}
      </Group>

      <Collapse in={alwaysExpanded || advancedExpanded}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
            <InputWrapper label={t("Databases.Game.Filters.PlayerOneElo")}>
              <RangeSlider
                step={10}
                min={0}
                max={3000}
                marks={[
                  { value: 1000, label: "1k" },
                  { value: 2000, label: "2k" },
                  { value: 3000, label: "3k" },
                ]}
                value={query.range1 ?? undefined}
                onChangeEnd={(value) => setQuery({ ...query, range1: value as [number, number] })}
              />
            </InputWrapper>
            <InputWrapper label={t("Databases.Game.Filters.PlayerTwoElo")}>
              <RangeSlider
                step={10}
                min={0}
                max={3000}
                marks={[
                  { value: 1000, label: "1k" },
                  { value: 2000, label: "2k" },
                  { value: 3000, label: "3k" },
                ]}
                value={query.range2 ?? undefined}
                onChangeEnd={(value) => setQuery({ ...query, range2: value as [number, number] })}
              />
            </InputWrapper>
          </SimpleGrid>

          <EventSearchInput
            label={t("Databases.Game.Filters.TournamentEvent")}
            value={query.tournament ?? undefined}
            setValue={(value) => setQuery({ ...query, tournament: value })}
            file={file}
          />
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <DateInput
              label={t("Common.From")}
              placeholder={t("Common.StartDate")}
              clearable
              valueFormat="YYYY-MM-DD"
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
              placeholder={t("Common.EndDate")}
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

          <Select
            label={t("Board.Database.Local.Result")}
            value={query.outcome ?? query.wanted_result}
            onChange={(value) =>
              setQuery({
                ...query,
                outcome: (value as Outcome | null) ?? undefined,
                wanted_result: undefined,
              })
            }
            clearable
            placeholder={t("Common.PickValue")}
            data={[
              { label: t("Board.Analysis.Tablebase.WhiteWins"), value: "1-0" },
              { label: t("Board.Analysis.Tablebase.BlackWins"), value: "0-1" },
              { label: t("Board.Analysis.Tablebase.Draw"), value: "1/2-1/2" },
            ]}
          />

          {!hidePositionSearch && (
            <>
              {hasScoutfishQuery && (
                <Badge
                  color="blue"
                  variant="light"
                  size="lg"
                  style={{ cursor: "pointer" }}
                  onClick={openAdvancedSearch}
                >
                  {t("Databases.Game.Filters.ScoutfishActive")}
                </Badge>
              )}

              <Button
                variant="light"
                leftSection={<IconSearch size="1rem" />}
                onClick={openAdvancedSearch}
              >
                {t("Databases.Game.Filters.AdvancedScoutfishSearch")}
              </Button>
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
            </>
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}
