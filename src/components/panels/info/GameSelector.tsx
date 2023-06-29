import { Accordion, ActionIcon, Code, Divider, Group } from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import { useCallback, useContext, useEffect } from "react";
import { AutoSizer, InfiniteLoader, List } from "react-virtualized";
import { getPgnHeaders, parsePGN } from "../../../utils/chess";
import { read_games } from "../../../utils/db";
import { formatNumber } from "../../../utils/format";
import { Tab } from "../../../utils/tabs";
import { GameHeaders } from "../../../utils/treeReducer";
import { TreeDispatchContext } from "../../common/TreeStateContext";
import { invoke } from "../../../utils/misc";

export default function GameSelector({
  id,
  headers,
  games,
  setGames,
}: {
  id: string;
  headers: GameHeaders;
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  function isRowLoaded({ index }: { index: number }) {
    return games.has(index);
  }

  const [tabs, setTabs] = useSessionStorage<Tab[]>({
    key: "tabs",
    defaultValue: [],
  });
  const dispatch = useContext(TreeDispatchContext);

  const tab = tabs.find((t) => t.value === id);
  const activePage = tab?.gameNumber || 0;
  const total = tab?.file ? tab.file.numGames : 0;

  const setPage = useCallback(
    (page: number) => {
      setTabs((prev) => {
        const tab = prev.find((t) => t.value === id);
        if (!tab) return prev;
        tab.gameNumber = page;
        return [...prev];
      });
    },
    [id, setTabs]
  );

  async function loadMoreRows({
    startIndex,
    stopIndex,
  }: {
    startIndex: number;
    stopIndex: number;
  }) {
    if (!tab?.file) return;
    const data = await read_games(tab?.file.path, startIndex, stopIndex);
    setGames((prev) => {
      const newGames = new Map(prev);
      data.forEach((game, index) => {
        newGames.set(startIndex + index, getPgnHeaders(game).event.name);
      });
      return newGames;
    });
  }

  useEffect(() => {
    if (!tab?.file) return;
    read_games(tab.file.path, activePage, activePage).then((game) => {
      const tree = parsePGN(game[0]);
      tree.headers = getPgnHeaders(game[0]);
      dispatch({
        type: "SET_STATE",
        payload: tree,
      });
    });
  }, [activePage, dispatch, tab]);

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
                        <Group key={key} style={style} position="apart" pr="xl">
                          {formatNumber(index + 1)}. {games.get(index)}
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
                              onClick={() => {
                                invoke("delete_game", {
                                  file: tab?.file?.path,
                                  n: index,
                                });
                                setTabs((prev) => {
                                  const tab = prev.find((t) => t.value === id);
                                  if (!tab?.file) return prev;
                                  tab.file.numGames = total - 1;
                                  return [...prev];
                                });
                                setGames((prev) => {
                                  const newGames = new Map(prev);
                                  newGames.delete(index);
                                  return newGames;
                                });
                              }}
                              variant={"outline"}
                              color="blue"
                            >
                              <IconTrash />
                            </ActionIcon>
                          </Group>
                        </Group>
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
