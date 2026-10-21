import { ActionIcon, Divider, Group, Paper, ScrollArea, Stack, Tooltip } from "@mantine/core";
import {
  IconArrowRight,
  IconArrowsSplit,
  IconArticle,
  IconArticleOff,
  IconEye,
  IconEyeOff,
  IconLayoutList,
  IconList,
} from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { memo, type ReactNode, useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  currentInvisibleAtom,
  currentShowCommentsAtom,
  currentShowVariationsAtom,
  tableViewAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import OpeningName from "./OpeningName";
import VirtualizedNotation from "./VirtualizedNotation";

function GameNotation({ topBar, controls }: { topBar?: boolean; controls?: ReactNode }) {
  const store = useContext(TreeStateContext)!;
  const copyPgn = useStore(store, (s) => s.copyPgn);

  const [invisibleValue, setInvisible] = useAtom(currentInvisibleAtom);
  const invisible = topBar && invisibleValue;

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.TOGGLE_BLUR.keys, () => setInvisible((v) => !v));
  useHotkeys(keyMap.COPY_PGN.keys, () => copyPgn());

  return (
    <Paper withBorder flex={1} style={{ position: "relative", overflow: "hidden" }}>
      <Group h="100%" wrap="nowrap" align="stretch" gap={0}>
        {controls && (
          <>
            <ScrollArea type="never" py="md" mx="xs" style={{ flexShrink: 0 }}>
              {controls}
            </ScrollArea>
            <Divider orientation="vertical" />
          </>
        )}
        <Stack h="100%" gap={0} style={{ flex: 1, minWidth: 0 }}>
          {topBar && <NotationHeader />}
          <VirtualizedNotation invisible={invisible} />
        </Stack>
      </Group>
    </Paper>
  );
}

function NotationHeader() {
  const { t } = useTranslation();
  const [invisible, setInvisible] = useAtom(currentInvisibleAtom);
  const [showComments, setShowComments] = useAtom(currentShowCommentsAtom);
  const [showVariations, setShowVariations] = useAtom(currentShowVariationsAtom);
  const [tableView, setTableView] = useAtom(tableViewAtom);
  return (
    <Stack gap="xs" pt="xs">
      <Group justify="space-between" px="sm">
        <OpeningName />
        <Group gap="sm">
          <Tooltip label={invisible ? t("Notation.ShowMoves") : t("Notation.HideMoves")}>
            <ActionIcon onClick={() => setInvisible((v) => !v)}>
              {invisible ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tableView ? t("Notation.NormalView") : t("Notation.TableView")}>
            <ActionIcon onClick={() => setTableView((v) => !v)}>
              {tableView ? <IconList size="1rem" /> : <IconLayoutList size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={showComments ? t("Notation.HideComments") : t("Notation.ShowComments")}>
            <ActionIcon onClick={() => setShowComments((v) => !v)}>
              {showComments ? <IconArticle size="1rem" /> : <IconArticleOff size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={showVariations ? t("Notation.HideVariations") : t("Notation.ShowVariations")}
          >
            <ActionIcon onClick={() => setShowVariations((v) => !v)}>
              {showVariations ? <IconArrowsSplit size="1rem" /> : <IconArrowRight size="1rem" />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Divider />
    </Stack>
  );
}

export default memo(GameNotation);
