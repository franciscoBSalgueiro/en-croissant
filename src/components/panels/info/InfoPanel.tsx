import {
  Accordion,
  Box,
  ScrollArea,
  Stack,
  TextInput,
  Text,
  Group,
} from "@mantine/core";
import { useContext, useMemo, useState } from "react";
import { getNodeAtPath } from "@/utils/treeReducer";
import GameInfo from "@/components/common/GameInfo";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import GameSelector from "./GameSelector";
import PgnInput from "./PgnInput";
import FileInfo from "./FileInfo";
import { read_games } from "@/utils/db";
import { parsePGN } from "@/utils/chess";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { currentPracticingAtom, currentTabAtom, missingMovesAtom } from "@/atoms/atoms";
import { invoke } from "@tauri-apps/api";
import { formatNumber } from "@/utils/format";
import RepertoireInfo from "./RepertoireInfo";
import { useToggle } from "@mantine/hooks";
import ConfirmChangesModal from "@/components/tabs/ConfirmChangesModal";
import { getTreeStats } from "@/utils/repertoire";
import PracticePanel from "./PracticePanel";

function InfoPanel({ boardSize }: { boardSize: number }) {
  const tree = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(tree.root, tree.position);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const currentTab = useAtomValue(currentTabAtom);
  const isReportoire = currentTab?.file?.metadata.type === "repertoire";

  const stats = useMemo(() => getTreeStats(tree.root), [tree.root]);
  const practicing = useAtomValue(currentPracticingAtom);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: `${boardSize / 2}px`,
      }}
    >
      {practicing ? (
        <PracticePanel />
      ) : (
        <>
          <GameSelectorAccordion games={games} setGames={setGames} />
          <ScrollArea offsetScrollbars>
            <FileInfo setGames={setGames} />
            <Stack>
              <GameInfo headers={tree.headers} simplified={isReportoire} />
              {isReportoire && <RepertoireInfo />}
              {currentNode && (
                <TextInput
                  readOnly
                  value={currentNode.fen}
                  label="FEN"
                  labelProps={{
                    sx: {
                      fontWeight: "bold",
                      fontSize: "1rem",
                      marginBottom: "0.5rem",
                    },
                  }}
                />
              )}
              <PgnInput headers={tree.headers} root={tree.root} />

              <Group>
                <Text>Variations: {stats.leafs}</Text>
                <Text>Max Depth: {stats.depth}</Text>
                <Text>Total moves: {stats.total}</Text>
              </Group>
            </Stack>
          </ScrollArea>
        </>
      )}
    </Box>
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

    const data = await read_games(currentTab!.file!.path, page, page);
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
      [currentTab!.value]: null,
    }));
  }

  async function deleteGame(index: number) {
    await invoke("delete_game", {
      file: currentTab!.file!.path,
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
          <Accordion.Panel h={200} mb={20}>
            <GameSelector
              height={200}
              games={games}
              setGames={setGames}
              setPage={setPage}
              deleteGame={deleteGame}
              path={currentTab.file.path}
              activePage={gameNumber || 0}
              total={currentTab.file.numGames}
            />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}
export default InfoPanel;
