import { ActionIcon, Stack, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowBack,
  IconCamera,
  IconDeviceFloppy,
  IconEdit,
  IconEditOff,
  IconEraser,
  IconSwitchVertical,
  IconTarget,
  IconZoomCheck,
} from "@tabler/icons-react";
import { useLoaderData } from "@tanstack/react-router";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import domtoimage from "dom-to-image-more";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  autoSaveAtom,
  currentTabAtom,
  eraseDrawablesOnClickAtom,
  tabsAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { getPGN } from "@/utils/chess";
import { createTab } from "@/utils/tabs";

interface BoardControlsProps {
  editingMode: boolean;
  toggleEditingMode: () => void;
  dirty: boolean;
  saveFile?: () => void;
  canTakeBack?: boolean;
  onTakeBack?: () => void;
  disableVariations?: boolean;
  allowEditing?: boolean;
}

function BoardControls({
  editingMode,
  toggleEditingMode,
  dirty,
  saveFile,
  canTakeBack,
  onTakeBack,
  disableVariations,
  allowEditing,
}: BoardControlsProps) {
  const { t } = useTranslation();
  const { documentDir } = useLoaderData({ from: "/" });

  const store = useContext(TreeStateContext)!;
  const headers = useStore(store, (s) => s.headers);
  const root = useStore(store, (s) => s.root);
  const selectedPosition = useStore(store, (s) => s.position);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const clearShapes = useStore(store, (s) => s.clearShapes);

  const keyMap = useAtomValue(keyMapAtom);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const setTabs = useSetAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const autoSave = useAtomValue(autoSaveAtom);
  const eraseDrawablesOnClick = useAtomValue(eraseDrawablesOnClickAtom);
  const creatingPlayTab = useRef(false);
  const [isCreatingPlayTab, setIsCreatingPlayTab] = useState(false);
  const modeActionLabel = t(
    currentTab?.type === "analysis" ? "Board.Action.PlayFromHere" : "Board.Action.AnalyzeGame",
  );

  const orientation = headers.orientation || "white";
  const toggleOrientation = () =>
    setHeaders({
      ...headers,
      fen: root.fen,
      orientation: orientation === "black" ? "white" : "black",
    });

  async function changeTabType() {
    if (creatingPlayTab.current) return;
    if (currentTab?.type !== "analysis") {
      setCurrentTab((tab) => ({ ...tab, type: "analysis" }));
      return;
    }

    // Block same-tick clicks before the loading state renders the button disabled.
    creatingPlayTab.current = true;
    setIsCreatingPlayTab(true);
    try {
      const playHeaders = { ...headers, fen: root.fen, result: "*" as const, start: [] };
      // An empty path skips even the FEN headers, so serialize a childless root instead.
      const pgn = getPGN(selectedPosition.length ? root : { ...root, children: [] }, {
        headers: playHeaders,
        path: selectedPosition.length ? selectedPosition : null,
        variations: false,
        comments: false,
        glyphs: false,
        extraMarkups: false,
      });
      await createTab({
        tab: { name: currentTab.name, type: "play" },
        setTabs,
        setActiveTab,
        pgn,
        headers: playHeaders,
        position: selectedPosition.map(() => 0),
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      void error(message).catch(console.error);
      notifications.show({ title: t("Common.Error"), message, color: "red" });
    } finally {
      creatingPlayTab.current = false;
      setIsCreatingPlayTab(false);
    }
  }

  const takeSnapshot = async () => {
    const snapshotTarget = document.querySelector(".cg-wrap") as HTMLElement | null;
    const board = snapshotTarget?.querySelector("cg-board");
    if (!snapshotTarget || !board) return;

    const { width, height } = board.getBoundingClientRect();
    domtoimage
      .toBlob(snapshotTarget, {
        width,
        height,
        style: { padding: "0", margin: "0", overflow: "hidden" },
      })
      .then(async (blob) => {
        if (blob == null) return;

        const filePath = await save({
          title: "Save board snapshot",
          defaultPath: documentDir,
          filters: [
            {
              name: "PNG Image",
              extensions: ["png"],
            },
          ],
        });
        const arrayBuffer = await blob.arrayBuffer();
        if (filePath == null) return;
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      });
  };

  return (
    <Stack gap={4} align="center">
      <Tooltip position="right" label={t("Board.Action.TakeSnapshot")}>
        <ActionIcon onClick={() => takeSnapshot()}>
          <IconCamera size="1.2rem" />
        </ActionIcon>
      </Tooltip>
      {canTakeBack && onTakeBack && (
        <Tooltip label="Take Back" position="right">
          <ActionIcon onClick={() => onTakeBack()}>
            <IconArrowBack />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip position="right" label={modeActionLabel}>
        <ActionIcon
          onClick={changeTabType}
          aria-label={modeActionLabel}
          aria-busy={isCreatingPlayTab}
          loading={isCreatingPlayTab}
        >
          {currentTab?.type === "analysis" ? (
            <IconTarget size="1.2rem" />
          ) : (
            <IconZoomCheck size="1.2rem" />
          )}
        </ActionIcon>
      </Tooltip>
      {!eraseDrawablesOnClick && (
        <Tooltip position="right" label={t("Board.Action.ClearDrawings")}>
          <ActionIcon onClick={() => clearShapes()}>
            <IconEraser size="1.2rem" />
          </ActionIcon>
        </Tooltip>
      )}
      {(!disableVariations || allowEditing) && (
        <Tooltip position="right" label={t("Board.Action.EditPosition")}>
          <ActionIcon onClick={() => toggleEditingMode()}>
            {editingMode ? <IconEditOff size="1.2rem" /> : <IconEdit size="1.2rem" />}
          </ActionIcon>
        </Tooltip>
      )}

      {saveFile && (
        <Tooltip position="right" label={t("Board.Action.SavePGN", { key: keyMap.SAVE_FILE.keys })}>
          <ActionIcon
            onClick={() => saveFile()}
            variant={dirty && !autoSave ? "default" : "transparent"}
          >
            <IconDeviceFloppy size="1.2rem" />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip
        position="right"
        label={t("Board.Action.FlipBoard", {
          key: keyMap.SWAP_ORIENTATION.keys,
        })}
      >
        <ActionIcon onClick={() => toggleOrientation()}>
          <IconSwitchVertical size="1.2rem" />
        </ActionIcon>
      </Tooltip>
    </Stack>
  );
}

export default memo(BoardControls);
