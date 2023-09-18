import { tabsAtom, activeTabAtom } from "@/atoms/atoms";
import { NormalizedGame } from "@/utils/db";
import { createTab } from "@/utils/tabs";
import { useMantineTheme, ActionIcon, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo } from "react";
import { useNavigate } from "react-router-dom";

function GamesTable({
  games,
  height,
  loading,
}: {
  games: NormalizedGame[];
  height: number;
  loading: boolean;
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const theme = useMantineTheme();
  const navigate = useNavigate();
  return (
    <DataTable
      withBorder
      highlightOnHover
      height={height}
      records={games}
      fetching={loading}
      columns={[
        {
          accessor: "actions",
          title: "",
          render: (game) => (
            <ActionIcon
              variant="filled"
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
                navigate("/boards");
              }}
            >
              <IconEye size={16} stroke={1.5} />
            </ActionIcon>
          ),
        },
        {
          accessor: "white",
          render: ({ white, white_elo }) => (
            <div>
              <Text size="sm" weight={500}>
                {white}
              </Text>
              <Text size="xs" color="dimmed">
                {white_elo}
              </Text>
            </div>
          ),
        },
        {
          accessor: "black",
          render: ({ black, black_elo }) => (
            <div>
              <Text size="sm" weight={500}>
                {black}
              </Text>
              <Text size="xs" color="dimmed">
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
