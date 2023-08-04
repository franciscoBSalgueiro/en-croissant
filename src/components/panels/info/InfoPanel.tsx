import { Accordion, Box, ScrollArea, Stack, TextInput } from "@mantine/core";
import { useContext, useState } from "react";
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
import { useAtom, useAtomValue } from "jotai";
import { currentTabAtom } from "@/atoms/atoms";
import { invoke } from "@tauri-apps/api";
import { formatNumber } from "@/utils/format";
import RepertoireInfo from "./RepertoireInfo";

function InfoPanel({ boardSize }: { boardSize: number }) {
  const tree = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(tree.root, tree.position);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const currentTab = useAtomValue(currentTabAtom);
  const isReportoire = currentTab?.file?.metadata.type === "repertoire";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: `${boardSize / 2}px`,
      }}
    >
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
        </Stack>
      </ScrollArea>
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
  const dispatch = useContext(TreeDispatchContext);
  const [activeTab, setActiveTab] = useAtom(currentTabAtom);

  if (!activeTab?.file) return null;

  const gameNumber = activeTab.gameNumber || 0;
  const currentName = games.get(gameNumber) || "Untitled";

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

  async function deleteGame(index: number) {
    await invoke("delete_game", {
      file: activeTab!.file!.path,
      n: index,
    });
    setActiveTab((prev) => {
      if (!prev.file) return prev;
      prev.file.numGames -= 1;
      return { ...prev };
    });
    setGames(new Map());
  }

  return (
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
            path={activeTab.file.path}
            activePage={gameNumber || 0}
            total={activeTab.file.numGames}
          />
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
export default InfoPanel;
