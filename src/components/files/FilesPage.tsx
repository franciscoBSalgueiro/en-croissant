import {
  ActionIcon,
  Center,
  Chip,
  Divider,
  Group,
  Input,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconFileDescription,
  IconFilePlus,
  IconFolderPlus,
  IconSearch,
  IconFolder,
} from "@tabler/icons-react";
import { useLoaderData } from "@tanstack/react-router";
import { readDir, remove } from "@tauri-apps/plugin-fs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { capitalize } from "@/utils/format";
import ConfirmModal from "../common/ConfirmModal";
import OpenFolderButton from "../common/OpenFolderButton";
import DirectoryTree from "./DirectoryTree";
import { DragContext } from "./DirectoryTree";
import FileCard from "./FileCard";
import {
  type Directory,
  type FileMetadata,
  type FileType,
  processEntriesRecursively,
} from "./file";
import { CreateDirectoryModal, CreateModal, EditModal } from "./Modals";

const FILE_TYPES: FileType[] = ["game", "repertoire", "tournament", "puzzle", "other"];
type Entry = FileMetadata | Directory;

function findEntryByPath(entries: Entry[], path: string): Entry | null {
  for (const entry of entries) {
    if (entry.path === path) {
      return entry;
    }

    if (entry.type === "directory") {
      const child = findEntryByPath(entry.children, path);
      if (child) {
        return child;
      }
    }
  }

  return null;
}

const useFileDirectory = (dir: string) => {
  const { data, error, isLoading, mutate } = useSWR<Entry[]>(["file-directory", dir], async () => {
    const entries = await readDir(dir);
    const allEntries = processEntriesRecursively(dir, entries);

    return allEntries;
  });
  return {
    files: data,
    isLoading,
    error,
    mutate,
  };
};

function FilesPage() {
  const { t } = useTranslation();

  const { documentDir } = useLoaderData({ from: "/files" });
  const { files, isLoading, error, mutate } = useFileDirectory(documentDir);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const [filter, setFilter] = useState<FileType | null>(null);

  const [deleteModal, toggleDeleteModal] = useToggle();
  const [createModal, toggleCreateModal] = useToggle();
  const [createDirModal, toggleCreateDirModal] = useToggle();
  const [editModal, toggleEditModal] = useToggle();

  const searchInputRef = useRef<HTMLInputElement>(null);

  useHotkeys([
    ["mod+f", () => searchInputRef.current?.focus()],
    [
      "Delete",
      () => {
        if (selected && !deleteModal) {
          toggleDeleteModal();
        }
      },
    ],
  ]);

  useEffect(() => {
    setGames(new Map());
  }, [selected]);

  useEffect(() => {
    if (!files || !selected) {
      return;
    }

    const canonicalSelection = findEntryByPath(files, selected.path);

    if (!canonicalSelection) {
      setSelected(null);
      return;
    }

    if (canonicalSelection !== selected) {
      setSelected(canonicalSelection);
    }
  }, [files, selected]);

  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [hoverPath, setHoverPath] = useState<string | null>(null);
  const folderRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerFolder = useCallback((path: string, ref: HTMLDivElement | null) => {
    if (ref) {
      folderRefs.current.set(path, ref);
    } else {
      folderRefs.current.delete(path);
    }
  }, []);

  const checkHover = useCallback(
    (clientX: number, clientY: number) => {
      let hovered: string | null = null;
      let minArea = Infinity;

      // Check all folder row bounding rects
      // Since child folders are visually inside their parent's bounding box sometimes depending
      // on DOM flow, we want the most specific (smallest) matched box
      for (const [path, ref] of folderRefs.current.entries()) {
        const rect = ref.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          const area = rect.width * rect.height;
          if (area < minArea) {
            minArea = area;
            hovered = path;
          }
        }
      }

      // If no specific folder hovered, check if over the general documentDir space
      if (!hovered && dropzoneRef.current) {
        const rect = dropzoneRef.current.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          hovered = documentDir;
        }
      }

      setHoverPath(hovered);
    },
    [documentDir],
  );

  const dropzoneRef = useRef<HTMLDivElement>(null);

  const requestDelete = useCallback(
    (entry: Entry) => {
      setSelected(entry);
      if (!deleteModal) {
        toggleDeleteModal();
      }
    },
    [deleteModal, toggleDeleteModal],
  );

  const refreshDirectory = useCallback(() => mutate(), [mutate]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selected) {
      return;
    }

    if (selected.type === "directory") {
      await remove(selected.path, { recursive: true });
    } else {
      await remove(selected.path);
      await remove(selected.path.replace(".pgn", ".info")).catch(() => {});
    }

    await mutate();
    toggleDeleteModal();
    setSelected(null);
  }, [selected, mutate, toggleDeleteModal]);

  const dragContextValue = useMemo(
    () => ({
      draggingPath,
      setDraggingPath,
      hoverPath,
      setHoverPath,
      registerFolder,
      checkHover,
      documentDir,
    }),
    [draggingPath, hoverPath, registerFolder, checkHover, documentDir],
  );

  return (
    <Stack h="100%">
      {files && (
        <CreateModal
          opened={createModal}
          setOpened={toggleCreateModal}
          files={files}
          setFiles={mutate}
          setSelected={setSelected}
          selected={selected}
        />
      )}
      <CreateDirectoryModal
        opened={createDirModal}
        setOpened={toggleCreateDirModal}
        mutate={mutate}
        selected={selected}
      />
      {selected && files && selected.type === "file" && (
        <EditModal
          key={selected.name}
          opened={editModal}
          setOpened={toggleEditModal}
          mutate={mutate}
          setSelected={setSelected}
          metadata={selected as FileMetadata}
        />
      )}
      <Group align="baseline" pl="lg" py="sm">
        <Title>{t("Files.Title")}</Title>
        <OpenFolderButton folder={documentDir} />
      </Group>

      <Group grow flex={1} style={{ overflow: "hidden" }} px="md" pb="md">
        <Paper withBorder style={{ borderWidth: 2 }} h="100%">
          <Stack ref={dropzoneRef} gap={0} h="100%" style={{ overflow: "hidden" }}>
            <Group p="xs" gap="xs">
              <Input
                size="sm"
                style={{ flexGrow: 1 }}
                leftSection={<IconSearch size="1rem" />}
                placeholder={t("Common.Search")}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                ref={searchInputRef}
                onKeyDown={(e) => {
                  if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                  }
                  if (e.key === "Escape") {
                    setSearch("");
                    searchInputRef.current?.blur();
                  }
                }}
              />
              <Tooltip label={t("Files.CreateFile.Title")}>
                <ActionIcon variant="default" size="lg" onClick={() => toggleCreateModal()}>
                  <IconFilePlus size="1rem" />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t("Files.CreateDirectory.Title")}>
                <ActionIcon variant="default" size="lg" onClick={() => toggleCreateDirModal()}>
                  <IconFolderPlus size="1rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Divider />
            <Group px="xs" py={6} gap={4} wrap="wrap">
              {FILE_TYPES.map((type) => (
                <Chip
                  variant="outline"
                  key={type}
                  size="sm"
                  checked={filter === type}
                  onChange={(checked) => setFilter(checked ? type : null)}
                >
                  {t(`Files.FileType.${capitalize(type)}`)}
                </Chip>
              ))}
            </Group>
            <Divider />
            <ScrollArea flex={1}>
              {error ? (
                <Center h="100%">
                  <Text c="red">{t("Files.LoadingFailed")}</Text>
                </Center>
              ) : isLoading ? (
                <Center h="100%">
                  <Text c="dimmed">{t("Common.Loading")}</Text>
                </Center>
              ) : (
                <DragContext.Provider value={dragContextValue}>
                  <DirectoryTree
                    files={files}
                    refreshDirectory={refreshDirectory}
                    selectedFile={selected}
                    setSelectedFile={setSelected}
                    onRequestDelete={requestDelete}
                    search={search}
                    filter={filter || ""}
                  />
                </DragContext.Provider>
              )}
            </ScrollArea>
          </Stack>
        </Paper>

        {selected ? (
          <>
            <ConfirmModal
              title={t("Files.Delete.Title")}
              description={t("Files.Delete.Message", {
                fileName: selected.name,
              })}
              opened={deleteModal}
              onClose={toggleDeleteModal}
              onConfirm={handleConfirmDelete}
            />
            {selected.type === "file" ? (
              <Paper withBorder style={{ borderWidth: 2 }} pt="md" h="100%">
                <FileCard
                  selected={selected}
                  games={games}
                  setGames={setGames}
                  toggleEditModal={toggleEditModal}
                />
              </Paper>
            ) : (
              <Paper withBorder style={{ borderWidth: 2 }} p="md" h="100%">
                <Center h="100%">
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={80} radius="100%" variant="light" color="gray">
                      <IconFolder size={40} />
                    </ThemeIcon>
                    <Text fw={600} size="lg">
                      {selected.name}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {(selected as Directory).children.length === 1
                        ? "1 item"
                        : `${(selected as Directory).children.length} items`}
                    </Text>
                  </Stack>
                </Center>
              </Paper>
            )}
          </>
        ) : (
          <Paper withBorder style={{ borderWidth: 2 }} p="md" h="100%">
            <Center h="100%">
              <Stack align="center" gap="sm">
                <ThemeIcon size={80} radius="100%" variant="light" color="gray">
                  <IconFileDescription size={40} />
                </ThemeIcon>
                <Text c="dimmed" fw={500} size="lg">
                  {t("Files.NoSelection")}
                </Text>
              </Stack>
            </Center>
          </Paper>
        )}
      </Group>
    </Stack>
  );
}
export default FilesPage;
