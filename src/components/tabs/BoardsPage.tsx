import {
  ActionIcon,
  createStyles,
  Group,
  ScrollArea,
  Stack,
  Tabs,
} from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { createTab, genID, Tab } from "@/utils/tabs";
import BoardAnalysis from "../boards/BoardAnalysis";
import BoardGame from "../boards/BoardGame";
import { TreeStateProvider } from "../common/TreeStateContext";
import Puzzles from "../puzzles/Puzzles";
import { BoardTab } from "./BoardTab";
import NewTabHome from "./NewTabHome";
import { useCallback } from "react";
import { useAtom } from "jotai";
import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import ConfirmChangesModal from "./ConfirmChangesModal";
import { match } from "ts-pattern";
import { Reorder } from "framer-motion";
import { commands } from "@/bindings";
import { unwrap } from "@/utils/invoke";

const useStyles = createStyles((theme) => ({
  newTab: {
    backgroundColor:
      theme.colorScheme === "dark"
        ? theme.colors.dark[7]
        : theme.colors.gray[0],
    ":hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[2],
    },
  },
}));

export default function BoardsPage() {
  const { classes } = useStyles();
  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [saveModalOpened, toggleSaveModal] = useToggle();

  const closeTab = useCallback(
    async (value: string | null, forced?: boolean) => {
      if (value !== null) {
        const closedTab = tabs.find((tab) => tab.value === value);
        const tabState = JSON.parse(sessionStorage.getItem(value) || "{}");
        if (tabState && closedTab?.file && tabState.dirty && !forced) {
          toggleSaveModal();
          return;
        } else if (value === activeTab) {
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
    [tabs, activeTab, setTabs, toggleSaveModal, setActiveTab]
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
        })
      );
    },
    [setTabs]
  );

  const duplicateTab = useCallback(
    (value: string) => {
      const id = genID();
      const tab = tabs.find((tab) => tab.value === value);
      if (sessionStorage.getItem(value)) {
        sessionStorage.setItem(id, sessionStorage.getItem(value) || "");
      }
      if (sessionStorage.getItem(value + "-tree")) {
        sessionStorage.setItem(
          id + "-tree",
          sessionStorage.getItem(value + "-tree") || ""
        );
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
    [tabs, setTabs, setActiveTab]
  );

  useHotkeys([
    [
      "ctrl+T",
      () =>
        createTab({
          tab: { name: "New Tab", type: "new" },
          setTabs,
          setActiveTab,
        }),
    ],
    ["ctrl+W", () => closeTab(activeTab)],
    ["ctrl+tab", () => cycleTabs()],
    ["ctrl+shift+tab", () => cycleTabs(true)],
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
    <>
      <ConfirmChangesModal
        opened={saveModalOpened}
        toggle={toggleSaveModal}
        closeTab={() => closeTab(activeTab, true)}
      />
      <Tabs
        value={activeTab}
        onTabChange={(v) => setActiveTab(v)}
        variant="outline"
        my="md"
        keepMounted={false}
      >
        <Stack>
          <ScrollArea offsetScrollbars sx={{ overflow: "visible" }}>
            <Reorder.Group
              axis="x"
              as="div"
              style={{
                display: "flex",
                flexDirection: "row",
                overflow: "hidden",
                marginBlockStart: 0,
              }}
              layoutScroll
              values={tabs}
              onReorder={setTabs}
            >
              {tabs.map((tab) => (
                <Reorder.Item
                  key={tab.value}
                  value={tab}
                  as="div"
                  onClick={() => setActiveTab(tab.value)}
                >
                  <BoardTab
                    tab={tab}
                    setActiveTab={setActiveTab}
                    closeTab={closeTab}
                    renameTab={renameTab}
                    duplicateTab={duplicateTab}
                    selected={activeTab === tab.value}
                  />
                </Reorder.Item>
              ))}
              <ActionIcon
                onClick={() =>
                  createTab({
                    tab: {
                      name: "New tab",
                      type: "new",
                    },
                    setTabs,
                    setActiveTab,
                  })
                }
                className={classes.newTab}
              >
                <IconPlus size={16} />
              </ActionIcon>
            </Reorder.Group>
          </ScrollArea>

          {tabs.map((tab) => (
            <Tabs.Panel key={tab.value} value={tab.value}>
              <TabSwitch tab={tab} />
            </Tabs.Panel>
          ))}
        </Stack>
      </Tabs>
    </>
  );
}

function TabSwitch({ tab }: { tab: Tab }) {
  return match(tab.type)
    .with("new", () => <NewTabHome id={tab.value} />)
    .with("play", () => (
      <TreeStateProvider id={tab.value}>
        <BoardGame />
      </TreeStateProvider>
    ))
    .with("analysis", () => (
      <TreeStateProvider id={tab.value}>
        <BoardAnalysis />
      </TreeStateProvider>
    ))
    .with("puzzles", () => <Puzzles id={tab.value} />)
    .exhaustive();
}
