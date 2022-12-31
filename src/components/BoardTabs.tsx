import { CloseButton, Group, Stack, Tabs } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons";
import { useState } from "react";
import BoardAnalysis from "./BoardAnalysis";

interface Tab {
  name: string;
  value: string;
  component: React.ReactNode;
}

function genID() {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return S4() + S4();
}

export default function BoardTabs() {
  const firstId = genID();
  const [activeTab, setActiveTab] = useState<string | null>(firstId);
  const [tabs, setTabs] = useState<Tab[]>([
    {
      name: "First tab",
      value: firstId,
      component: <BoardAnalysis />,
    },
  ]);
  console.log(tabs);

  function createTab() {
    const id = genID();
    setTabs((prev) => [
      ...prev,
      {
        name: "New tab",
        value: id,
        component: <BoardAnalysis />,
      },
    ]);
    setActiveTab(id);
  }

  function onTabChange(value: string) {
    if (value === "add") {
      createTab();
      return;
    }
    setActiveTab(value);
  }

  function closeTab(value: string | null) {
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
          <Tabs value={activeTab} onTabChange={onTabChange}>
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Tab
                  key={tab.value}
                  value={tab.value}
                  rightSection={
                    <CloseButton
                      size={14}
                      onClick={() => closeTab(tab.value)}
                    />
                  }
                >
                  {tab.name}
                </Tabs.Tab>
              ))}
              <Tabs.Tab icon={<IconPlus size={14} />} value="add" />
            </Tabs.List>

            {tabs.map((tab) => (
              <Tabs.Panel key={tab.value} value={tab.value}>
                {tab.component}
              </Tabs.Panel>
            ))}
          </Tabs>
        </Group>
      </Stack>
    </>
  );
}
