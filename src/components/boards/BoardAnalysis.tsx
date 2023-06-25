import { Stack, Tabs } from "@mantine/core";
import {
  useHotkeys,
  useSessionStorage,
  useToggle,
  useViewportSize,
} from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconZoomCheck,
} from "@tabler/icons-react";
import { save } from "@tauri-apps/api/dialog";
import { writeTextFile } from "@tauri-apps/api/fs";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import BoardLayout from "../../layouts/BoardLayout";
import { getPGN } from "../../utils/chess";
import { getBoardSize, invoke } from "../../utils/misc";
import { Tab } from "../../utils/tabs";
import { getNodeAtPath } from "../../utils/treeReducer";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import AnalysisPanel from "../panels/analysis/AnalysisPanel";
import ReportModal from "../panels/analysis/ReportModal";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import DatabasePanel from "../panels/database/DatabasePanel";
import InfoPanel from "../panels/info/InfoPanel";
import BoardPlay from "./BoardPlay";
import EditingCard from "./EditingCard";
import GameNotation from "./GameNotation";

function BoardAnalysis({ id }: { id: string }) {
  const [editingMode, toggleEditingMode] = useToggle();
  const [reportingMode, toggleReportingMode] = useToggle();
  const [arrows, setArrows] = useState<string[]>([]);
  const [tabs, setTabs] = useSessionStorage<Tab[]>({
    key: "tabs",
    defaultValue: [],
  });
  const [activeTabValue] = useSessionStorage<string | null>({
    key: "activeTab",
    defaultValue: null,
  });

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
    const activeTab = tabs.find((tab) => tab.value === activeTabValue);

    let filePath: string;
    if (activeTab?.file) {
      filePath = activeTab.file.path;
    } else {
      const userChoice = await save({
        filters: [
          {
            name: "PGN",
            extensions: ["pgn"],
          },
        ],
      });
      if (userChoice === null) return;
      filePath = userChoice;
      setTabs((prev) => {
        const index = prev.findIndex((tab) => tab.value === activeTabValue);
        if (index !== -1) {
          const newTabs = [...prev];
          newTabs[index].file = {
            path: userChoice,
            numGames: 1,
          };
          return newTabs;
        }
        return prev;
      });
    }
    await writeTextFile(
      filePath,
      getPGN(root, {
        headers,
      })
    );
  }, [tabs, activeTabValue, headers, root, setTabs]);

  const addGame = useCallback(() => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.value === id);
      if (!tab?.file) return prev;
      tab.gameNumber = tab.file.numGames;
      tab.file.numGames += 1;
      // write to file
      return [...prev];
    });
    invoke("append_to_file", {
      path: tabs.find((t) => t.value === id)?.file?.path,
      text:
        "\n\n" +
        getPGN(root, {
          headers,
        }),
    });
  }, [headers, id, root, setTabs, tabs]);

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
              <InfoPanel boardSize={boardSize} id={id} />
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
                id={id}
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
            />
            <MoveControls />
          </Stack>
        </>
      </BoardLayout>
    </>
  );
}

export default BoardAnalysis;
