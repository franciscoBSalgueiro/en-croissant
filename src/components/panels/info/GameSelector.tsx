import { Accordion, ActionIcon, Group } from "@mantine/core";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import { useCallback, useContext, useEffect } from "react";
import { AutoSizer, InfiniteLoader, List } from "react-virtualized";
import { getPgnHeaders, parsePGN } from "@/utils/chess";
import { read_games } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import { GameHeaders } from "@/utils/treeReducer";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { invoke } from "@/utils/misc";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { currentTabAtom } from "@/atoms/atoms";
import { RESET, atomWithReset } from "jotai/utils";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useToggle } from "@mantine/hooks";

export const gamesAtom = atomWithReset<Map<number, string>>(new Map());

export default function GameSelector({ headers }: { headers: GameHeaders }) {
  const [games, setGames] = useAtom(gamesAtom);

  function isRowLoaded({ index }: { index: number }) {
    return games.has(index);
  }

  const activeTab = useAtomValue(currentTabAtom);
  const dispatch = useContext(TreeDispatchContext);

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
        data.forEach((game, index) => {
          newGames.set(startIndex + index, getPgnHeaders(game).event.name);
        });
        return newGames;
      });
    },
    [activeTab, setGames]
  );

  useEffect(() => {
    if (!activeTab?.file) return;
    read_games(activeTab.file.path, activePage, activePage).then((game) => {
      const tree = parsePGN(game[0]);
      tree.headers = getPgnHeaders(game[0]);
      dispatch({
        type: "SET_STATE",
        payload: tree,
      });
    });
  }, [activePage, activeTab, dispatch]);

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
            {formatNumber(activePage + 1)}. {headers.event.name}
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

function GameRow({
  style,
  index,
  game,
}: {
  style: React.CSSProperties;
  index: number;
  game: string | undefined;
}) {
  const setGames = useSetAtom(gamesAtom);
  const [activeTab, setActiveTab] = useAtom(currentTabAtom);
  const activePage = activeTab?.gameNumber ?? 0;
  const total = activeTab?.file?.numGames ?? 0;
  const [deleteModal, toggleDelete] = useToggle();

  function setPage(page: number) {
    setActiveTab((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gameNumber: page,
      };
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
          setGames(RESET);
          toggleDelete();
        }}
      />
      <Group style={style} position="apart" pr="xl">
        {formatNumber(index + 1)}. {game}
        <Group>
          <ActionIcon
            onClick={() => setPage(index)}
            disabled={index === activePage}
            variant={"outline"}
            color="blue"
          >
            <IconCheck />
          </ActionIcon>
          <ActionIcon
            onClick={() => toggleDelete()}
            variant={"outline"}
            color="red"
          >
            <IconTrash />
          </ActionIcon>
        </Group>
      </Group>
    </>
  );
}
