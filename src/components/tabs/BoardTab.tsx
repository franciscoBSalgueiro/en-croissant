import { ActionIcon, Button, createStyles, Menu } from "@mantine/core";
import { useClickOutside, useHotkeys, useToggle } from "@mantine/hooks";
import { IconCopy, IconEdit, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import type { Tab } from "@/utils/tabs";
import { ContentEditable } from "./ContentEditable";

const useStyles = createStyles(
  (
    theme,
    { selected, renaming }: { selected: boolean; renaming: boolean }
  ) => ({
    tab: {
      cursor: "unset",
      borderBottomWidth: 0,
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
      minWidth: 100,
      outline: "none",
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
        <Button
          component="div"
          className={classes.tab}
          variant="default"
          fw="normal"
          rightIcon={
            <ActionIcon
              component="div"
              onClick={(e) => {
                closeTab(tab.value);
                e.stopPropagation();
              }}
              size="0.875rem"
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
          <ContentEditable
            innerRef={ref}
            disabled={!renaming}
            html={tab.name}
            className={classes.input}
            onChange={(e) => renameTab(tab.value, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") toggleRenaming(false);
            }}
          />
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          icon={<IconCopy size="0.875rem" />}
          onClick={() => duplicateTab(tab.value)}
        >
          Duplicate Tab
        </Menu.Item>
        <Menu.Item
          icon={<IconEdit size="0.875rem" />}
          onClick={() => toggleRenaming(true)}
        >
          Rename Tab
        </Menu.Item>
        <Menu.Item
          color="red"
          icon={<IconX size="0.875rem" />}
          onClick={() => closeTab(tab.value)}
        >
          Close Tab
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
