import { CloseButton, createStyles, Menu, Tabs } from "@mantine/core";
import { useClickOutside, useHotkeys, useToggle } from "@mantine/hooks";
import { IconCopy, IconEdit, IconX } from "@tabler/icons";
import { useEffect } from "react";
import { Tab } from "./BoardsPage";

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

export function BoardTab({
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
          onDoubleClick={() => toggleRenaming(true)}
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
