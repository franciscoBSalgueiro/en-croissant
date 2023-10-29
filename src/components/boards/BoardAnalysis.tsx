import { Paper, Stack, Tabs } from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconZoomCheck,
} from "@tabler/icons-react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import BoardLayout from "@/layouts/BoardLayout";
import { getMainLine } from "@/utils/chess";
import { getBoardSize } from "@/utils/misc";
import { invoke } from "@/utils/invoke";

import { getNodeAtPath } from "@/utils/treeReducer";
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
import BoardPlay from "./BoardPlay";
import EditingCard from "./EditingCard";
import GameNotation from "./GameNotation";
import { useAtom, useAtomValue } from "jotai";
import {
  autoSaveAtom,
  currentTabAtom,
  currentTabSelectedAtom,
} from "@/atoms/atoms";
import { saveToFile } from "@/utils/tabs";
import EvalChart from "../common/EvalChart";

function BoardAnalysis() {
  const [editingMode, toggleEditingMode] = useToggle();
  const [reportingMode, toggleReportingMode] = useToggle();
  const [arrows, setArrows] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const autoSave = useAtomValue(autoSaveAtom);
  const dispatch = useContext(TreeDispatchContext);

  const boardRef = useRef(null);

  const boardSize = getBoardSize(window.innerHeight, window.innerWidth);
  const [inProgress, setInProgress] = useState(false);

  const [notationExpanded, setNotationExpanded] = useState(false);

  const { dirty, root, position, headers } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);

  useEffect(() => {
    setArrows([]);
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

  useHotkeys([["Ctrl+S", () => saveFile()]]);

  const [currentTabSelected, setCurrentTabSelected] = useAtom(
    currentTabSelectedAtom
  );

  return (
    <>
      <ReportModal
        initialFen={root.fen}
        moves={getMainLine(root)}
        reportingMode={reportingMode}
        toggleReportingMode={toggleReportingMode}
        setInProgress={setInProgress}
      />
      <BoardLayout
        board={
          <BoardPlay
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
        }
      >
        <>
          <Tabs
            value={currentTabSelected}
            onTabChange={(v) => setCurrentTabSelected(v || "info")}
            keepMounted={false}
            activateTabWithKeyboard={false}
            sx={{
              display: notationExpanded || editingMode ? "none" : undefined,
            }}
          >
            <Tabs.List grow>
              <Tabs.Tab value="analysis" icon={<IconZoomCheck size={16} />}>
                Analysis
              </Tabs.Tab>
              <Tabs.Tab value="database" icon={<IconDatabase size={16} />}>
                Database
              </Tabs.Tab>
              <Tabs.Tab value="annotate" icon={<IconNotes size={16} />}>
                Annotate
              </Tabs.Tab>
              <Tabs.Tab value="info" icon={<IconInfoCircle size={16} />}>
                Info
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="info" pt="xs">
              <InfoPanel boardSize={boardSize} />
            </Tabs.Panel>
            <Tabs.Panel value="database" pt="xs">
              <DatabasePanel fen={currentNode.fen} height={boardSize / 2} />
            </Tabs.Panel>
            <Tabs.Panel value="annotate" pt="xs">
              <AnnotationPanel />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" pt="xs">
              <AnalysisPanel
                boardSize={boardSize}
                setArrows={setArrows}
                toggleReportingMode={toggleReportingMode}
                inProgress={inProgress}
                setInProgress={setInProgress}
              />
            </Tabs.Panel>
          </Tabs>

          {editingMode && (
            <EditingCard
              boardRef={boardRef}
              fen={currentNode.fen}
              setEditingMode={toggleEditingMode}
            />
          )}
          <Stack>
            <GameNotation
              boardSize={
                notationExpanded
                  ? 1750
                  : window.innerWidth > 1000
                  ? boardSize
                  : 600
              }
              setNotationExpanded={setNotationExpanded}
              notationExpanded={notationExpanded}
              topBar
            />
            <MoveControls />
          </Stack>
        </>
      </BoardLayout>
    </>
  );
}

export default BoardAnalysis;
