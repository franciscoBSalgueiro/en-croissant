import GameInfo from "@/components/common/GameInfo";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import ConfirmChangesModal from "@/components/tabs/ConfirmChangesModal";
import { currentTabAtom, missingMovesAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import { read_games } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import { getTreeStats } from "@/utils/repertoire";
import { getNodeAtPath } from "@/utils/treeReducer";
import { Accordion, Box, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useContext, useMemo, useState } from "react";
import { useStore } from "zustand";
import FenSearch from "./FenSearch";
import FileInfo from "./FileInfo";
import GameSelector from "./GameSelector";
import PgnInput from "./PgnInput";

function InfoPanel() {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const headers = useStore(store, (s) => s.headers);
  const currentNode = getNodeAtPath(root, position);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const currentTab = useAtomValue(currentTabAtom);
  const isReportoire = currentTab?.file?.metadata.type === "repertoire";

  const stats = useMemo(() => getTreeStats(root), [root]);

  return (
    <Stack h="100%">
      <GameSelectorAccordion games={games} setGames={setGames} />
      <ScrollArea offsetScrollbars>
        <FileInfo setGames={setGames} />
        <Stack>
          <GameInfo
            headers={headers}
            simplified={isReportoire}
            changeTitle={(title: string) => {
              setGames((prev) => {
                const newGames = new Map(prev);
                newGames.set(currentTab?.gameNumber || 0, title);
                return newGames;
              });
            }}
          />
          <FenSearch currentFen={currentNode.fen} />
          <PgnInput />

          <Group>
            <Text>Variations: {stats.leafs}</Text>
            <Text>Max Depth: {stats.depth}</Text>
            <Text>Total moves: {stats.total}</Text>
          </Group>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

function GameSelectorAccordion({
  games,
  setGames,
}: {
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  const store = useContext(TreeStateContext)!;
  const dirty = useStore(store, (s) => s.dirty);
  const setState = useStore(store, (s) => s.setState);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const setMissingMoves = useSetAtom(missingMovesAtom);

  const [confirmChanges, toggleConfirmChanges] = useToggle();
  const [tempPage, setTempPage] = useState(0);

  if (!currentTab?.file) return null;

  const gameNumber = currentTab.gameNumber || 0;
  const currentName = games.get(gameNumber) || "Untitled";

  async function setPage(page: number, forced?: boolean) {
    if (!forced && dirty) {
      setTempPage(page);
      toggleConfirmChanges();
      return;
    }

    if (!currentTab?.file) return;

    const data = await read_games(currentTab.file.path, page, page);
    const tree = await parsePGN(data[0]);
    setState(tree);

    setCurrentTab((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gameNumber: page,
      };
    });

    setMissingMoves((prev) => ({
      ...prev,
      [currentTab?.value]: null,
    }));
  }

  async function deleteGame(index: number) {
    await invoke("delete_game", {
      file: currentTab?.file?.path,
      n: index,
    });
    setCurrentTab((prev) => {
      if (!prev.file) return prev;
      prev.file.numGames -= 1;
      return { ...prev };
    });
    setGames(new Map());
  }

  return (
    <>
      <ConfirmChangesModal
        opened={confirmChanges}
        toggle={toggleConfirmChanges}
        closeTab={() => {
          setPage(tempPage, true);
        }}
      />
      <Accordion>
        <Accordion.Item value="game">
          <Accordion.Control>
            {formatNumber(gameNumber + 1)}. {currentName}
          </Accordion.Control>
          <Accordion.Panel>
            <Box h="10rem">
              <GameSelector
                games={games}
                setGames={setGames}
                setPage={setPage}
                deleteGame={deleteGame}
                path={currentTab.file.path}
                activePage={gameNumber || 0}
                total={currentTab.file.numGames}
              />
            </Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}
export default InfoPanel;
