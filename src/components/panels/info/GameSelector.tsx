import { Accordion, ActionIcon, Group, createStyles } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useCallback, useContext, useEffect } from "react";
import { AutoSizer, InfiniteLoader, List } from "react-virtualized";
import { parsePGN } from "@/utils/chess";
import { read_games } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import { GameHeaders, getGameName } from "@/utils/treeReducer";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { invoke } from "@/utils/misc";
import { useAtom, useAtomValue } from "jotai";
import { currentTabAtom } from "@/atoms/atoms";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useToggle } from "@mantine/hooks";

export default function GameSelector({
  headers,
  games,
  setGames,
}: {
  headers: GameHeaders;
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  function isRowLoaded({ index }: { index: number }) {
    return games.has(index);
  }

  const activeTab = useAtomValue(currentTabAtom);

  const activePage = activeTab?.gameNumber ?? 0;
  const total = activeTab?.file?.numGames ?? 0;

  const loadMoreRows = useCallback(
    async ({
      startIndex,
      stopIndex,
    }: {
      startIndex: number;
      stopIndex: number;
    }) => {
      if (!activeTab?.file) return;
      const data = await read_games(activeTab.file.path, startIndex, stopIndex);
      setGames((prev) => {
        const newGames = new Map(prev);
        data.forEach(async (game, index) => {
          const { headers } = await parsePGN(game);
          newGames.set(startIndex + index, getGameName(headers));
        });
        return newGames;
      });
    },
    [activeTab, setGames]
  );

  useEffect(() => {
    if (games.size === 0) {
      loadMoreRows({ startIndex: 0, stopIndex: 10 });
    }
  }, [games.size, loadMoreRows]);

  if (total < 2) return null;
  return (
    <>
      <Accordion>
        <Accordion.Item value="customization">
          <Accordion.Control>
            {formatNumber(activePage + 1)}. {getGameName(headers)}
          </Accordion.Control>
          <Accordion.Panel h={200} mb={20}>
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
                      height={200}
                      rowHeight={50}
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
                        />
                      )}
                    />
                  )}
                </AutoSizer>
              )}
            </InfiniteLoader>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    padding: "0 10px",
    cursor: "pointer",
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
  setGames,
}: {
  style: React.CSSProperties;
  index: number;
  game: string | undefined;
  setGames: (v: Map<number, string>) => void;
}) {
  const [activeTab, setActiveTab] = useAtom(currentTabAtom);
  const activePage = activeTab?.gameNumber ?? 0;
  const total = activeTab?.file?.numGames ?? 0;
  const [deleteModal, toggleDelete] = useToggle();
  const { classes } = useStyles();
  const dispatch = useContext(TreeDispatchContext);

  async function setPage(page: number) {
    setActiveTab((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gameNumber: page,
      };
    });

    const data = await read_games(activeTab!.file!.path, page, page);
    const tree = await parsePGN(data[0]);
    dispatch({
      type: "SET_STATE",
      payload: tree,
    });
  }

  return (
    <>
      <ConfirmModal
        title={"Remove game"}
        description={"Are you sure you want to remove this game?"}
        opened={deleteModal}
        onClose={toggleDelete}
        onConfirm={() => {
          invoke("delete_game", {
            file: activeTab?.file?.path,
            n: index,
          });
          setActiveTab((prev) => {
            if (!prev.file) return prev;
            prev.file.numGames = total - 1;
            return { ...prev };
          });
          setGames(new Map());
          toggleDelete();
        }}
      />
      <Group
        style={style}
        position="apart"
        pr="xl"
        className={
          classes.row + (index === activePage ? " " + classes.active : "")
        }
        onClick={() => setPage(index)}
      >
        {formatNumber(index + 1)}. {game}
        <Group>
          <ActionIcon
            onClick={() => toggleDelete()}
            variant={"outline"}
            color="red"
          >
            <IconX />
          </ActionIcon>
        </Group>
      </Group>
    </>
  );
}
