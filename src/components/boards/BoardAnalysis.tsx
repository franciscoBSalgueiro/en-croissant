import {
  autoSaveAtom,
  bestMovesFamily,
  currentPracticeTabAtom,
  currentTabAtom,
  currentTabSelectedAtom,
} from "@/atoms/atoms";
import { keyMapAtom } from "@/atoms/keybinds";
import { getMainLine, getVariationLine } from "@/utils/chess";
import { invoke } from "@/utils/invoke";
import { saveToFile } from "@/utils/tabs";
import { getNodeAtPath } from "@/utils/treeReducer";
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
import { useAtom, useAtomValue } from "jotai";
import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import MoveControls from "../common/MoveControls";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import AnalysisPanel from "../panels/analysis/AnalysisPanel";
import ReportModal from "../panels/analysis/ReportModal";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import DatabasePanel from "../panels/database/DatabasePanel";
import InfoPanel from "../panels/info/InfoPanel";
import PracticePanel from "../panels/practice/PracticePanel";
import Board from "./Board";
import EditingCard from "./EditingCard";
import GameNotation from "./GameNotation";

function BoardAnalysis() {
  const [editingMode, toggleEditingMode] = useToggle();
  const [reportingMode, toggleReportingMode] = useToggle();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const autoSave = useAtomValue(autoSaveAtom);
  const dispatch = useContext(TreeDispatchContext);
  const { documentDir } = useLoaderData({ from: "/" });

  const boardRef = useRef(null);

  const [inProgress, setInProgress] = useState(false);

  const { dirty, root, position, headers } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);

  const arrows = useAtomValue(
    bestMovesFamily({
      fen: root.fen,
      gameMoves: getVariationLine(root, position),
    }),
  );

  const saveFile = useCallback(async () => {
    saveToFile({
      dir: documentDir,
      headers,
      root,
      setCurrentTab,
      tab: currentTab,
      markAsSaved: () => dispatch({ type: "SAVE" }),
    });
  }, [headers, root, setCurrentTab, currentTab, dispatch]);

  useEffect(() => {
    if (currentTab?.file && autoSave && dirty) {
      saveFile();
    }
  }, [currentTab?.file, saveFile, autoSave, headers, dirty]);

  const addGame = useCallback(() => {
    setCurrentTab((prev) => {
      if (!prev?.file) return prev;
      prev.gameNumber = prev.file.numGames;
      prev.file.numGames += 1;
      return { ...prev };
    });
    dispatch({ type: "RESET" });
    invoke("append_to_file", {
      path: currentTab?.file?.path,
      text: "\n\n",
    });
  }, [setCurrentTab, dispatch, currentTab?.file?.path, root, headers]);

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys([
    [keyMap.SAVE_FILE.keys, () => saveFile()],
    [
      keyMap.CLEAR_SHAPES.keys,
      () =>
        dispatch({
          type: "CLEAR_SHAPES",
        }),
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
      <Suspense>
        <ReportModal
          tab={currentTab?.value || ""}
          initialFen={root.fen}
          moves={getMainLine(root, headers.variant === "Chess960")}
          is960={headers.variant === "Chess960"}
          reportingMode={reportingMode}
          toggleReportingMode={toggleReportingMode}
          setInProgress={setInProgress}
        />
      </Suspense>
      <Portal target="#left" style={{ height: "100%" }}>
        <Board
          practicing={practicing}
          dirty={dirty}
          currentNode={currentNode}
          arrows={arrows}
          headers={headers}
          editingMode={editingMode}
          toggleEditingMode={toggleEditingMode}
          boardRef={boardRef}
          saveFile={saveFile}
          addGame={addGame}
          root={root}
          position={position}
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
                  Practice
                </Tabs.Tab>
              )}
              <Tabs.Tab
                value="analysis"
                leftSection={<IconZoomCheck size="1rem" />}
              >
                Analysis
              </Tabs.Tab>
              <Tabs.Tab
                value="database"
                leftSection={<IconDatabase size="1rem" />}
              >
                Database
              </Tabs.Tab>
              <Tabs.Tab
                value="annotate"
                leftSection={<IconNotes size="1rem" />}
              >
                Annotate
              </Tabs.Tab>
              <Tabs.Tab
                value="info"
                leftSection={<IconInfoCircle size="1rem" />}
              >
                Info
              </Tabs.Tab>
            </Tabs.List>
            {isRepertoire && (
              <Tabs.Panel
                value="practice"
                flex={1}
                style={{ overflowY: "hidden" }}
              >
                <Suspense>
                  <PracticePanel fen={currentNode.fen} />
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
              <DatabasePanel fen={currentNode.fen} />
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
                <AnalysisPanel
                  tabId={currentTab?.value || ""}
                  toggleReportingMode={toggleReportingMode}
                  inProgress={inProgress}
                  setInProgress={setInProgress}
                />
              </Suspense>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Portal>

      <Portal target="#bottomRight" style={{ height: "100%" }}>
        {editingMode ? (
          <EditingCard
            boardRef={boardRef}
            fen={currentNode.fen}
            setEditingMode={toggleEditingMode}
          />
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
