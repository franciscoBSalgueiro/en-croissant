import {
  CloseButton,
  createStyles,
  Group,
  Menu,
  Stack,
  Tabs
} from "@mantine/core";
import {
  useClickOutside,
  useHotkeys,
  useSessionStorage,
  useToggle
} from "@mantine/hooks";
import { IconCopy, IconEdit, IconPlus, IconX } from "@tabler/icons";
import { useEffect } from "react";
import BoardAnalysis from "./BoardAnalysis";

const useStyles = createStyles(
  (
    theme,
    { selected, renaming }: { selected: boolean; renaming: boolean }
  ) => ({
    tab: {
      marginRight: theme.spacing.xs,
      backgroundColor: selected ? theme.colors.dark[6] : theme.colors.dark[7],
      ":hover": {
        backgroundColor: theme.colors.dark[6],
      },
    },

    input: {
      all: "unset",
      cursor: renaming ? "text" : "pointer",
      textDecoration: renaming ? "underline" : "none",

      "::selection": {
        backgroundColor: renaming ? theme.colors.blue[6] : "transparent",
      },
    },
  })
);

export interface Tab {
  name: string;
  value: string;
}

export function genID() {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return S4() + S4();
}

function BoardTab({
  tab,
  closeTab,
  renameTab,
  duplicateTab,
  selected,
}: {
  tab: Tab;
  closeTab: (v: string) => void;
  renameTab: (v: string, n: string) => void;
  duplicateTab: (v: string) => void;
  selected: boolean;
}) {
  const [open, toggleOpen] = useToggle();
  const [renaming, toggleRenaming] = useToggle();
  const ref = useClickOutside(() => {
    toggleOpen(false), toggleRenaming(false);
  });
  const { classes } = useStyles({ selected, renaming });

  useHotkeys([
    [
      "F2",
      () => {
        if (selected) toggleRenaming();
      },
    ],
  ]);

  useEffect(() => {
    if (renaming) ref.current?.focus();
  }, [renaming]);

  return (
    <Menu opened={open} shadow="md" width={200}>
      <Menu.Target>
        <Tabs.Tab
          className={classes.tab}
          key={tab.value}
          value={tab.value}
          rightSection={
            <CloseButton
              component="div"
              size={14}
              onClick={() => closeTab(tab.value)}
            />
          }
          onContextMenu={(e: any) => {
            toggleOpen();
            e.preventDefault();
          }}
        >
          <input
            ref={ref}
            value={tab.name}
            onChange={(event) =>
              renameTab(tab.value, event.currentTarget.value)
            }
            readOnly={!renaming}
            className={classes.input}
            onKeyDown={(e) => {
              if (e.key === "Enter") toggleRenaming(false);
            }}
          />
        </Tabs.Tab>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          icon={<IconCopy size={14} />}
          onClick={() => duplicateTab(tab.value)}
        >
          Duplicate Tab
        </Menu.Item>
        <Menu.Item
          icon={<IconEdit size={14} />}
          onClick={() => toggleRenaming(true)}
        >
          Rename Tab
        </Menu.Item>
        <Menu.Item
          color="red"
          icon={<IconX size={14} />}
          onClick={() => closeTab(tab.value)}
        >
          Close Tab
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default function BoardTabs() {
  const firstId = genID();
  const [tabs, setTabs] = useSessionStorage<Tab[]>({
    key: "tabs",
    defaultValue: [],
  });
  const [activeTab, setActiveTab] = useSessionStorage<string | null>({
    key: "activeTab",
    defaultValue: firstId,
  });

  function createTab() {
    const id = genID();

    setTabs((prev) => [
      ...prev,
      {
        name: "New tab",
        value: id,
      },
    ]);
    setActiveTab(id);
    return id;
  }

  function onTabChange(value: string) {
    if (value === "add") {
      createTab();
      return;
    }
    setActiveTab(value);
  }

  function closeTab(value: string | null) {
    if (value !== null) {
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
    }
  }

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

  function renameTab(value: string, name: string) {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.value === value) {
          return { ...tab, name };
        }
        return tab;
      })
    );
  }

  function duplicateTab(value: string) {
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
        },
      ]);
      setActiveTab(id);
    }
  }

  useHotkeys([
    ["ctrl+T", () => createTab()],
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
      <Stack>
        <Group grow>
          <Tabs value={activeTab} onTabChange={onTabChange} variant="outline">
            <Tabs.List>
              {tabs.map((tab) => (
                <BoardTab
                  key={tab.value}
                  tab={tab}
                  closeTab={closeTab}
                  renameTab={renameTab}
                  duplicateTab={duplicateTab}
                  selected={activeTab === tab.value}
                />
              ))}
              <Tabs.Tab icon={<IconPlus size={14} />} value="add" />
            </Tabs.List>

            {tabs.map((tab) => (
              <Tabs.Panel key={tab.value} value={tab.value}>
                <BoardAnalysis id={tab.value} />
              </Tabs.Panel>
            ))}
          </Tabs>
        </Group>
      </Stack>
    </>
  );
}
