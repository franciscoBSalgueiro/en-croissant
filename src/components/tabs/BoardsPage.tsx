import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { ActionIcon, ScrollArea, Tabs } from "@mantine/core";
import { useElementSize, useHotkeys, useToggle } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { type ReactNode, startTransition, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { match } from "ts-pattern";
import { commands } from "@/bindings";
import { compactBoardLayout, resizeCompactPanels } from "@/utils/boardLayout";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { createTab, genID, isPersistentGameOrigin, type Tab } from "@/utils/tabs";
import { unwrap } from "@/utils/unwrap";
import BoardAnalysis from "../boards/BoardAnalysis";
import BoardGame from "../boards/BoardGame";
import { TreeStateProvider } from "../common/TreeStateContext";
import Puzzles from "../puzzles/Puzzles";
import { BoardTab } from "./BoardTab";
import ConfirmChangesModal from "./ConfirmChangesModal";
import NewTabHome from "./NewTabHome";

import "react-mosaic-component/react-mosaic-component.css";

import "@/styles/react-mosaic.css";
import { platform } from "@tauri-apps/plugin-os";
import { atomWithStorage } from "jotai/utils";
import classes from "./BoardsPage.module.css";

export default function BoardsPage() {
  const { t } = useTranslation();

  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [saveModalOpened, toggleSaveModal] = useToggle();

  useEffect(() => {
    if (tabs.length === 0) {
      createTab({
        tab: { name: t("Tab.NewTab"), type: "new" },
        setTabs,
        setActiveTab,
      });
    }
  }, [tabs, setActiveTab, setTabs, t]);

  const closeTab = useCallback(
    async (value: string | null, forced?: boolean) => {
      if (value !== null) {
        const closedTab = tabs.find((tab) => tab.value === value);
        const tabState = JSON.parse(sessionStorage.getItem(value) || "{}");
        if (tabState && isPersistentGameOrigin(closedTab) && tabState.state.dirty && !forced) {
          toggleSaveModal();
          return;
        }
        if (value === activeTab) {
          const index = tabs.findIndex((tab) => tab.value === value);
          if (tabs.length > 1) {
            if (index === tabs.length - 1) {
              startTransition(() => setActiveTab(tabs[index - 1].value));
            } else {
              startTransition(() => setActiveTab(tabs[index + 1].value));
            }
          } else {
            startTransition(() => setActiveTab(null));
          }
        }
        setTabs((prev) => prev.filter((tab) => tab.value !== value));
        unwrap(await commands.killEngines(value));
        await commands.abortGame(`${value}-game`);
      }
    },
    [tabs, activeTab, setTabs, toggleSaveModal, setActiveTab],
  );

  function selectTab(index: number) {
    setActiveTab(tabs[Math.min(index, tabs.length - 1)].value);
  }

  function cycleTabs(reverse = false) {
    const index = tabs.findIndex((tab) => tab.value === activeTab);
    if (reverse) {
      if (index === 0) {
        setActiveTab(tabs[tabs.length - 1].value);
      } else {
        setActiveTab(tabs[index - 1].value);
      }
    } else {
      if (index === tabs.length - 1) {
        setActiveTab(tabs[0].value);
      } else {
        setActiveTab(tabs[index + 1].value);
      }
    }
  }

  const renameTab = useCallback(
    (value: string, name: string) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.value === value) {
            return { ...tab, name };
          }
          return tab;
        }),
      );
    },
    [setTabs],
  );

  const duplicateTab = useCallback(
    (value: string) => {
      const id = genID();
      const tab = tabs.find((tab) => tab.value === value);
      if (sessionStorage.getItem(value)) {
        sessionStorage.setItem(id, sessionStorage.getItem(value) || "");
      }

      if (tab) {
        setTabs((prev) => [
          ...prev,
          {
            name: tab.name,
            value: id,
            type: tab.type,
            gameOrigin: tab.gameOrigin,
          },
        ]);
        startTransition(() => setActiveTab(id));
      }
    },
    [tabs, setTabs, setActiveTab],
  );

  useEffect(() => {
    if (platform() !== "macos") return;

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        e.stopPropagation();
        closeTab(activeTab);
      }
    };

    window.addEventListener("keydown", handler, { capture: true });

    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [closeTab]);

  const keyMap = useAtomValue(keyMapAtom);

  const handleSetActiveTab = useCallback(
    (v: string) => {
      startTransition(() => setActiveTab(v));
    },
    [setActiveTab],
  );
  useHotkeys([
    [keyMap.CLOSE_TAB.keys, () => closeTab(activeTab)],
    [keyMap.CYCLE_TABS.keys, () => cycleTabs()],
    [keyMap.REVERSE_CYCLE_TABS.keys, () => cycleTabs(true)],
    ["alt+1", () => selectTab(0)],
    ["ctrl+1", () => selectTab(0)],
    ["alt+2", () => selectTab(1)],
    ["ctrl+2", () => selectTab(1)],
    ["alt+3", () => selectTab(2)],
    ["ctrl+3", () => selectTab(2)],
    ["alt+4", () => selectTab(3)],
    ["ctrl+4", () => selectTab(3)],
    ["alt+5", () => selectTab(4)],
    ["ctrl+5", () => selectTab(4)],
    ["alt+6", () => selectTab(5)],
    ["ctrl+6", () => selectTab(5)],
    ["alt+7", () => selectTab(6)],
    ["ctrl+7", () => selectTab(6)],
    ["alt+8", () => selectTab(7)],
    ["ctrl+8", () => selectTab(7)],
    ["alt+9", () => selectTab(tabs.length - 1)],
    ["ctrl+9", () => selectTab(tabs.length - 1)],
  ]);

  return (
    <Tabs
      value={activeTab}
      onChange={(v) => setActiveTab(v)}
      keepMounted={false}
      className={classes.tabsContainer}
    >
      <ScrollArea scrollbarSize={6} className={classes.tabsHeader}>
        <DragDropContext
          onDragEnd={({ destination, source }) =>
            destination?.index !== undefined &&
            setTabs((prev) => {
              const result = Array.from(prev);
              const [removed] = result.splice(source.index, 1);
              result.splice(destination.index, 0, removed);
              return result;
            })
          }
        >
          <Droppable droppableId="droppable" direction="horizontal">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: "flex" }}>
                {tabs.map((tab, i) => (
                  <Draggable key={tab.value} draggableId={tab.value} index={i}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <BoardTab
                          tab={tab}
                          tabType={tab.type}
                          setActiveTab={handleSetActiveTab}
                          closeTab={closeTab}
                          renameTab={renameTab}
                          duplicateTab={duplicateTab}
                          selected={activeTab === tab.value}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                <ActionIcon
                  variant="default"
                  radius={0}
                  onClick={() =>
                    createTab({
                      tab: {
                        name: t("Tab.NewTab"),
                        type: "new",
                      },
                      setTabs,
                      setActiveTab,
                    })
                  }
                  classNames={{
                    root: classes.newTab,
                  }}
                >
                  <IconPlus />
                </ActionIcon>
                <div className={classes.tabsFiller} />
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </ScrollArea>
      {tabs.map((tab) => (
        <Tabs.Panel key={tab.value} value={tab.value} h="100%" w="100%" pb="sm" px="xs">
          <TabSwitch
            tab={tab}
            saveModalOpened={saveModalOpened}
            toggleSaveModal={toggleSaveModal}
            closeTab={closeTab}
            activeTab={activeTab}
          />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

type ViewId = "left" | "topRight" | "bottomRight";

const fullLayout: { [viewId: string]: ReactNode } = {
  left: <div id="left" />,
  topRight: <div id="topRight" />,
  bottomRight: <div id="bottomRight" />,
};

interface WindowsState {
  currentNode: MosaicNode<ViewId> | null;
}

const windowsStateAtom = atomWithStorage<WindowsState>("windowsState", {
  currentNode: {
    direction: "row",
    first: "left",
    second: {
      direction: "column",
      first: "topRight",
      second: "bottomRight",
    },
  },
});

// Keep compact resizing separate so widening the window restores the saved layout.
function ResponsiveBoardLayout() {
  const [windowsState, setWindowsState] = useAtom(windowsStateAtom);
  const { ref, width } = useElementSize<HTMLDivElement>();
  const compact = width > 0 && width < 900;
  const [manualPanelHeights, setManualPanelHeights] = useState<{
    topRight: number;
    bottomRight: number;
  }>();
  const [measuredBoardHeight, setMeasuredBoardHeight] = useState(0);
  const [panelHeights, setPanelHeights] = useState({ topRight: 340, bottomRight: 340 });

  useEffect(() => {
    if (!compact || !ref.current) return;
    const container = ref.current;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const board = container.querySelector<HTMLElement>("[data-board-frame]");
        if (board) {
          // Mosaic leaves a 3px gutter on each edge of a tile.
          setMeasuredBoardHeight(Math.ceil(board.getBoundingClientRect().height) + 6);
        }
        // Manual resizing redistributes a fixed amount of space. Do not feed
        // the resulting scroll overflow back into automatic pane sizing.
        if (manualPanelHeights) return;
        const requiredHeights = { topRight: 0, bottomRight: 0 };
        for (const id of ["topRight", "bottomRight"] as const) {
          const panel = container.querySelector<HTMLElement>(`#${id}`);
          const tile = panel?.closest<HTMLElement>(".mosaic-tile");
          if (!panel || !tile) continue;
          let overflow = 0;
          for (const element of panel.querySelectorAll<HTMLElement>("*")) {
            if (!element.getClientRects().length || element.clientHeight === 0) continue;
            // Fixed-size controls (charts, selectors and virtualized lists) do
            // not grow with the pane, so their overflow must not inflate it.
            let fixedSize = false;
            for (
              let parent: HTMLElement | null = element;
              parent && parent !== panel;
              parent = parent.parentElement
            ) {
              const height = parent.style.height;
              const maxHeight = getComputedStyle(parent).maxHeight;
              if (
                (height && height !== "auto" && !height.includes("%")) ||
                (maxHeight !== "none" && !maxHeight.includes("%"))
              ) {
                fixedSize = true;
                break;
              }
            }
            if (fixedSize) continue;
            const overflowY = getComputedStyle(element).overflowY;
            if (["auto", "scroll", "hidden"].includes(overflowY)) {
              overflow = Math.max(overflow, element.scrollHeight - element.clientHeight);
            }
          }
          if (overflow > 2) {
            requiredHeights[id] = Math.ceil(tile.getBoundingClientRect().height + overflow + 8);
          }
        }
        setPanelHeights((previous) => {
          const next = {
            topRight: Math.max(previous.topRight, requiredHeights.topRight),
            bottomRight: Math.max(previous.bottomRight, requiredHeights.bottomRight),
          };
          return next.topRight === previous.topRight && next.bottomRight === previous.bottomRight
            ? previous
            : next;
        });
      });
    };
    const resizeObserver = new ResizeObserver(measure);
    const observeContent = () => {
      resizeObserver.disconnect();
      for (const element of container.querySelectorAll(
        "[data-board-frame], #topRight, #bottomRight, #topRight *, #bottomRight *",
      )) {
        resizeObserver.observe(element);
      }
      measure();
    };
    const mutationObserver = new MutationObserver(observeContent);
    mutationObserver.observe(container, { childList: true, characterData: true, subtree: true });
    observeContent();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [compact, ref, manualPanelHeights]);

  const boardHeight = measuredBoardHeight || width + 80;
  const sizes = manualPanelHeights ?? panelHeights;
  const {
    height: compactHeight,
    boardPercentage,
    panelPercentage,
    panelsHeight,
  } = compactBoardLayout(boardHeight, sizes);
  const node = windowsState.currentNode;
  const value =
    compact && node && typeof node !== "string"
      ? {
          ...node,
          direction: "column" as const,
          second:
            typeof node.second === "string"
              ? node.second
              : { ...node.second, splitPercentage: panelPercentage },
          splitPercentage: boardPercentage,
        }
      : node;

  return (
    <div ref={ref} className={classes.boardLayout} data-compact={compact}>
      <div
        className={classes.boardLayoutContent}
        style={compact ? { height: compactHeight } : undefined}
      >
        <Mosaic<ViewId>
          renderTile={(id) => fullLayout[id]}
          value={value}
          onChange={(currentNode) => {
            if (compact) {
              if (currentNode && typeof currentNode !== "string") {
                if (
                  typeof currentNode.second !== "string" &&
                  currentNode.second.splitPercentage !== undefined &&
                  currentNode.second.splitPercentage !== panelPercentage
                ) {
                  setManualPanelHeights(
                    resizeCompactPanels(panelsHeight, currentNode.second.splitPercentage),
                  );
                }
              }
            } else {
              setWindowsState({ currentNode });
            }
          }}
          resize={{ minimumPaneSizePercentage: compact ? (100 / panelsHeight) * 100 : 0 }}
        />
      </div>
    </div>
  );
}

function TabSwitch({
  tab,
  saveModalOpened,
  toggleSaveModal,
  closeTab,
  activeTab,
}: {
  tab: Tab;
  saveModalOpened: boolean;
  toggleSaveModal: () => void;
  closeTab: (value: string | null, forced?: boolean) => void;
  activeTab: string | null;
}) {
  return match(tab.type)
    .with("new", () => <NewTabHome id={tab.value} />)
    .with("play", () => (
      <TreeStateProvider id={tab.value}>
        <ResponsiveBoardLayout />
        <BoardGame />
      </TreeStateProvider>
    ))
    .with("analysis", () => (
      <TreeStateProvider id={tab.value}>
        <ResponsiveBoardLayout />
        <BoardAnalysis />
        <ConfirmChangesModal
          opened={saveModalOpened}
          toggle={toggleSaveModal}
          closeTab={() => closeTab(activeTab, true)}
        />
      </TreeStateProvider>
    ))
    .with("puzzles", () => (
      <TreeStateProvider id={tab.value}>
        <ResponsiveBoardLayout />
        <Puzzles id={tab.value} />
      </TreeStateProvider>
    ))
    .exhaustive();
}
