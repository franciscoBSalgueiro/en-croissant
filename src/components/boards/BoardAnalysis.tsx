import { Paper, Portal, Stack, Tabs } from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconZoomCheck,
} from "@tabler/icons-react";
import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@/utils/invoke";

import { getNodeAtPath } from "@/utils/treeReducer";
import MoveControls from "../common/MoveControls";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import AnalysisPanel from "../panels/analysis/AnalysisPanel";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import DatabasePanel from "../panels/database/DatabasePanel";
import InfoPanel from "../panels/info/InfoPanel";
import Board from "./Board";
import GameNotation from "./GameNotation";
import { useAtom, useAtomValue } from "jotai";
import {
  autoSaveAtom,
  currentArrowsAtom,
  currentTabAtom,
  currentTabSelectedAtom,
} from "@/atoms/atoms";
import { saveToFile } from "@/utils/tabs";
import EditingCard from "./EditingCard";
import ReportModal from "../panels/analysis/ReportModal";
import { getMainLine } from "@/utils/chess";
import { keyMapAtom } from "@/atoms/keybinds";

function BoardAnalysis() {
  const [editingMode, toggleEditingMode] = useToggle();
  const [reportingMode, toggleReportingMode] = useToggle();
  const [arrows, setArrows] = useAtom(currentArrowsAtom);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const autoSave = useAtomValue(autoSaveAtom);
  const dispatch = useContext(TreeDispatchContext);

  const boardRef = useRef(null);

  const [inProgress, setInProgress] = useState(false);

  const { dirty, root, position, headers } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);

  useEffect(() => {
    setArrows(new Map());
  }, [position]);

  const saveFile = useCallback(async () => {
    saveToFile({
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
    currentTabSelectedAtom
  );

  return (
    <>
      <Suspense>
        <ReportModal
          initialFen={root.fen}
          moves={getMainLine(root)}
          reportingMode={reportingMode}
          toggleReportingMode={toggleReportingMode}
          setInProgress={setInProgress}
        />
      </Suspense>
      <Portal target="#left" style={{ height: "100%" }}>
        <Board
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
              <Tabs.Tab value="analysis" leftSection={<IconZoomCheck size="1rem" />}>
                Analysis
              </Tabs.Tab>
              <Tabs.Tab value="database" leftSection={<IconDatabase size="1rem" />}>
                Database
              </Tabs.Tab>
              <Tabs.Tab value="annotate" leftSection={<IconNotes size="1rem" />}>
                Annotate
              </Tabs.Tab>
              <Tabs.Tab value="info" leftSection={<IconInfoCircle size="1rem" />}>
                Info
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="info" style={{ flex: 1, overflowY: "hidden" }}>
              <InfoPanel />
            </Tabs.Panel>
            <Tabs.Panel value="database" style={{ flex: 1, overflowY: "hidden" }}>
              <DatabasePanel fen={currentNode.fen} />
            </Tabs.Panel>
            <Tabs.Panel value="annotate" style={{ flex: 1, overflowY: "hidden" }}>
              <AnnotationPanel />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" style={{ flex: 1, overflowY: "hidden" }}>
              <Suspense>
                <AnalysisPanel
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
          <Stack h="100%">
            <GameNotation topBar />
            <MoveControls />
          </Stack>
        )}
      </Portal>
    </>
  );
}

export default BoardAnalysis;
