import {
  allEnabledAtom,
  autoSaveAtom,
  currentPracticeTabAtom,
  currentTabAtom,
  currentTabSelectedAtom,
  enableAllAtom,
  currentGameStateAtom,
  currentPlayersAtom,
  currentEnginePausedAtom,
} from "@/state/atoms";
import { activeTabAtom } from "@/state/atoms";
import { commands, events } from "@/bindings";
import equal from "fast-deep-equal";
import { parseUci } from "chessops";
import { getMainLine } from "@/utils/chess";
import { treeIteratorMainLine } from "@/utils/treeReducer";
import { positionFromFen } from "@/utils/chessops";
import { keyMapAtom } from "@/state/keybinds";
import { defaultPGN, getVariationLine } from "@/utils/chess";
import { saveToFile } from "@/utils/tabs";
import { Button, Group, Paper, Portal, Stack, Tabs } from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconTargetArrow,
  IconZoomCheck,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
} from "@tabler/icons-react";
import { useLoaderData } from "@tanstack/react-router";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useAtom, useAtomValue } from "jotai";
import { Suspense, useCallback, useContext, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import AnalysisPanel from "../panels/analysis/AnalysisPanel";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import DatabasePanel from "../panels/database/DatabasePanel";
import InfoPanel from "../panels/info/InfoPanel";
import PracticePanel from "../panels/practice/PracticePanel";
import Board from "./Board";
import EditingCard from "./EditingCard";
import EvalListener from "./EvalListener";
import { match } from "ts-pattern";
import GameInfo from "../common/GameInfo";
import { INITIAL_FEN } from "chessops/fen";

function BoardAnalysis() {
  const { t } = useTranslation();

  const [editingMode, toggleEditingMode] = useToggle();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const autoSave = useAtomValue(autoSaveAtom);
  const { documentDir } = useLoaderData({ from: "/" });
  const boardRef = useRef(null);

  const store = useContext(TreeStateContext)!;

  const dirty = useStore(store, (s) => s.dirty);

  const reset = useStore(store, (s) => s.reset);
  const clearShapes = useStore(store, (s) => s.clearShapes);
  const setAnnotation = useStore(store, (s) => s.setAnnotation);
  const gameState = useAtomValue(currentGameStateAtom);
  const players = useAtomValue(currentPlayersAtom);

  const saveFile = useCallback(async () => {
    saveToFile({
      dir: documentDir,
      setCurrentTab,
      tab: currentTab,
      store,
    });
  }, [setCurrentTab, currentTab, documentDir, store]);
  useEffect(() => {
    if (currentTab?.file && autoSave && dirty) {
      saveFile();
    }
  }, [currentTab?.file, saveFile, autoSave, dirty]);

  const addGame = useCallback(() => {
    setCurrentTab((prev) => {
      if (!prev?.file) return prev;
      prev.gameNumber = prev.file.numGames;
      prev.file.numGames += 1;
      return { ...prev };
    });
    reset();
    writeTextFile(currentTab?.file?.path!, `\n\n${defaultPGN()}\n\n`, {
      append: true,
    });
  }, [setCurrentTab, reset, currentTab?.file?.path]);

  const [, enable] = useAtom(enableAllAtom);
  const allEnabledLoader = useAtomValue(allEnabledAtom);
  const allEnabled =
    allEnabledLoader.state === "hasData" && allEnabledLoader.data;

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys([
    [keyMap.SAVE_FILE.keys, () => saveFile()],
    [keyMap.CLEAR_SHAPES.keys, () => clearShapes()],
  ]);
  useHotkeys([
    [keyMap.ANNOTATION_BRILLIANT.keys, () => setAnnotation("!!")],
    [keyMap.ANNOTATION_GOOD.keys, () => setAnnotation("!")],
    [keyMap.ANNOTATION_INTERESTING.keys, () => setAnnotation("!?")],
    [keyMap.ANNOTATION_DUBIOUS.keys, () => setAnnotation("?!")],
    [keyMap.ANNOTATION_MISTAKE.keys, () => setAnnotation("?")],
    [keyMap.ANNOTATION_BLUNDER.keys, () => setAnnotation("??")],
    [
      keyMap.PRACTICE_TAB.keys,
      () => {
        isRepertoire && setCurrentTabSelected("practice");
      },
    ],
    [keyMap.ANALYSIS_TAB.keys, () => setCurrentTabSelected("analysis")],
    [keyMap.DATABASE_TAB.keys, () => setCurrentTabSelected("database")],
    [keyMap.ANNOTATE_TAB.keys, () => setCurrentTabSelected("annotate")],
    [keyMap.INFO_TAB.keys, () => setCurrentTabSelected("info")],
    [
      keyMap.TOGGLE_ALL_ENGINES.keys,
      (e) => {
        enable(!allEnabled);
        e.preventDefault();
      },
    ],
  ]);

  const [currentTabSelected, setCurrentTabSelected] = useAtom(
    currentTabSelectedAtom,
  );
  const practiceTabSelected = useAtomValue(currentPracticeTabAtom);
  const isRepertoire = currentTab?.file?.metadata.type === "repertoire";
  const practicing =
    currentTabSelected === "practice" && practiceTabSelected === "train";
  const [enginePaused, setEnginePaused] = useAtom(currentEnginePausedAtom);
  const activeTab = useAtomValue(activeTabAtom);

  // Background game engine runner to continue play while viewing Analysis
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const setFen = useStore(store, (s) => s.setFen);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const [, setGameState] = useAtom(currentGameStateAtom);
  const appendMove = useStore(store, (s) => s.appendMove);
  const mainLine = Array.from(treeIteratorMainLine(root));
  const lastNode = mainLine[mainLine.length - 1].node;
  const movesFromRoot = useMemo(
    () => getMainLine(root, headers.variant === "Chess960"),
    [root, headers],
  );
  const [pos] = positionFromFen(lastNode.fen);

  const newGame = useCallback(() => {
    setGameState("settingUp");
    setFen(INITIAL_FEN);
    setHeaders({ ...headers, result: "*" });
  }, [setGameState, setFen, setHeaders, headers]);

  useEffect(() => {
    if (!pos) return;
    if (gameState !== "playing") return;
    if (enginePaused) return;
    if (headers.result !== "*") return;
    const currentTurn = pos.turn;
    const player = currentTurn === "white" ? players.white : players.black;
    if (player.type === "engine" && player.engine) {
      commands.getBestMoves(
        currentTurn,
        player.engine.path,
        activeTab + currentTurn,
        // Use configured go mode; omit PlayersTime here while in analysis
        player.go,
        {
          fen: root.fen,
          moves: movesFromRoot,
          extraOptions: (player.engine.settings || [])
            .filter((s) => s.name !== "MultiPV")
            .map((s) => ({ ...s, value: s.value?.toString() ?? "" })),
        },
      );
    }
  }, [pos, gameState, enginePaused, headers.result, players, activeTab, root.fen, JSON.stringify(movesFromRoot)]);

  useEffect(() => {
    const unlisten = events.bestMovesPayload.listen(({ payload }) => {
      if (
        payload.progress === 100 &&
        payload.engine === pos?.turn &&
        payload.tab === activeTab + pos?.turn &&
        payload.fen === root.fen &&
        equal(payload.moves, movesFromRoot) &&
        !pos?.isEnd()
      ) {
        const ev = payload.bestLines;
        appendMove({ payload: parseUci(ev[0].uciMoves[0])! });
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [appendMove, activeTab, pos, root.fen, JSON.stringify(movesFromRoot)]);

  const movable: "both" | "white" | "black" | "turn" | "none" =
    gameState === "playing"
      ? match(players)
          .with(
            { white: { type: "human" }, black: { type: "human" } },
            () => "turn" as const,
          )
          .with({ white: { type: "human" } }, () => "white" as const)
          .with({ black: { type: "human" } }, () => "black" as const)
          .otherwise(() => "none" as const)
      : "turn";

  return (
    <>
      <EvalListener />
      <Portal target="#left" style={{ height: "100%" }}>
        <Board
          practicing={practicing}
          dirty={dirty}
          editingMode={editingMode}
          toggleEditingMode={toggleEditingMode}
          boardRef={boardRef}
          saveFile={saveFile}
          addGame={addGame}
          movable={movable}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%" }}>
                <Paper
           withBorder
           p="xs"
           style={{
             height: "100%",
             display: "flex",
             flexDirection: "column",
           }}
           pos="relative"
         >
                    <Stack gap="xs" h="100%">
            <Group grow>
              <Button
                onClick={() => setEnginePaused((prev: boolean) => !prev)}
                leftSection={
                  enginePaused ? <IconPlayerPlay /> : <IconPlayerStop />
                }
              >
                {enginePaused ? "Play" : "Stop"}
              </Button>
              <Button leftSection={<IconPlus />} onClick={newGame}>
                New Game
              </Button>
            </Group>
            <Tabs
              w="100%"
              h="100%"
              value={currentTabSelected}
              onChange={(v) => setCurrentTabSelected(v || "info")}
              keepMounted={false}
              activateTabWithKeyboard={false}
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
            <Tabs.List grow mb="1rem">
              <Tabs.Tab value="game" leftSection={<IconZoomCheck size="1rem" />}>
                Game
              </Tabs.Tab>
              {isRepertoire && (
                <Tabs.Tab
                  value="practice"
                  leftSection={<IconTargetArrow size="1rem" />}
                >
                  {t("Board.Tabs.Practice")}
                </Tabs.Tab>
              )}
              <Tabs.Tab
                value="analysis"
                leftSection={<IconZoomCheck size="1rem" />}
              >
                {t("Board.Tabs.Analysis")}
              </Tabs.Tab>
              <Tabs.Tab
                value="database"
                leftSection={<IconDatabase size="1rem" />}
              >
                {t("Board.Tabs.Database")}
              </Tabs.Tab>
              <Tabs.Tab
                value="annotate"
                leftSection={<IconNotes size="1rem" />}
              >
                {t("Board.Tabs.Annotate")}
              </Tabs.Tab>
              <Tabs.Tab
                value="info"
                leftSection={<IconInfoCircle size="1rem" />}
              >
                {t("Board.Tabs.Info")}
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="game" flex={1} style={{ overflowY: "hidden" }}>
              <Stack h="100%">
                <GameInfo headers={headers} />
              </Stack>
            </Tabs.Panel>
            {isRepertoire && (
              <Tabs.Panel
                value="practice"
                flex={1}
                style={{ overflowY: "hidden" }}
              >
                <Suspense>
                  <PracticePanel />
                </Suspense>
              </Tabs.Panel>
            )}
            <Tabs.Panel value="info" flex={1} style={{ overflowY: "hidden" }}>
              <InfoPanel />
            </Tabs.Panel>
            <Tabs.Panel
              value="database"
              flex={1}
              style={{ overflowY: "hidden" }}
            >
              <DatabasePanel />
            </Tabs.Panel>
            <Tabs.Panel
              value="annotate"
              flex={1}
              style={{ overflowY: "hidden" }}
            >
              <AnnotationPanel />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" flex={1} style={{ overflowY: "hidden" }}>
              <Suspense>
                <AnalysisPanel />
              </Suspense>
            </Tabs.Panel>
                      </Tabs>
          </Stack>
          </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        {editingMode ? (
          <EditingCard boardRef={boardRef} setEditingMode={toggleEditingMode} />
        ) : (
          <Stack h="100%" gap="xs">
            <GameNotation topBar />
            <MoveControls />
          </Stack>
        )}
      </Portal>
    </>
  );
}

export default BoardAnalysis;
