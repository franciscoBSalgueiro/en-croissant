import { Text, UnstyledButton } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo, useEffect, useState } from "react";
import type { NormalizedGame } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { createTab } from "@/utils/tabs";
import PlayerReportModal from "./PlayerReportModal";

function PlayerCell({
  name,
  elo,
  clickable,
  onClick,
}: {
  name: string;
  elo?: number | null;
  clickable: boolean;
  onClick: () => void;
}) {
  const rating = elo === 0 ? "Unrated" : elo;
  if (!clickable) {
    return (
      <div>
        <Text size="sm" fw={500}>
          {name}
        </Text>
        <Text size="xs" c="dimmed">
          {rating}
        </Text>
      </div>
    );
  }
  return (
    <UnstyledButton
      onClick={(event) => {
        // The table row is also clickable (opens the game in a new tab).
        // Keep a player-name click from triggering that navigation too.
        event.stopPropagation();
        onClick();
      }}
    >
      <Text size="sm" fw={500} c="blue">
        {name}
      </Text>
      <Text size="xs" c="dimmed">
        {rating}
      </Text>
    </UnstyledButton>
  );
}

function GamesTable({
  games,
  loading,
  databasePath,
  onPlayerClick,
}: {
  games: NormalizedGame[];
  loading: boolean;
  databasePath?: string | null;
  onPlayerClick?: (playerId: number, name: string) => void;
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const [page, setPage] = useState(1);
  const [reportPlayer, setReportPlayer] = useState<{ id: number; name: string } | null>(null);
  const filteredGames = games.slice((page - 1) * 20, page * 20);

  useEffect(() => {
    setPage(1);
  }, [games]);

  const playerNamesClickable = onPlayerClick !== undefined || !!databasePath;

  function handlePlayerClick(playerId: number, name: string) {
    if (onPlayerClick) {
      onPlayerClick(playerId, name);
      return;
    }
    if (databasePath) {
      setReportPlayer({ id: playerId, name });
    }
  }

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
            render: ({ white, white_id, white_elo }) => (
              <PlayerCell
                name={white}
                elo={white_elo}
                clickable={playerNamesClickable}
                onClick={() => handlePlayerClick(white_id, white)}
              />
            ),
          },
          {
            accessor: "black",
            render: ({ black, black_id, black_elo }) => (
              <PlayerCell
                name={black}
                elo={black_elo}
                clickable={playerNamesClickable}
                onClick={() => handlePlayerClick(black_id, black)}
              />
            ),
          },
          { accessor: "date" },
          { accessor: "result" },
          { accessor: "ply_count" },
        ]}
        noRecordsText="No games found"
      />
      {reportPlayer && databasePath ? (
        <PlayerReportModal
          opened
          onClose={() => setReportPlayer(null)}
          file={databasePath}
          playerId={reportPlayer.id}
          playerName={reportPlayer.name}
        />
      ) : null}
    </>
  );
}

export default memo(GamesTable);
