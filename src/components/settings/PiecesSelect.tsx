import {
  ActionIcon,
  Box,
  Button,
  Combobox,
  Flex,
  Group,
  Input,
  InputBase,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  useCombobox,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconFileImport,
  IconFolder,
  IconFolderOpen,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { customPieceSetsRevisionAtom, pieceSetAtom } from "@/state/atoms";
import {
  type CustomPieceSet,
  type CustomPieceSetError,
  deleteCustomPieceSet,
  getCustomPieceSetsDir,
  type ImportPieceSetResult,
  importCustomPieceSetFromCssFile,
  importCustomPieceSetFromFolder,
  invalidateCustomPieceSets,
  listCustomPieceSets,
} from "@/utils/customPieceSets";
import {
  BUILTIN_PIECE_SETS,
  customPieceSetName,
  DEFAULT_PIECE_SET,
  formatSlots,
  isCustomPieceSetId,
} from "@/utils/pieceSets";
import PieceComponent from "../common/Piece";

function DisplayPieces() {
  const pieces = ["rook", "knight", "bishop", "queen", "king", "pawn"] as const;
  return (
    <Flex gap="xs">
      {pieces.map((role, index) => (
        <Box key={index} h="2.5rem" w="2.5rem">
          <PieceComponent piece={{ color: "white", role }} />
        </Box>
      ))}
    </Flex>
  );
}

export default function PiecesSelect() {
  const { t } = useTranslation();
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [pieceSet, setPieceSet] = useAtom(pieceSetAtom);
  const bumpRevision = useSetAtom(customPieceSetsRevisionAtom);
  const [customSets, setCustomSets] = useState<CustomPieceSet[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    invalidateCustomPieceSets();
    setCustomSets(await listCustomPieceSets());
    // Forces the theme loader to re-read the stylesheet from disk.
    bumpRevision((revision) => revision + 1);
  }, [bumpRevision]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function errorMessage(error: CustomPieceSetError) {
    if (error === "empty") return t("Settings.Appearance.PieceSet.Error.Empty");
    if (error === "no-rules") return t("Settings.Appearance.PieceSet.Error.NoRules");
    if (error === "too-large") return t("Settings.Appearance.PieceSet.Error.TooLarge");
    if (error === "no-images") return t("Settings.Appearance.PieceSet.Error.NoImages");
    return t("Settings.Appearance.PieceSet.Error.Failed");
  }

  async function handleResult(result: ImportPieceSetResult) {
    if (!result.ok) {
      notifications.show({
        color: "red",
        title: t("Common.Error"),
        message: errorMessage(result.error),
      });
      return;
    }

    setPieceSet(result.set.id);
    await refresh();
    notifications.show({
      color: "green",
      title: t("Settings.Appearance.PieceSet.Added"),
      message: result.set.name,
    });
  }

  async function importCss() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "CSS", extensions: ["css"] }],
    });
    if (typeof selected !== "string") return;

    setBusy(true);
    try {
      await handleResult(await importCustomPieceSetFromCssFile(selected));
    } finally {
      setBusy(false);
    }
  }

  async function importFolder() {
    const selected = await open({ multiple: false, directory: true });
    if (typeof selected !== "string") return;

    setBusy(true);
    try {
      await handleResult(await importCustomPieceSetFromFolder(selected));
    } finally {
      setBusy(false);
    }
  }

  async function openPiecesFolder() {
    try {
      await openPath(await getCustomPieceSetsDir());
    } catch {
      notifications.show({
        color: "red",
        title: t("Common.Error"),
        message: errorMessage("failed"),
      });
    }
  }

  async function deleteSelected() {
    const name = customPieceSetName(pieceSet);
    const confirmed = await ask(t("Settings.Appearance.PieceSet.DeleteConfirm", { name }), {
      title: t("Common.Delete"),
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await deleteCustomPieceSet(name);
      setPieceSet(DEFAULT_PIECE_SET);
      await refresh();
      notifications.show({
        color: "green",
        title: t("Settings.Appearance.PieceSet.Deleted"),
        message: name,
      });
    } catch {
      notifications.show({
        color: "red",
        title: t("Common.Error"),
        message: errorMessage("failed"),
      });
    } finally {
      setBusy(false);
    }
  }

  const options = [
    ...BUILTIN_PIECE_SETS.map((item) => (
      <Combobox.Option
        value={item.value}
        key={item.value}
        onMouseOver={() => setPieceSet(item.value)}
      >
        <Text fz="sm" fw={500}>
          {item.label}
        </Text>
      </Combobox.Option>
    )),
    ...customSets.map((item) => (
      <Combobox.Option value={item.id} key={item.id} onMouseOver={() => setPieceSet(item.id)}>
        <Group gap="xs" wrap="nowrap">
          <Text fz="sm" fw={500}>
            {item.name}
          </Text>
          <Text fz="xs" c="dimmed">
            {t("Settings.Appearance.PieceSet.Custom")}
          </Text>
        </Group>
      </Combobox.Option>
    )),
  ];

  const builtin = BUILTIN_PIECE_SETS.find((set) => set.value === pieceSet);
  const custom = customSets.find((set) => set.id === pieceSet);
  const label =
    builtin?.label ??
    custom?.name ??
    (isCustomPieceSetId(pieceSet) ? customPieceSetName(pieceSet) : undefined);

  return (
    <Stack gap="xs">
      <Flex justify="space-between" align="center" gap="md">
        <DisplayPieces />
        <Combobox
          store={combobox}
          withinPortal={false}
          onOptionSubmit={(val) => {
            setPieceSet(val);
            combobox.closeDropdown();
          }}
        >
          <Combobox.Target>
            <InputBase
              component="button"
              type="button"
              pointer
              onClick={() => combobox.toggleDropdown()}
              multiline
              w="10rem"
            >
              {label ? (
                <Text fz="sm" fw={500}>
                  {label}
                </Text>
              ) : (
                <Input.Placeholder>{t("Common.PickValue")}</Input.Placeholder>
              )}
            </InputBase>
          </Combobox.Target>

          <Combobox.Dropdown>
            <Combobox.Options>
              <ScrollArea.Autosize mah={200} type="always" scrollbars="y">
                {options}
              </ScrollArea.Autosize>
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
      </Flex>

      <Group gap="xs" justify="flex-end">
        <Button
          size="xs"
          variant="default"
          leftSection={<IconFileImport size="1rem" />}
          onClick={importCss}
          disabled={busy}
        >
          {t("Settings.Appearance.PieceSet.ImportCss")}
        </Button>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconFolderOpen size="1rem" />}
          onClick={importFolder}
          disabled={busy}
        >
          {t("Settings.Appearance.PieceSet.ImportFolder")}
        </Button>
        <Tooltip label={t("Common.OpenFolder")}>
          <ActionIcon variant="default" onClick={openPiecesFolder} disabled={busy}>
            <IconFolder size="1.25rem" />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("Settings.Appearance.PieceSet.Refresh")}>
          <ActionIcon variant="default" onClick={refresh} disabled={busy}>
            <IconRefresh size="1.25rem" />
          </ActionIcon>
        </Tooltip>
        {isCustomPieceSetId(pieceSet) && (
          <Tooltip label={t("Common.Delete")}>
            <ActionIcon variant="default" color="red" onClick={deleteSelected} disabled={busy}>
              <IconTrash size="1.25rem" />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {custom && custom.missing.length > 0 && (
        <Text fz="xs" c="dimmed" ta="right">
          {t("Settings.Appearance.PieceSet.MissingPieces", { pieces: formatSlots(custom.missing) })}
        </Text>
      )}
      {custom && custom.externalUrls.length > 0 && (
        <Text fz="xs" c="orange" ta="right">
          {t("Settings.Appearance.PieceSet.ExternalImages")}
        </Text>
      )}
      {customSets.length === 0 && (
        <Text fz="xs" c="dimmed" ta="right">
          {t("Settings.Appearance.PieceSet.NoCustom")}
        </Text>
      )}
      {customSets.length === 0 && (
        <Text fz="xs" c="dimmed" ta="right">
          {t("Settings.Appearance.PieceSet.Hint")}
        </Text>
      )}
    </Stack>
  );
}
