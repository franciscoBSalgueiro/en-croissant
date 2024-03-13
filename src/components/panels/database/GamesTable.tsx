import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import type { NormalizedGame } from "@/utils/db";
import { createTab } from "@/utils/tabs";
import { ActionIcon, Text, useMantineTheme } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo } from "react";
import { useNavigate } from "react-router-dom";

function GamesTable({
  games,
  loading,
}: {
  games: NormalizedGame[];
  loading: boolean;
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const theme = useMantineTheme();
  const navigate = useNavigate();
  return (
    <DataTable
      withTableBorder
      highlightOnHover
      records={games}
      fetching={loading}
      columns={[
        {
          accessor: "actions",
          title: "",
          render: (game) => (
            <ActionIcon
              variant="subtle"
              color={theme.primaryColor}
              onClick={() => {
                createTab({
                  tab: {
                    name: `${game.white} - ${game.black}`,
                    type: "analysis",
                  },
                  setTabs,
                  setActiveTab,
                  pgn: game.moves,
                  headers: game,
                });
                navigate("/");
              }}
            >
              <IconEye size="1rem" stroke={1.5} />
            </ActionIcon>
          ),
        },
        {
          accessor: "white",
          render: ({ white, white_elo }) => (
            <div>
              <Text size="sm" fw={500}>
                {white}
              </Text>
              <Text size="xs" c="dimmed">
                {white_elo}
              </Text>
            </div>
          ),
        },
        {
          accessor: "black",
          render: ({ black, black_elo }) => (
            <div>
              <Text size="sm" fw={500}>
                {black}
              </Text>
              <Text size="xs" c="dimmed">
                {black_elo}
              </Text>
            </div>
          ),
        },
        { accessor: "date" },
        { accessor: "result" },
        { accessor: "ply_count" },
      ]}
      noRecordsText="No games found"
    />
  );
}

export default memo(GamesTable);
