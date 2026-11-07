import {
  Accordion,
  ActionIcon,
  Box,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useAtomValue, useStore as useAtomStore } from "jotai";
import { use, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { commands } from "@/bindings";
import GameInfo from "@/components/common/GameInfo";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import ConfirmChangesModal from "@/components/tabs/ConfirmChangesModal";
import { activeTabAtom, currentTabAtom, tabsAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { parsePGN } from "@/utils/chess";
import { formatNumber } from "@/utils/format";
import { getTabFile, getTabGameNumber } from "@/utils/tabs";
import { unwrap } from "@/utils/unwrap";
import FenSearch from "./FenSearch";
import FileInfo from "./FileInfo";
import GameSelector from "./GameSelector";
import classes from "./InfoPanel.module.css";
import PgnInput from "./PgnInput";
import { getStats } from "@/utils/repertoire";
import useSWR from "swr";
import { getDatabases } from "@/utils/db";
import { useNavigate } from "@tanstack/react-router";
import { useActiveDatabaseViewStore } from "@/state/store/database";

function InfoPanel({ addGame }: { addGame?: () => void }) {
  const store = use(TreeStateContext)!;
  const stats = useStore(store, getStats);
  const headers = useStore(store, (s) => s.headers);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const currentTab = useAtomValue(currentTabAtom);
  const tabFile = getTabFile(currentTab);
  const gameNumber = getTabGameNumber(currentTab);
  const isReportoire = tabFile?.metadata.type === "repertoire";

  const { t } = useTranslation();

  return (
    <Stack h="100%" gap={0}>
      {currentTab?.gameOrigin.kind === "database" && (
        <DatabaseInfo path={currentTab.gameOrigin.database} id={currentTab.gameOrigin.gameId} />
      )}
      <GameSelectorAccordion games={games} setGames={setGames} addGame={addGame} />
      <ScrollArea pb="sm">
        <FileInfo setGames={setGames} />
        <Stack px="sm" gap="xs">
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
          <FenSearch />
          <PgnInput />

          <Group>
            <Text fz="xs" c="dimmed">
              {t("PgnInput.Variations")}: {stats.leafs}
            </Text>
            <Text fz="xs" c="dimmed">
              {t("PgnInput.MaxDepth")}: {stats.depth}
            </Text>
            <Text fz="xs" c="dimmed">
              {t("PgnInput.TotalMoves")}: {stats.total}
            </Text>
          </Group>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

function DatabaseInfo({ path, id: _id }: { path: string; id: number }) {
  const { t } = useTranslation();
  const { data: databases, isLoading } = useSWR("databases", () => getDatabases());

  const dbInfo = databases?.find((db) => db.file === path);
  const navigate = useNavigate();
  const setActiveDatabase = useActiveDatabaseViewStore((store) => store.setDatabase);

  if (isLoading || !dbInfo || dbInfo.type !== "success") {
    return null;
  }
  return (
    <Stack gap={0}>
      <Box
        className={classes.databaseCard}
        onClick={async () => {
          await navigate({
            to: "/databases/$databaseId",
            params: {
              databaseId: dbInfo.title,
            },
          });
          setActiveDatabase(dbInfo);
        }}
      >
        <Text tt="uppercase" c="dimmed" fw={700} size="xs">
          {t("Board.Tabs.Database")}
        </Text>
        <Text fw="bold">{dbInfo.title}</Text>
        <Text size="xs" c="dimmed">
          {dbInfo.description}
        </Text>
      </Box>
      <Divider />
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
  const store = use(TreeStateContext)!;
  const setState = useStore(store, (s) => s.setState);
  const atoms = useAtomStore();
  const sourceId = useRef(atoms.get(activeTabAtom)).current;
  const currentTab = useAtomValue(tabsAtom).find((tab) => tab.value === sourceId);
  const [tempPage, setTempPage] = useState<number | null>(null);
  const requestedPage = useRef<number | null>(null);
  const loading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function dismissChanges() {
    requestedPage.current = null;
    setTempPage(null);
  }

  const setCurrentTab: React.Dispatch<React.SetStateAction<NonNullable<typeof currentTab>>> = (
    update,
  ) => {
    atoms.set(tabsAtom, (tabs) =>
      tabs.map((tab) =>
        tab.value === sourceId ? (typeof update === "function" ? update(tab) : update) : tab,
      ),
    );
  };

  const tabFile = getTabFile(currentTab);
  const gameNumber = getTabGameNumber(currentTab);
  const currentName = games.get(gameNumber) || "Untitled";

  const keyMap = useAtomValue(keyMapAtom);
  const { t } = useTranslation();

  useHotkeys(
    keyMap.NEXT_GAME.keys,
    () => {
      if (!tabFile?.numGames) return;
      void setPage(Math.min(gameNumber + 1, tabFile.numGames - 1));
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
    if (loading.current || (!forced && requestedPage.current !== null)) return false;
    const tab = atoms.get(tabsAtom).find((tab) => tab.value === sourceId);
    const file = getTabFile(tab);
    if (!tab || !file || atoms.get(activeTabAtom) !== sourceId) return false;
    if (!forced && store.getState().dirty) {
      requestedPage.current = page;
      setTempPage(page);
      return false;
    }

    loading.current = true;
    setBusy(true);
    setNavigationError(null);
    const { root, headers } = store.getState();
    const isCurrent = () =>
      mounted.current &&
      atoms.get(activeTabAtom) === sourceId &&
      atoms
        .get(tabsAtom)
        .some((current) => current.value === sourceId && current.gameOrigin === tab.gameOrigin) &&
      store.getState().root === root &&
      store.getState().headers === headers;
    try {
      const data = unwrap(await commands.readGames(file.path, page, page));
      if (!isCurrent()) return false;
      const tree = await parsePGN(data[0]);
      if (!isCurrent()) return false;
      setCurrentTab((prev) => {
        if (prev.gameOrigin.kind !== "file" && prev.gameOrigin.kind !== "temp_file") return prev;
        return { ...prev, gameOrigin: { ...prev.gameOrigin, gameNumber: page } };
      });
      setState(tree);
      return true;
    } catch (cause) {
      if (forced) throw cause;
      if (mounted.current)
        setNavigationError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      loading.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function deleteGame(index: number) {
    if (requestedPage.current !== null || loading.current) return;
    const origin = currentTab?.gameOrigin;
    await commands.deleteGame(filePath, index);
    if (
      !mounted.current ||
      atoms.get(activeTabAtom) !== sourceId ||
      atoms.get(tabsAtom).find((tab) => tab.value === sourceId)?.gameOrigin !== origin
    )
      return;
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
        opened={tempPage !== null}
        toggle={dismissChanges}
        closeTab={() => (tempPage === null ? false : setPage(tempPage, true))}
      />
      {navigationError && (
        <Text c="red" role="alert">
          {navigationError}
        </Text>
      )}
      <Accordion
        styles={{
          control: {
            borderBottom: "1px solid var(--mantine-color-default-border)",
          },
          content: { padding: 0 },
        }}
      >
        <Accordion.Item value="game">
          <Accordion.Control>
            <Group justify="space-between" wrap="nowrap" w="100%">
              <Text truncate flex={1}>
                {formatNumber(gameNumber + 1)}. {currentName}
              </Text>
              {addGame && (
                <Tooltip label={t("Board.Action.AddGame")}>
                  <ActionIcon
                    disabled={tempPage !== null || busy}
                    size="sm"
                    variant="subtle"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (requestedPage.current === null && !loading.current) addGame();
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
