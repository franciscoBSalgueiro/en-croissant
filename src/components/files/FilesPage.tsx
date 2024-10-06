import { capitalize } from "@/utils/format";
import {
  Button,
  Center,
  Chip,
  Group,
  Input,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { useLoaderData } from "@tanstack/react-router";
import {
  BaseDirectory,
  type DirEntry,
  type FileInfo,
  readDir,
  remove,
} from "@tauri-apps/plugin-fs";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import ConfirmModal from "../common/ConfirmModal";
import OpenFolderButton from "../common/OpenFolderButton";
import DirectoryTable from "./DirectoryTable";
import FileCard from "./FileCard";
import { CreateModal, EditModal } from "./Modals";
import {
  type FileMetadata,
  type FileType,
  processEntriesRecursively,
} from "./file";

const FILE_TYPES: FileType[] = [
  "game",
  "repertoire",
  "tournament",
  "puzzle",
  "other",
];

const useFileDirectory = (dir: string) => {
  const { data, error, isLoading, mutate } = useSWR(
    "file-directory",
    async () => {
      const entries = await readDir(dir);
      const allEntries = processEntriesRecursively(dir, entries);

      return allEntries;
    },
  );
  console.log(error);
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
  const [selected, setSelected] = useState<FileMetadata | null>(null);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const [filter, setFilter] = useState<FileType | null>(null);

  const [deleteModal, toggleDeleteModal] = useToggle();
  const [createModal, toggleCreateModal] = useToggle();
  const [editModal, toggleEditModal] = useToggle();

  useEffect(() => {
    setGames(new Map());
  }, [selected]);

  return (
    <Stack h="100%">
      {files && (
        <CreateModal
          opened={createModal}
          setOpened={toggleCreateModal}
          files={files}
          setFiles={mutate}
          setSelected={setSelected}
        />
      )}
      {selected && files && (
        <EditModal
          key={selected.name}
          opened={editModal}
          setOpened={toggleEditModal}
          mutate={mutate}
          setSelected={setSelected}
          metadata={selected}
        />
      )}
      <Group align="baseline" pl="lg" py="sm">
        <Title>{t("Files.Title")}</Title>
        <OpenFolderButton folder={documentDir} />
      </Group>

      <Group grow flex={1} style={{ overflow: "hidden" }} px="md" pb="md">
        <Stack h="100%">
          <Group>
            <Input
              style={{ flexGrow: 1 }}
              rightSection={<IconSearch size="1rem" />}
              placeholder={t("Files.Search")}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Button
              size="xs"
              leftSection={<IconPlus size="1rem" />}
              onClick={() => toggleCreateModal()}
            >
              {t("Common.Create")}
            </Button>
            <Button
              size="xs"
              color="red"
              disabled={!selected}
              leftSection={<IconX size="1rem" />}
              onClick={() => toggleDeleteModal()}
            >
              {t("Common.Delete")}
            </Button>
          </Group>
          <Group>
            {FILE_TYPES.map((type) => (
              <Chip
                variant="outline"
                key={type}
                onChange={(v) =>
                  setFilter((filter) =>
                    v ? type : filter === type ? null : filter,
                  )
                }
                checked={filter === type}
              >
                {t(`Files.FileType.${capitalize(type)}`)}
              </Chip>
            ))}
          </Group>

          <DirectoryTable
            files={files}
            setFiles={mutate}
            isLoading={isLoading}
            setSelectedFile={setSelected}
            selectedFile={selected}
            search={search}
            filter={filter || ""}
          />
        </Stack>

        {selected ? (
          <>
            <ConfirmModal
              title={t("Files.Delete.Title")}
              description={t("Files.Delete.Message", {
                fileName: selected.name,
              })}
              opened={deleteModal}
              onClose={toggleDeleteModal}
              onConfirm={async () => {
                await remove(selected.path);
                await remove(selected.path.replace(".pgn", ".info"));
                mutate(files?.filter((file) => file.name !== selected.name));
                toggleDeleteModal();
                setSelected(null);
              }}
            />
            <FileCard
              selected={selected}
              games={games}
              setGames={setGames}
              toggleEditModal={toggleEditModal}
            />
          </>
        ) : (
          <Center h="100%">
            <Text>No file selected</Text>
          </Center>
        )}
      </Group>
    </Stack>
  );
}
export default FilesPage;
