import { ActionIcon, Text, Tooltip } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { IconPlayerPlay } from "@tabler/icons-react";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NormalizedGame } from "@/bindings";
import ReplayTrainingModal from "@/components/boards/ReplayTrainingModal";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { createTab } from "@/utils/tabs";

function GamesTable({
  games,
  loading,
  databasePath,
}: {
  games: NormalizedGame[];
  loading: boolean;
  databasePath?: string | null;
}) {
  const { t } = useTranslation();
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const [page, setPage] = useState(1);
  const [trainingGame, setTrainingGame] = useState<NormalizedGame | null>(null);
  const filteredGames = games.slice((page - 1) * 20, page * 20);

  useEffect(() => {
    setPage(1);
  }, [games]);

  const navigate = useNavigate();
  return (
    <>
      <DataTable
        withTableBorder
        highlightOnHover
        records={filteredGames}
        fetching={loading}
        totalRecords={games.length}
        recordsPerPage={20}
        page={page}
        onPageChange={setPage}
        onRowClick={(e) => {
          const game = e.record;
          createTab({
            tab: {
              name: `${game.white} - ${game.black}`,
              type: "analysis",
            },
            setTabs,
            setActiveTab,
            pgn: game.moves,
            headers: game,
            gameOrigin: databasePath
              ? {
                  kind: "database",
                  database: databasePath,
                  gameId: game.id,
                }
              : undefined,
          });
          navigate({ to: "/" });
        }}
        columns={[
          {
            accessor: "white",
            render: ({ white, white_elo }) => (
              <div>
                <Text size="sm" fw={500}>
                  {white}
                </Text>
                <Text size="xs" c="dimmed">
                  {white_elo === 0 ? "Unrated" : white_elo}
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
                  {black_elo === 0 ? "Unrated" : black_elo}
                </Text>
              </div>
            ),
          },
          { accessor: "date" },
          { accessor: "result" },
          { accessor: "ply_count" },
          {
            accessor: "train",
            title: "",
            textAlign: "right",
            width: 60,
            render: (game) => (
              <Tooltip label={t("Board.Database.Train", "Train")}>
                <ActionIcon
                  variant="subtle"
                  aria-label={t("Board.Database.Train", "Train")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTrainingGame(game);
                  }}
                >
                  <IconPlayerPlay size="1rem" />
                </ActionIcon>
              </Tooltip>
            ),
          },
        ]}
        noRecordsText="No games found"
      />
      <ReplayTrainingModal
        opened={trainingGame !== null}
        setOpened={(o) => {
          if (!o) {
            setTrainingGame(null);
          }
        }}
        game={trainingGame}
      />
    </>
  );
}

export default memo(GamesTable);
