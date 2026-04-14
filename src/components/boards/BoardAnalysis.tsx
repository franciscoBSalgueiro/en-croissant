import { Paper, Portal, Stack, Tabs } from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconTargetArrow,
  IconZoomCheck,
} from "@tabler/icons-react";
import { useLoaderData } from "@tanstack/react-router";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Piece } from "chessops";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  allEnabledAtom,
  autoSaveAtom,
  currentAnalysisTabAtom,
  currentPracticeTabAtom,
  currentReportModalOpenAtom,
  currentTabAtom,
  currentTabSelectedAtom,
  enableAllAtom,
  practiceStateAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { defaultPGN } from "@/utils/chess";
import { getTabFile, saveToFile } from "@/utils/tabs";
import DetachedEval from "../common/DetachedEval";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import AnalysisPanel from "../panels/analysis/AnalysisPanel";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import DatabasePanel from "../panels/database/DatabasePanel";
import InfoPanel from "../panels/info/InfoPanel";
import PracticePanel from "../panels/practice/PracticePanel";
import Board from "./Board";
import BoardControls from "./BoardControls";
import EditingCard from "./EditingCard";
import EvalListener from "./EvalListener";

function BoardAnalysis() {
  const { t } = useTranslation();

  const [editingMode, toggleEditingMode] = useToggle();
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const tabFile = getTabFile(currentTab);
  const hasPersistentOrigin = currentTab?.gameOrigin.kind !== "none";
  const autoSave = useAtomValue(autoSaveAtom);
  const { documentDir } = useLoaderData({ from: "/" });
  const boardRef = useRef(null);

  const store = useContext(TreeStateContext)!;

  const dirty = useStore(store, (s) => s.dirty);

  const reset = useStore(store, (s) => s.reset);
  const clearShapes = useStore(store, (s) => s.clearShapes);
  const setAnnotation = useStore(store, (s) => s.setAnnotation);

  const saveFile = useCallback(async () => {
    saveToFile({
      dir: documentDir,
      setCurrentTab,
      tab: currentTab,
      store,
    });
  }, [setCurrentTab, currentTab, documentDir, store]);
  const userSaveFile = useCallback(async () => {
    saveToFile({
      dir: documentDir,
      setCurrentTab,
      tab: currentTab,
      store,
      isUserSave: true,
    });
  }, [setCurrentTab, currentTab, documentDir, store]);
  useEffect(() => {
    if (hasPersistentOrigin && autoSave && dirty) {
      saveFile();
    }
  }, [hasPersistentOrigin, saveFile, autoSave, dirty]);

  const addGame = useCallback(() => {
    if (!tabFile) return;
    setCurrentTab((prev) => {
      if (prev.gameOrigin.kind !== "file" && prev.gameOrigin.kind !== "temp_file") {
        return prev;
      }
      return {
        ...prev,
        gameOrigin: {
          ...prev.gameOrigin,
          gameNumber: prev.gameOrigin.file.numGames,
          file: {
            ...prev.gameOrigin.file,
            numGames: prev.gameOrigin.file.numGames + 1,
          },
        },
      };
    });
    reset();
    writeTextFile(tabFile.path, `\n\n${defaultPGN()}\n\n`, {
      append: true,
    });
  }, [setCurrentTab, reset, tabFile]);

  const [, enable] = useAtom(enableAllAtom);
  const allEnabled = useAtomValue(allEnabledAtom);

  const keyMap = useAtomValue(keyMapAtom);

  const [, setAnalysisTab] = useAtom(currentAnalysisTabAtom);
  const [currentTabSelected, setCurrentTabSelected] = useAtom(currentTabSelectedAtom);
  const [, setReportModalOpen] = useAtom(currentReportModalOpenAtom);
  const practiceTabSelected = useAtomValue(currentPracticeTabAtom);
  const isRepertoire = tabFile?.metadata.type === "repertoire";
  const practicing = currentTabSelected === "practice" && practiceTabSelected === "train";
  const practiceState = useAtomValue(practiceStateAtom);
  const isPracticeRating = practicing && practiceState.phase === "correct";

  const setPracticePath = useStore(store, (s) => s.setPracticePath);
  useEffect(() => {
    if (!practicing) {
      setPracticePath(null);
    }
  }, [practicing, setPracticePath]);

  useHotkeys([
    [keyMap.SAVE_FILE.keys, () => userSaveFile()],
    [keyMap.CLEAR_SHAPES.keys, () => clearShapes()],
  ]);
  useHotkeys([
    [keyMap.ANNOTATION_BRILLIANT.keys, () => !isPracticeRating && setAnnotation("!!")],
    [keyMap.ANNOTATION_GOOD.keys, () => !isPracticeRating && setAnnotation("!")],
    [keyMap.ANNOTATION_INTERESTING.keys, () => !isPracticeRating && setAnnotation("!?")],
    [keyMap.ANNOTATION_DUBIOUS.keys, () => !isPracticeRating && setAnnotation("?!")],
    [keyMap.ANNOTATION_MISTAKE.keys, () => !isPracticeRating && setAnnotation("?")],
    [keyMap.ANNOTATION_BLUNDER.keys, () => !isPracticeRating && setAnnotation("??")],
    [
      keyMap.PRACTICE_TAB.keys,
      () => {
        if (isRepertoire) setCurrentTabSelected("practice");
      },
    ],
    [keyMap.ANALYSIS_TAB.keys, () => setCurrentTabSelected("analysis")],
    [
      keyMap.GENERATE_REPORT.keys,
      (e) => {
        setCurrentTabSelected("analysis");
        setAnalysisTab("report");
        setReportModalOpen(true);
        e.preventDefault();
      },
    ],
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

  return (
    <>
      <EvalListener />
      <Portal target="#left" style={{ height: "100%" }}>
        <Board
          practicing={practicing}
          editingMode={editingMode}
          boardRef={boardRef}
          selectedPiece={selectedPiece}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%" }}>
        <Paper
          withBorder
          style={{
            height: "100%",
          }}
          pos="relative"
        >
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
            styles={{
              tabLabel: {
                flex: 0,
              },
              tab: {
                display: "flex",
                justifyContent: "center",
                gap: "0.3rem",
              },
            }}
          >
            <Tabs.List grow>
              {isRepertoire && (
                <Tabs.Tab value="practice" leftSection={<IconTargetArrow size="1rem" />}>
                  {t("Board.Tabs.Practice")}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="analysis" leftSection={<IconZoomCheck size="1rem" />}>
                {t("Board.Tabs.Analysis")}
              </Tabs.Tab>
              <Tabs.Tab value="database" leftSection={<IconDatabase size="1rem" />}>
                {t("Board.Tabs.Database")}
              </Tabs.Tab>
              <Tabs.Tab value="annotate" leftSection={<IconNotes size="1rem" />}>
                {t("Board.Tabs.Annotate")}
              </Tabs.Tab>
              <Tabs.Tab value="info" leftSection={<IconInfoCircle size="1rem" />}>
                {t("Board.Tabs.Info")}
              </Tabs.Tab>
            </Tabs.List>
            {isRepertoire && (
              <Tabs.Panel value="practice" flex={1} style={{ overflowY: "hidden" }}>
                <PracticePanel />
              </Tabs.Panel>
            )}
            <Tabs.Panel value="info" flex={1} style={{ overflowY: "hidden" }}>
              <InfoPanel addGame={addGame} />
            </Tabs.Panel>
            <Tabs.Panel value="database" flex={1} style={{ overflowY: "hidden" }}>
              <DatabasePanel />
            </Tabs.Panel>
            <Tabs.Panel value="annotate" flex={1} style={{ overflowY: "hidden" }}>
              <AnnotationPanel />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" flex={1} style={{ overflowY: "hidden" }}>
              <AnalysisPanel />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        {editingMode ? (
          <EditingCard
            boardRef={boardRef}
            setEditingMode={toggleEditingMode}
            selectedPiece={selectedPiece}
            setSelectedPiece={setSelectedPiece}
          />
        ) : (
          <Stack h="100%" gap="xs">
            <DetachedEval />
            <GameNotation
              topBar
              controls={
                <BoardControls
                  editingMode={editingMode}
                  toggleEditingMode={toggleEditingMode}
                  dirty={dirty}
                  saveFile={userSaveFile}
                />
              }
            />
            <MoveControls />
          </Stack>
        )}
      </Portal>
    </>
  );
}

export default BoardAnalysis;
