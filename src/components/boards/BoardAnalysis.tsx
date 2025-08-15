import { events, commands } from "@/bindings";
import {
  allEnabledAtom,
  autoSaveAtom,
  currentEnginePausedAtom,
  currentGameStateAtom,
  currentPlayersAtom,
  currentPracticeTabAtom,
  currentTabAtom,
  enableAllAtom,
  lastMovedAtom,
} from "@/state/atoms";
import { activeTabAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { getMainLine } from "@/utils/chess";
import { defaultPGN, getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { saveToFile } from "@/utils/tabs";
import { treeIteratorMainLine } from "@/utils/treeReducer";
import {
  Button,
  Group,
  Paper,
  Portal,
  ScrollArea,
  Stack,
  Box,
} from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
  IconZoomCheck,
} from "@tabler/icons-react";
import { useLoaderData } from "@tanstack/react-router";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { atomWithStorage } from "jotai/utils";
import GameInfo from "../common/GameInfo";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import AnalysisBar from "../panels/analysis/AnalysisBar";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import InfoPanel from "../panels/info/InfoPanel";
import PracticePanel from "../panels/practice/PracticePanel";
import Board from "./Board";
import EditingCard from "./EditingCard";
import EvalListener from "./EvalListener";

import "react-mosaic-component/react-mosaic-component.css";
import "@/styles/react-mosaic.css";

// Define the sidebar panel layout
type SidebarViewId = "analysis" | "moves" | "gameInfo";

interface SidebarState {
  currentNode: MosaicNode<SidebarViewId> | null;
}

const sidebarStateAtom = atomWithStorage<SidebarState>("sidebarStateV2", {
  currentNode: {
    direction: "column",
    first: "analysis",
    second: {
      direction: "column", 
      first: "moves",
      second: "gameInfo",
    },
  },
});

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
      keyMap.TOGGLE_ALL_ENGINES.keys,
      (e) => {
        enable(!allEnabled);
        e.preventDefault();
      },
    ],
  ]);

  const practiceTabSelected = useAtomValue(currentPracticeTabAtom);
  const isRepertoire = currentTab?.file?.metadata.type === "repertoire";
  const practicing =
    practiceTabSelected === "train";
  const [enginePaused, setEnginePaused] = useAtom(currentEnginePausedAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const [sidebarState, setSidebarState] = useAtom(sidebarStateAtom);

  // Background game engine runner to continue play while viewing Analysis
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const setFen = useStore(store, (s) => s.setFen);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const [, setGameState] = useAtom(currentGameStateAtom);
  const appendMove = useStore(store, (s) => s.appendMove);
  const setLastMove = useSetAtom(lastMovedAtom);
  const mainLine = Array.from(treeIteratorMainLine(root));
  const lastNode = mainLine[mainLine.length - 1].node;
  const movesFromRoot = useMemo(
    () => getMainLine(root, headers.variant === "Chess960"),
    [root, headers],
  );
  const [pos] = positionFromFen(lastNode.fen);

  // Keep analysis engines separate from game players to preserve original setup

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
          useCache: false,
        },
      );
    }
  }, [
    pos,
    gameState,
    enginePaused,
    headers.result,
    players,
    activeTab,
    root.fen,
    JSON.stringify(movesFromRoot),
  ]);

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
        const move = parseUci(ev[0].uciMoves[0])!;
        appendMove({ payload: move });
        setLastMove(ev[0].uciMoves[0]);
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

  // Define the sidebar panel components
  const sidebarLayout: { [viewId in SidebarViewId]: JSX.Element } = {
    gameInfo: (
      <Paper withBorder p="xs" h="100%">
        <ScrollArea h="100%">
          <GameInfo headers={headers} />
        </ScrollArea>
      </Paper>
    ),
    analysis: (
      <AnalysisBar height={"100%"} />
    ),
    moves: (
      <Stack h="100%" gap="xs">
        <GameNotation topBar />
        <MoveControls />
      </Stack>
    ),
  };

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
              <Button
                variant={allEnabled ? "filled" : "default"}
                onClick={() => enable(!allEnabled)}
              >
                {allEnabled ? "Stop Analysis" : "Start Analysis"}
              </Button>
              
            </Group>
            <Box style={{ flexGrow: 1 }}>
              <Mosaic<SidebarViewId>
                renderTile={(id) => sidebarLayout[id]}
                value={sidebarState.currentNode}
                onChange={(currentNode) => setSidebarState({ currentNode })}
                resize={{ minimumPaneSizePercentage: 10 }}
              />
            </Box>
          </Stack>
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        {editingMode ? (
          <EditingCard boardRef={boardRef} setEditingMode={toggleEditingMode} />
        ) : (
          <Stack h="100%" gap="xs">
            {isRepertoire && (
              <Paper withBorder p="xs">
                <Suspense>
                  <PracticePanel />
                </Suspense>
              </Paper>
            )}
            {/* <Paper withBorder p="xs">
              <AnnotationPanel />
            </Paper> */}
            <Paper withBorder p="xs">
              <InfoPanel />
            </Paper>
          </Stack>
        )}
      </Portal>
    </>
  );
}

export default BoardAnalysis;
