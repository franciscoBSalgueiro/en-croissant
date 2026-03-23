import { ActionIcon, Button, Menu } from "@mantine/core";
import { useClickOutside, useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconChess,
  IconCopy,
  IconDatabase,
  IconEdit,
  IconPuzzle,
  IconX,
  IconZoomCheck,
} from "@tabler/icons-react";
import cx from "clsx";
import { useEffect } from "react";
import type { Tab } from "@/utils/tabs";
import { InlineInput } from "../common/InlineInput";
import classes from "./BoardTab.module.css";
import { FileIcon } from "../files/FileIcon";
import { useTranslation } from "react-i18next";

export function BoardTab({
  tab,
  tabType,
  setActiveTab,
  closeTab,
  renameTab,
  duplicateTab,
  selected,
}: {
  tab: Tab;
  tabType: string;
  setActiveTab: (v: string) => void;
  closeTab: (v: string) => void;
  renameTab: (v: string, n: string) => void;
  duplicateTab: (v: string) => void;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const [open, toggleOpen] = useToggle();
  const [renaming, toggleRenaming] = useToggle();

  const ref = useClickOutside(() => {
    toggleOpen(false);
    toggleRenaming(false);
  });

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
          className={cx(classes.tab, { [classes.selected]: selected })}
          variant="default"
          fw="normal"
          radius={0}
          leftSection={<TabIcon tab={tab} tabType={tabType} />}
          rightSection={
            <ActionIcon
              component="div"
              className={classes.closeTabBtn}
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
            if (e.button === 0) setActiveTab(tab.value);
          }}
          onDoubleClick={() => toggleRenaming(true)}
          onAuxClick={(e) => {
            if (e.button === 1) closeTab(tab.value);
          }}
          onContextMenu={(e) => {
            toggleOpen();
            e.preventDefault();
          }}
        >
          <InlineInput
            ref={ref}
            disabled={!renaming}
            value={t(tab.name, { defaultValue: tab.name })}
            className={classes.input}
            onChange={(e) => renameTab(tab.value, e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                toggleRenaming(false);
                e.preventDefault();
              }
            }}
          />
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconCopy size="0.875rem" />}
          onClick={() => duplicateTab(tab.value)}
        >
          Duplicate Tab
        </Menu.Item>
        <Menu.Item leftSection={<IconEdit size="0.875rem" />} onClick={() => toggleRenaming(true)}>
          Rename Tab
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconX size="0.875rem" />}
          onClick={() => closeTab(tab.value)}
        >
          Close Tab
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function TabIcon({ tab, tabType }: { tab: Tab; tabType: string }) {
  if (tabType === "puzzles") {
    return <IconPuzzle size="0.875rem" />;
  }
  if (tabType === "play") {
    return <IconChess size="0.875rem" />;
  }
  if (tab.gameOrigin.kind === "database") {
    return <IconDatabase size="0.875rem" />;
  }
  if (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file") {
    return <FileIcon type={tab.gameOrigin.file.metadata.type} size="0.875rem" />;
  }
  if (tabType === "analysis") {
    return <IconZoomCheck size="0.875rem" />;
  }
  return null;
}
