import {
  Box,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useNavigate } from "@tanstack/react-router";
import type { Color } from "chessops";
import { useAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PlayerGameInfo } from "@/bindings";
import { commands, type GameOutcome } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import { createTab } from "@/utils/tabs";
import { getTimeControl } from "@/utils/timeControl";
import { countMainPly, defaultTree } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import classes from "./OpeningsPanel.module.css";
import cardClasses from "../PersonalCard.module.css";
import ResultsChart from "./ResultsChart";
import TimeControlSelector from "./TimeControlSelector";
import WebsiteAccountSelector from "./WebsiteAccountSelector";

type OpeningStats = {
  name: string;
  games: number;
  won: number;
  draw: number;
  lost: number;
};

function aggregateOpenings(
  data: { opening: string; result: GameOutcome; is_player_white: boolean }[],
  color: Color,
): OpeningStats[] {
  return Array.from(
    data
      .filter((d) => d.is_player_white === (color === "white"))
      .reduce((acc, d) => {
        const prev = acc.get(d.opening) ?? {
          won: 0,
          draw: 0,
          lost: 0,
          total: 0,
        };
        acc.set(d.opening, {
          won: prev.won + (d.result === "Won" ? 1 : 0),
          draw: prev.draw + (d.result === "Drawn" ? 1 : 0),
          lost: prev.lost + (d.result === "Lost" ? 1 : 0),
          total: prev.total + 1,
        });
        return acc;
      }, new Map()),
  )
    .map(([name, { won, draw, lost, total }]) => ({
      name,
      games: total,
      won,
      draw,
      lost,
    }))
    .sort((a, b) => b.games - a.games);
}

function OpeningsPanel({
  playerName,
  info,
  isDatabase,
}: {
  playerName: string;
  info: PlayerGameInfo;
  isDatabase?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [website, setWebsite] = useState<string | null>("All websites");
  const [account, setAccount] = useState<string | null>("All accounts");
  const [timeControl, setTimeControl] = useState<string | null>(null);
  const [color, setColor] = useState<Color>("white");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSortStatus<OpeningStats>>({
    columnAccessor: "games",
    direction: "desc",
  });

  const openingData =
    info?.site_stats_data
      .filter((d) => website === "All websites" || d.site === website)
      .filter((d) => account === "All accounts" || d.player === account)
      .flatMap((d) => d.data)
      .filter(
        (g) =>
          !timeControl ||
          timeControl === "any" ||
          getTimeControl(website!, g.time_control) === timeControl,
      )
      .map((g) => ({
        opening: g.opening,
        result: g.result,
        is_player_white: g.is_player_white,
      })) ?? [];

  const totalGames = openingData.filter(
    (game) => game.is_player_white === (color === "white"),
  ).length;
  const openings = aggregateOpenings(openingData, color)
    .filter((opening) => opening.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const comparison =
        sort.columnAccessor === "name" ? a.name.localeCompare(b.name) : a.games - b.games;
      return sort.direction === "asc" ? comparison : -comparison;
    });
  const pages = Math.max(1, Math.ceil(openings.length / 10));
  const currentPage = Math.min(page, pages);

  return (
    <Stack gap="md" h="100%" style={{ minHeight: 0 }}>
      {!isDatabase && (
        <Group grow>
          <WebsiteAccountSelector
            playerName={playerName}
            onWebsiteChange={(website) => {
              setWebsite(website);
            }}
            onAccountChange={setAccount}
            allowAll={true}
          />
        </Group>
      )}
      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          value={color}
          onChange={(value) => {
            setColor(value as Color);
            setPage(1);
          }}
          data={[
            { value: "white", label: t("Home.Personal.AsWhite") },
            { value: "black", label: t("Home.Personal.AsBlack") },
          ]}
        />
        <TimeControlSelector
          website={website}
          onTimeControlChange={(value) => {
            setTimeControl(value);
            setPage(1);
          }}
          allowAll={true}
          showLabel={false}
        />
        <TextInput
          className={cardClasses.search}
          placeholder={t("Home.Personal.SearchOpening")}
          aria-label={t("Home.Personal.SearchOpening")}
          leftSection={<IconSearch size={18} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
        />
      </Group>
      <Box flex={1} style={{ minHeight: 0 }}>
        <DataTable<OpeningStats>
          height="100%"
          withTableBorder
          highlightOnHover
          idAccessor="name"
          records={openings.slice((currentPage - 1) * 10, currentPage * 10)}
          columns={[
            {
              accessor: "name",
              title: t("Home.Personal.Opening"),
              sortable: true,
              render: (opening) => <OpeningDetail opening={opening} color={color} />,
            },
            {
              accessor: "games",
              title: t("Common.Games"),
              sortable: true,
              textAlign: "right",
              render: (opening) => opening.games.toLocaleString(i18n.resolvedLanguage),
            },
            {
              accessor: "played",
              title: t("Home.Personal.Played"),
              textAlign: "right",
              render: (opening) =>
                `${(totalGames ? (opening.games / totalGames) * 100 : 0).toFixed(1)}%`,
            },
            {
              accessor: "results",
              title: t("Board.Practice.Build.Results"),
              width: "24%",
              render: (opening) => (
                <ResultsChart
                  won={opening.won}
                  draw={opening.draw}
                  lost={opening.lost}
                  size="0.5rem"
                />
              ),
            },
          ]}
          sortStatus={sort}
          onSortStatusChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          totalRecords={openings.length}
          recordsPerPage={10}
          page={currentPage}
          onPageChange={setPage}
          paginationText={({ totalRecords }) =>
            t("Home.Personal.OpeningCount", {
              count: totalRecords,
              formattedCount: totalRecords.toLocaleString(i18n.resolvedLanguage),
            })
          }
          noRecordsText={t("Home.Personal.NoOpenings")}
        />
      </Box>
    </Stack>
  );
}

function OpeningDetail({ opening, color }: { opening: OpeningStats; color: Color }) {
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const navigate = useNavigate();

  return (
    <UnstyledButton
      w="100%"
      className={classes.link}
      onClick={async () => {
        const pgn = unwrap(await commands.getOpeningFromName(opening.name));
        const headers = defaultTree().headers;
        const tree = await parsePGN(pgn);
        headers.orientation = color;
        await createTab({
          tab: { name: opening.name, type: "analysis" },
          pgn,
          headers,
          setTabs,
          setActiveTab,
          position: Array(countMainPly(tree.root)).fill(0),
        });
        navigate({ to: "/" });
      }}
    >
      <Text size="sm" lineClamp={2}>
        {opening.name}
      </Text>
    </UnstyledButton>
  );
}

export default OpeningsPanel;
