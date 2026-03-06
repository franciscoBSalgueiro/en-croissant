import { Accordion, ActionIcon, Box, Group, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useContext, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { commands } from "@/bindings";
import GameInfo from "@/components/common/GameInfo";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import ConfirmChangesModal from "@/components/tabs/ConfirmChangesModal";
import { currentTabAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { parsePGN } from "@/utils/chess";
import { formatNumber } from "@/utils/format";
import { getTreeStats } from "@/utils/repertoire";
import { getTabFile, getTabGameNumber } from "@/utils/tabs";
import { getNodeAtPath } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import FenSearch from "./FenSearch";
import FileInfo from "./FileInfo";
import GameSelector from "./GameSelector";
import PgnInput from "./PgnInput";

function InfoPanel({ addGame }: { addGame?: () => void }) {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const headers = useStore(store, (s) => s.headers);
  const currentNode = getNodeAtPath(root, position);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const currentTab = useAtomValue(currentTabAtom);
  const tabFile = getTabFile(currentTab);
  const gameNumber = getTabGameNumber(currentTab);
  const isReportoire = tabFile?.metadata.type === "repertoire";

  const { t } = useTranslation();

  const stats = useMemo(() => getTreeStats(root), [root]);

  return (
    <Stack h="100%" pl="sm" pt="sm">
      <GameSelectorAccordion games={games} setGames={setGames} addGame={addGame} />
      <ScrollArea offsetScrollbars>
        <FileInfo setGames={setGames} />
        <Stack>
          <GameInfo
            headers={headers}
            simplified={isReportoire}
            changeTitle={(title: string) => {
              setGames((prev) => {
                const newGames = new Map(prev);
                newGames.set(gameNumber, title);
                return newGames;
              });
            }}
          />
          <FenSearch currentFen={currentNode.fen} />
          <PgnInput />

          <Group>
            <Text>
              {t("PgnInput.Variations")}: {stats.leafs}
            </Text>
            <Text>
              {t("PgnInput.MaxDepth")}: {stats.depth}
            </Text>
            <Text>
              {t("PgnInput.TotalMoves")}: {stats.total}
            </Text>
          </Group>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

function GameSelectorAccordion({
  games,
  setGames,
  addGame,
}: {
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  addGame?: () => void;
}) {
  const store = useContext(TreeStateContext)!;
  const dirty = useStore(store, (s) => s.dirty);
  const setState = useStore(store, (s) => s.setState);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);

  const [confirmChanges, toggleConfirmChanges] = useToggle();
  const [tempPage, setTempPage] = useState(0);

  const tabFile = getTabFile(currentTab);
  const gameNumber = getTabGameNumber(currentTab);
  const currentName = games.get(gameNumber) || "Untitled";

  const keyMap = useAtomValue(keyMapAtom);
  const { t } = useTranslation();

  useHotkeys(
    keyMap.NEXT_GAME.keys,
    () => {
      if (!tabFile?.numGames) return;
      setPage(Math.min(gameNumber + 1, tabFile.numGames - 1));
    },
    {
      enabled: !!tabFile,
    },
  );

  useHotkeys(keyMap.PREVIOUS_GAME.keys, () => setPage(Math.max(0, gameNumber - 1)), {
    enabled: !!tabFile,
  });

  if (!tabFile) return null;
  const filePath = tabFile.path;

  async function setPage(page: number, forced?: boolean) {
    if (!forced && dirty) {
      setTempPage(page);
      toggleConfirmChanges();
      return;
    }

    const data = unwrap(await commands.readGames(filePath, page, page));
    const tree = await parsePGN(data[0]);
    setState(tree);

    setCurrentTab((prev) => {
      if (prev.gameOrigin.kind !== "file" && prev.gameOrigin.kind !== "temp_file") {
        return prev;
      }
      return {
        ...prev,
        gameOrigin: {
          ...prev.gameOrigin,
          gameNumber: page,
        },
      };
    });
  }

  async function deleteGame(index: number) {
    await commands.deleteGame(filePath, index);
    setCurrentTab((prev) => {
      if (prev.gameOrigin.kind !== "file" && prev.gameOrigin.kind !== "temp_file") {
        return prev;
      }
      return {
        ...prev,
        gameOrigin: {
          ...prev.gameOrigin,
          file: {
            ...prev.gameOrigin.file,
            numGames: prev.gameOrigin.file.numGames - 1,
          },
        },
      };
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
      <Accordion pr="sm">
        <Accordion.Item value="game">
          <Accordion.Control>
            <Group justify="space-between" wrap="nowrap" w="100%">
              <Text truncate flex={1}>
                {formatNumber(gameNumber + 1)}. {currentName}
              </Text>
              {addGame && (
                <Tooltip label={t("Board.Action.AddGame")}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      addGame();
                    }}
                  >
                    <IconPlus size="0.9rem" />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Box h="10rem">
              <GameSelector
                games={games}
                setGames={setGames}
                setPage={setPage}
                deleteGame={deleteGame}
                path={filePath}
                activePage={gameNumber || 0}
                total={tabFile.numGames}
              />
            </Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}
export default InfoPanel;
