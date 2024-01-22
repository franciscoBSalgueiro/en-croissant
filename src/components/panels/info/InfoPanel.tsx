import {
  currentPracticingAtom,
  currentTabAtom,
  missingMovesAtom,
} from "@/atoms/atoms";
import GameInfo from "@/components/common/GameInfo";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import ConfirmChangesModal from "@/components/tabs/ConfirmChangesModal";
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
import FenSearch from "./FenSearch";
import FileInfo from "./FileInfo";
import GameSelector from "./GameSelector";
import PgnInput from "./PgnInput";
import PracticePanel from "./PracticePanel";
import RepertoireInfo from "./RepertoireInfo";

function InfoPanel() {
  const tree = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(tree.root, tree.position);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const currentTab = useAtomValue(currentTabAtom);
  const isReportoire = currentTab?.file?.metadata.type === "repertoire";

  const stats = useMemo(() => getTreeStats(tree.root), [tree.root]);
  const practicing = useAtomValue(currentPracticingAtom);

  return (
    <Stack h="100%">
      {practicing ? (
        <PracticePanel />
      ) : (
        <>
          <GameSelectorAccordion games={games} setGames={setGames} />
          <ScrollArea offsetScrollbars>
            <FileInfo setGames={setGames} />
            <Stack>
              <div>
                <GameInfo headers={tree.headers} simplified={isReportoire} />
                {isReportoire && <RepertoireInfo />}
              </div>
              <FenSearch currentFen={currentNode.fen} />
              <PgnInput />

              <Group>
                <Text>Variations: {stats.leafs}</Text>
                <Text>Max Depth: {stats.depth}</Text>
                <Text>Total moves: {stats.total}</Text>
              </Group>
            </Stack>
          </ScrollArea>
        </>
      )}
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
  const { dirty } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
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

    const data = await read_games(currentTab?.file?.path, page, page);
    const tree = await parsePGN(data[0]);
    dispatch({
      type: "SET_STATE",
      payload: tree,
    });

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
