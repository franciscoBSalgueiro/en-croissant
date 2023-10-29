import {
  ActionIcon,
  createStyles,
  Menu,
  Tabs,
  Tooltip,
} from "@mantine/core";
import { useClickOutside, useHotkeys, useToggle } from "@mantine/hooks";
import { IconCopy, IconEdit, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import type { Tab } from "@/utils/tabs";

const useStyles = createStyles(
  (
    theme,
    { selected, renaming }: { selected: boolean; renaming: boolean }
  ) => ({
    tab: {
      marginRight: theme.spacing.xs,
      backgroundColor: selected
        ? theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0]
        : theme.colorScheme === "dark"
        ? theme.colors.dark[7]
        : "transparent",
      ":hover": {
        backgroundColor:
          theme.colorScheme === "dark"
            ? theme.colors.dark[6]
            : theme.colors.gray[2],
      },
    },

    input: {
      all: "unset",
      cursor: renaming ? "text" : "pointer",
      textDecoration: renaming ? "underline" : "none",

      "::selection": {
        backgroundColor: renaming
          ? theme.colorScheme === "dark"
            ? theme.colors.blue[6]
            : theme.colors.blue[4]
          : "transparent",
      },
    },
  })
);

export function BoardTab({
  tab,
  setActiveTab,
  closeTab,
  renameTab,
  duplicateTab,
  selected,
}: {
  tab: Tab;
  setActiveTab: (v: string) => void;
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
  }, [renaming, ref]);

  return (
    <Menu opened={open} shadow="md" width={200} closeOnClickOutside>
      <Menu.Target>
        <Tooltip label={tab.name} key={tab.value}>
          <Tabs.Tab
            className={classes.tab}
            value={tab.value}
            rightSection={
              <ActionIcon
                onClick={(e) => {
                  closeTab(tab.value);
                  e.stopPropagation();
                }}
                size={14}
              >
                <IconX />
              </ActionIcon>
            }
            onPointerDown={(e) => {
              if (e.button == 0) {
                setActiveTab(tab.value);
              }
            }}
            onDoubleClick={() => toggleRenaming(true)}
            onAuxClick={(e) => {
              // middle button click
              if (e.button == 1) {
                closeTab(tab.value);
              }
            }}
            onContextMenu={(e) => {
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
        </Tooltip>
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
