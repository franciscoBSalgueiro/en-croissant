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
  TextInput,
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
            label="Player 1"
            value={query?.player1 ?? undefined}
            setValue={(value) => setQuery({ ...query, player1: value })}
            rightSection={
              <SideInput
                sides={query.sides || "WhiteBlack"}
                setSides={(value) => setQuery({ ...query, sides: value as Sides })}
                label="Player"
              />
            }
            file={file}
          />
          <PlayerSearchInput
            label="Player 2"
            value={query?.player2 ?? undefined}
            setValue={(value) => setQuery({ ...query, player2: value })}
            rightSection={
              <SideInput
                sides={query.sides || "WhiteBlack"}
                setSides={(value) => setQuery({ ...query, sides: value as Sides })}
                label="Opponent"
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
            aria-label="Toggle advanced filters"
          >
            <IconDotsVertical size="1.2rem" />
          </ActionIcon>
        )}
      </Group>

      <Collapse in={alwaysExpanded || advancedExpanded}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <InputWrapper label="Player 1 ELO">
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
            <InputWrapper label="Player 2 ELO">
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
            label="Tournament / Event"
            value={query.tournament ?? undefined}
            setValue={(value) => setQuery({ ...query, tournament: value })}
            file={file}
          />
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <DateInput
              label="From"
              placeholder="Start date"
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
              label="To"
              placeholder="End date"
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
            label="Game Result"
            value={query.outcome ?? query.wanted_result}
            onChange={(value) =>
              setQuery({
                ...query,
                outcome: (value as Outcome | null) ?? undefined,
                wanted_result: undefined,
              })
            }
            clearable
            placeholder="Select result"
            data={[
              { label: "White wins", value: "1-0" },
              { label: "Black wins", value: "0-1" },
              { label: "Draw", value: "1/2-1/2" },
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
                  Scoutfish query active
                </Badge>
              )}

              <Button
                variant="light"
                leftSection={<IconSearch size="1rem" />}
                onClick={openAdvancedSearch}
              >
                Advanced Scoutfish Search
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
