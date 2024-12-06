import {
  allEnabledAtom,
  autoSaveAtom,
  currentPracticeTabAtom,
  currentTabAtom,
  currentTabSelectedAtom,
  enableAllAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { defaultPGN, getVariationLine } from "@/utils/chess";
import { saveToFile } from "@/utils/tabs";
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
import { useAtom, useAtomValue } from "jotai";
import { Suspense, useCallback, useContext, useEffect, useRef } from "react";
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
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%" }}>
        <Paper
          withBorder
          p="xs"
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
          >
            <Tabs.List grow mb="1rem">
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
            <Tabs.Panel
              value="analysis"
              flex={1}
              style={{ overflowY: "hidden" }}
            >
              <Suspense>
                <AnalysisPanel />
              </Suspense>
            </Tabs.Panel>
          </Tabs>
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
