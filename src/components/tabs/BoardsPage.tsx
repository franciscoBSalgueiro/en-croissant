import { commands } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { type Tab, createTab, genID } from "@/utils/tabs";
import { unwrap } from "@/utils/unwrap";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { ActionIcon, ScrollArea, Tabs } from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import { IconPlus, IconX } from "@tabler/icons-react";
import { atom, useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { MosaicWithoutDragDropContext as Mosaic, type MosaicNode } from "react-mosaic-component";
import { match } from "ts-pattern";
import BoardGame from "../boards/BoardGame";
import { TreeStateProvider } from "../common/TreeStateContext";
import Puzzles from "../puzzles/Puzzles";
import { BoardTab } from "./BoardTab";
import ConfirmChangesModal from "./ConfirmChangesModal";
import ConfirmModal from "../common/ConfirmModal";

import "react-mosaic-component/react-mosaic-component.css";

import "@/styles/react-mosaic.css";
import { atomWithStorage } from "jotai/utils";
import * as classes from "./BoardsPage.css";
import NewTabHome from "./NewTabHome";

export default function BoardsPage() {
  const { t } = useTranslation();

  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [saveModalOpened, toggleSaveModal] = useToggle();
  const [closeAllOpened, toggleCloseAll] = useToggle();

  useEffect(() => {
    if (tabs.length === 0) {
      createTab({
        tab: { name: "New Game", type: "play" },
        setTabs,
        setActiveTab,
      });
    }
  }, [tabs, setActiveTab, setTabs]);

  const closeTab = useCallback(
    async (value: string | null, forced?: boolean) => {
      if (value !== null) {
        const closedTab = tabs.find((tab) => tab.value === value);
        const tabState = JSON.parse(sessionStorage.getItem(value) || "{}");
        if (tabState && closedTab?.file && tabState.state.dirty && !forced) {
          toggleSaveModal();
          return;
        }
        if (value === activeTab) {
          const index = tabs.findIndex((tab) => tab.value === value);
          if (tabs.length > 1) {
            if (index === tabs.length - 1) {
              setActiveTab(tabs[index - 1].value);
            } else {
              setActiveTab(tabs[index + 1].value);
            }
          } else {
            setActiveTab(null);
          }
        }
        setTabs((prev) => prev.filter((tab) => tab.value !== value));
        try {
          const isTauri = typeof (globalThis as any).__TAURI__ !== "undefined";
          if (isTauri) {
            unwrap(await commands.killEngines(value));
          }
        } catch (_) {
          // ignore in web mode
        }
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
          },
        ]);
        setActiveTab(id);
      }
    },
    [tabs, setTabs, setActiveTab],
  );

  const keyMap = useAtomValue(keyMapAtom);
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

  const closeAllTabs = useCallback(async () => {
    try {
      const isTauri = typeof (globalThis as any).__TAURI__ !== "undefined";
      if (isTauri) {
        await Promise.all(
          tabs.map(async (t) => {
            try {
              unwrap(await commands.killEngines(t.value));
            } catch (_) {}
          }),
        );
      }
    } catch (_) {}

    try {
      tabs.forEach((t) => {
        try {
          sessionStorage.removeItem(t.value);
        } catch (_) {}
      });
    } catch (_) {}

    setTabs([]);
    setActiveTab(null);
    toggleCloseAll();
  }, [tabs, setTabs, setActiveTab, toggleCloseAll]);

  return (
    <>
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v)}
        keepMounted={false}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "inherit",
            height: "3.75rem",
            display: "flex",
            alignItems: "center",
            padding: "var(--mantine-spacing-sm) var(--mantine-spacing-md)",
            gap: 8,
          }}
        >
          <ActionIcon
            variant="default"
            onClick={() =>
              createTab({
                tab: {
                  name: "New Game",
                  type: "play",
                },
                setTabs,
                setActiveTab,
              })
            }
            size="lg"
            classNames={{
              root: classes.newTab,
            }}
            title="New tab"
          >
            <IconPlus />
          </ActionIcon>
          <ActionIcon
            variant="default"
            onClick={() => toggleCloseAll()}
            size="lg"
            classNames={{
              root: classes.newTab,
            }}
            title="Close all tabs"
          >
            <IconX />
          </ActionIcon>

          <ScrollArea
            h="100%"
            scrollbarSize={8}
            style={{ flex: 1, overflow: "hidden" }}
          >
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
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{ display: "flex" }}
                  >
                    {tabs.map((tab, i) => (
                      <Draggable
                        key={tab.value}
                        draggableId={tab.value}
                        index={i}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <BoardTab
                              tab={tab}
                              setActiveTab={setActiveTab}
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
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </ScrollArea>
        </div>
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.value}
            value={tab.value}
            h="calc(100% - 3.75rem)"
            w="100%"
            pb="sm"
            px="sm"
          >
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
      <ConfirmModal
        title={"Close all tabs"}
        description={"Are you sure you want to close all tabs? Unsaved changes will be lost."}
        opened={closeAllOpened}
        onClose={toggleCloseAll}
        onConfirm={closeAllTabs}
        confirmLabel="Close all"
      />
    </>
  );
}

type ViewId = "left" | "topRight" | "bottomRight";

const fullLayout: { [viewId: string]: JSX.Element } = {
  left: <div id="left" />,
  topRight: <div id="topRight" />,
  bottomRight: <div id="bottomRight" />,
};

interface WindowsState {
  currentNode: MosaicNode<ViewId> | null;
}

const DEFAULT_LAYOUT: MosaicNode<ViewId> = {
  direction: "row",
  first: "left",
  second: "topRight",
};

const windowsStateAtom = atomWithStorage<WindowsState>("windowsState", {
  currentNode: {
    direction: "row",
    first: "left",
    second: "topRight",
  },
});

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
  const [windowsState, setWindowsState] = useAtom(windowsStateAtom);

  // Remove any legacy bottomRight leaf from persisted layouts
  function pruneBottomRight(
    node: MosaicNode<ViewId> | null,
  ): MosaicNode<ViewId> | null {
    if (!node) return null;
    if (typeof node === "string") {
      return node === "bottomRight" ? null : node;
    }
    const first = pruneBottomRight(node.first);
    const second = pruneBottomRight(node.second);
    if (!first && !second) return null;
    if (!first) return second;
    if (!second) return first;
    return { ...node, first, second };
  }

  useEffect(() => {
    const pruned = pruneBottomRight(windowsState.currentNode);
    const normalized = pruned ?? DEFAULT_LAYOUT;
    if (JSON.stringify(normalized) !== JSON.stringify(windowsState.currentNode)) {
      setWindowsState({ currentNode: normalized });
    }
  }, [windowsState.currentNode, setWindowsState]);

  return match(tab.type)
    .with("new", () => (
      <TreeStateProvider id={tab.value}>
        <BoardGame />
        <ConfirmChangesModal
          opened={saveModalOpened}
          toggle={toggleSaveModal}
          closeTab={() => closeTab(activeTab, true)}
        />
      </TreeStateProvider>
    ))
    .with("play", () => (
      <TreeStateProvider id={tab.value}>
        <BoardGame />
        <ConfirmChangesModal
          opened={saveModalOpened}
          toggle={toggleSaveModal}
          closeTab={() => closeTab(activeTab, true)}
        />
      </TreeStateProvider>
    ))
    .with("analysis", () => (
      <TreeStateProvider id={tab.value}>
        <BoardGame />
        <ConfirmChangesModal
          opened={saveModalOpened}
          toggle={toggleSaveModal}
          closeTab={() => closeTab(activeTab, true)}
        />
      </TreeStateProvider>
    ))
    .with("puzzles", () => (
      <TreeStateProvider id={tab.value}>
        <Mosaic<ViewId>
          renderTile={(id) => fullLayout[id]}
          value={windowsState.currentNode}
          onChange={(currentNode) => setWindowsState({ currentNode })}
          resize={{ minimumPaneSizePercentage: 0 }}
        />
        <Puzzles id={tab.value} />
      </TreeStateProvider>
    ))
    .exhaustive();
}
