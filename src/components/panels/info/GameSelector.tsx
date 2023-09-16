import { ActionIcon, Group, Text, createStyles } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect } from "react";
import { AutoSizer, InfiniteLoader, List } from "react-virtualized";
import { parsePGN } from "@/utils/chess";
import { read_games } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import { getGameName } from "@/utils/treeReducer";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useToggle } from "@mantine/hooks";
import { useSetAtom } from "jotai";
import { currentPracticingAtom } from "@/atoms/atoms";

export default function GameSelector({
  height,
  games,
  setGames,
  setPage,
  total,
  path,
  activePage,
  deleteGame,
}: {
  height: number;
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  setPage: (v: number) => void;
  total: number;
  path: string;
  activePage: number;
  deleteGame?: (index: number) => void;
}) {
  function isRowLoaded({ index }: { index: number }) {
    return games.has(index);
  }

  const loadMoreRows = useCallback(
    async ({
      startIndex,
      stopIndex,
    }: {
      startIndex: number;
      stopIndex: number;
    }) => {
      const data = await read_games(path, startIndex, stopIndex);
      const newGames = new Map(games);
      data.forEach(async (game, index) => {
        const { headers } = await parsePGN(game);
        newGames.set(startIndex + index, getGameName(headers));
      });
      setGames(newGames);
    },
    [games, path, setGames]
  );

  useEffect(() => {
    if (games.size === 0) {
      loadMoreRows({ startIndex: 0, stopIndex: 10 });
    }
  }, [games.size, loadMoreRows]);

  return (
    <InfiniteLoader
      isRowLoaded={isRowLoaded}
      loadMoreRows={loadMoreRows}
      rowCount={total}
    >
      {({ onRowsRendered, registerChild }) => (
        <AutoSizer>
          {({ width }) => (
            <List
              width={width}
              height={height}
              rowHeight={30}
              rowCount={total}
              ref={registerChild}
              onRowsRendered={onRowsRendered}
              rowRenderer={({ index, key, style }) => (
                <GameRow
                  key={key}
                  index={index}
                  game={games.get(index)}
                  style={style}
                  setGames={setGames}
                  setPage={setPage}
                  deleteGame={deleteGame}
                  activePage={activePage}
                  path={path}
                  total={total}
                />
              )}
            />
          )}
        </AutoSizer>
      )}
    </InfiniteLoader>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    padding: "0 10px",
    cursor: "pointer",
    borderBottom: `1px solid ${theme.colors.gray[7]}`,
    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[2],
    },
  },
  active: {
    backgroundColor: `${
      theme.colorScheme === "dark"
        ? theme.fn.rgba(theme.colors[theme.primaryColor][7], 0.3)
        : theme.colors[theme.primaryColor][0]
    } !important`,
  },
}));

function GameRow({
  style,
  index,
  game,
  setPage,
  activePage,
  deleteGame,
}: {
  style: React.CSSProperties;
  index: number;
  game: string | undefined;
  setGames: (v: Map<number, string>) => void;
  setPage: (v: number) => void;
  path: string;
  total: number;
  activePage: number;
  deleteGame?: (indxe: number) => void;
}) {
  const [deleteModal, toggleDelete] = useToggle();
  const { classes } = useStyles();
  const setPracticing = useSetAtom(currentPracticingAtom);

  return (
    <>
      {deleteGame && (
        <ConfirmModal
          title={"Remove game"}
          description={"Are you sure you want to remove this game?"}
          opened={deleteModal}
          onClose={toggleDelete}
          onConfirm={() => {
            deleteGame(index);
            toggleDelete();
          }}
        />
      )}
      <Group
        style={style}
        position="apart"
        pr="xl"
        className={
          classes.row + (index === activePage ? " " + classes.active : "")
        }
        onClick={() => {setPracticing(false); setPage(index)}}
      >
        <Text fz="sm">
          {formatNumber(index + 1)}. {game}
        </Text>
        {deleteGame && (
          <Group>
            <ActionIcon
              onClick={() => toggleDelete()}
              variant={"outline"}
              color="red"
              size={18}
            >
              <IconX />
            </ActionIcon>
          </Group>
        )}
      </Group>
    </>
  );
}
