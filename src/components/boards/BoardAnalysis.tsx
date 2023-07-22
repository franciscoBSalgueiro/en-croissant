import { Stack, Tabs } from "@mantine/core";
import { useHotkeys, useToggle, useViewportSize } from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconZoomCheck,
} from "@tabler/icons-react";
import { save } from "@tauri-apps/api/dialog";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import BoardLayout from "@/layouts/BoardLayout";
import { getPGN } from "@/utils/chess";
import { getBoardSize, invoke } from "@/utils/misc";
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
import { useAtom } from "jotai";
import { currentTabAtom } from "@/atoms/atoms";
import { documentDir, resolve } from "@tauri-apps/api/path";

function BoardAnalysis() {
  const [editingMode, toggleEditingMode] = useToggle();
  const [reportingMode, toggleReportingMode] = useToggle();
  const [arrows, setArrows] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useAtom(currentTabAtom);
  const dispatch = useContext(TreeDispatchContext);

  const boardRef = useRef(null);

  const { height, width } = useViewportSize();

  const boardSize = getBoardSize(height, width);
  const [inProgress, setInProgress] = useState(false);

  const [notationExpanded, setNotationExpanded] = useState(false);

  const { root, position, headers } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);

  useEffect(() => {
    setArrows([]);
  }, [position]);

  const saveFile = useCallback(async () => {
    let filePath: string;
    if (activeTab?.file) {
      filePath = activeTab.file.path;
    } else {
      const defaultPath = await resolve(await documentDir(), "EnCroissant");
      const userChoice = await save({
        defaultPath,
        filters: [
          {
            name: "PGN",
            extensions: ["pgn"],
          },
        ],
      });
      if (userChoice === null) return;
      filePath = userChoice;
      setActiveTab((prev) => {
        return {
          ...prev,
          file: {
            path: userChoice,
            numGames: 1,
          },
        };
      });
    }
    await invoke("write_game", {
      file: filePath,
      n: activeTab?.gameNumber || 0,
      pgn:
        getPGN(root, {
          headers,
        }) + "\n\n",
    });
  }, [activeTab?.file, activeTab?.gameNumber, root, headers, setActiveTab]);

  const addGame = useCallback(() => {
    setActiveTab((prev) => {
      if (!prev?.file) return prev;
      prev.gameNumber = prev.file.numGames;
      prev.file.numGames += 1;
      return { ...prev };
    });
    dispatch({ type: "RESET" });
    invoke("append_to_file", {
      path: activeTab?.file?.path,
      text: "\n\n",
    });
  }, [setActiveTab, dispatch, activeTab?.file?.path, root, headers]);

  useHotkeys([["Ctrl+S", () => saveFile()]]);

  if (!currentNode) return null;
  return (
    <>
      <ReportModal
        moves={getPGN(root, {
          headers: null,
          comments: false,
          specialSymbols: false,
          symbols: false,
        })}
        reportingMode={reportingMode}
        toggleReportingMode={toggleReportingMode}
        setInProgress={setInProgress}
      />
      <BoardLayout
        board={
          <BoardPlay
            currentNode={currentNode}
            arrows={arrows}
            headers={headers}
            editingMode={editingMode}
            toggleEditingMode={toggleEditingMode}
            boardRef={boardRef}
            saveFile={saveFile}
            addGame={addGame}
          />
        }
      >
        <>
          <Tabs
            keepMounted={false}
            defaultValue="info"
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
                notationExpanded ? 1750 : width > 1000 ? boardSize : 600
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
