import { commands } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { type Tab, createTab, genID } from "@/utils/tabs";
import { unwrap } from "@/utils/unwrap";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { ActionIcon, ScrollArea, Tabs } from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { atom, useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { match } from "ts-pattern";
import BoardAnalysis from "../boards/BoardAnalysis";
import BoardGame from "../boards/BoardGame";
import { TreeStateProvider } from "../common/TreeStateContext";
import Puzzles from "../puzzles/Puzzles";
import { BoardTab } from "./BoardTab";
import ConfirmChangesModal from "./ConfirmChangesModal";
import NewTabHome from "./NewTabHome";

import "react-mosaic-component/react-mosaic-component.css";

import "@/styles/react-mosaic.css";
import { atomWithStorage } from "jotai/utils";
import * as classes from "./BoardsPage.css";

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
        unwrap(await commands.killEngines(value));
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
    [keyMap.CLOSE_BOARD_TAB.keys, () => closeTab(activeTab)],
    [keyMap.CYCLE_BOARD_TABS.keys, () => cycleTabs()],
    [keyMap.REVERSE_CYCLE_BOARD_TABS.keys, () => cycleTabs(true)],
    [keyMap.BOARD_TAB_ONE.keys, () => selectTab(0)],
    [keyMap.BOARD_TAB_TWO.keys, () => selectTab(1)],
    [keyMap.BOARD_TAB_THREE.keys, () => selectTab(2)],
    [keyMap.BOARD_TAB_FOUR.keys, () => selectTab(3)],
    [keyMap.BOARD_TAB_FIVE.keys, () => selectTab(4)],
    [keyMap.BOARD_TAB_SIX.keys, () => selectTab(5)],
    [keyMap.BOARD_TAB_SEVEN.keys, () => selectTab(6)],
    [keyMap.BOARD_TAB_EIGHT.keys, () => selectTab(7)],
    [keyMap.BOARD_TAB_LAST.keys, () => selectTab(tabs.length - 1)],
  ]);

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
        }}
      >
        <ScrollArea h="3.75rem" px="md" pt="sm" scrollbarSize={8}>
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
                  <ActionIcon
                    variant="default"
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
                    size="lg"
                    classNames={{
                      root: classes.newTab,
                    }}
                  >
                    <IconPlus />
                  </ActionIcon>
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </ScrollArea>
        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.value}
            value={tab.value}
            h="100%"
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

  return match(tab.type)
    .with("new", () => <NewTabHome id={tab.value} />)
    .with("play", () => (
      <TreeStateProvider id={tab.value}>
        <Mosaic<ViewId>
          renderTile={(id) => fullLayout[id]}
          value={windowsState.currentNode}
          onChange={(currentNode) => setWindowsState({ currentNode })}
          resize={{ minimumPaneSizePercentage: 0 }}
        />
        <BoardGame />
      </TreeStateProvider>
    ))
    .with("analysis", () => (
      <TreeStateProvider id={tab.value}>
        <Mosaic<ViewId>
          renderTile={(id) => fullLayout[id]}
          value={windowsState.currentNode}
          onChange={(currentNode) => setWindowsState({ currentNode })}
          resize={{ minimumPaneSizePercentage: 0 }}
        />
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
