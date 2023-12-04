import { ActionIcon, Group, Text, clsx, createStyles } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect } from "react";
import InfiniteLoader from "react-window-infinite-loader";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
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
  function isRowLoaded(index: number) {
    return games.has(index);
  }

  const loadMoreRows = useCallback(
    async (startIndex: number, stopIndex: number) => {
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
      loadMoreRows(0, 10);
    }
  }, [games.size, loadMoreRows]);

  return (
    <AutoSizer disableHeight>
      {({ width }) => (
        <InfiniteLoader
          loadMoreItems={loadMoreRows}
          itemCount={total}
          isItemLoaded={isRowLoaded}
        >
          {({ onItemsRendered, ref }) => (
            <FixedSizeList
              width={width}
              height={height}
              itemSize={30}
              itemCount={total}
              ref={ref}
              onItemsRendered={onItemsRendered}
            >
              {({ index, style }) => (
                <GameRow
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
            </FixedSizeList>
          )}
        </InfiniteLoader>
      )}
    </AutoSizer>
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
        className={clsx(classes.row, {
          [classes.active]: index === activePage,
        })}
      >
        <Text
          fz="sm"
          truncate
          maw={600}
          onClick={() => {
            console.log(index);
            setPracticing(false);
            setPage(index);
          }}
          sx={{ flex: 1 }}
        >
          {formatNumber(index + 1)}. {game}
        </Text>
        {deleteGame && (
          <Group>
            <ActionIcon
              onClick={() => toggleDelete()}
              variant="outline"
              color="red"
              size="1rem"
            >
              <IconX />
            </ActionIcon>
          </Group>
        )}
      </Group>
    </>
  );
}
