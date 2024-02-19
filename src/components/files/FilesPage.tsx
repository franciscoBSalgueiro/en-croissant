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
import { readDir, removeFile } from "@tauri-apps/api/fs";
import { documentDir, resolve } from "@tauri-apps/api/path";
import React, { useEffect, useState } from "react";
import useSWR from "swr";
import ConfirmModal from "../common/ConfirmModal";
import OpenFolderButton from "../common/OpenFolderButton";
import DirectoryTable from "./DirectoryTable";
import FileCard from "./FileCard";
import { CreateModal, EditModal } from "./Modals";
import { FileMetadata, FileType, readFileMetadata } from "./file";

const FILE_TYPES: FileType[] = [
  "game",
  "repertoire",
  "tournament",
  "puzzle",
  "other",
];

export type MetadataOrEntry = {
  name: string;
  path: string;
  children?: MetadataOrEntry[];
} & Partial<FileMetadata>;

async function processFiles(
  files: MetadataOrEntry[],
): Promise<MetadataOrEntry[]> {
  const filesInfo = await Promise.all(
    files.map((f) => readFileMetadata(f.name, f.path, f.children)),
  );
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.children) {
      filesInfo[i] = {
        name: file.name || "",
        path: file.path,
        children: await processFiles(file.children),
      };
    }
  }
  return filesInfo.filter((f) => f !== null) as MetadataOrEntry[];
}

const useFileDirectory = () => {
  const { data, error, isLoading, mutate } = useSWR(
    "file-directory",
    async () => {
      const dir = await resolve(await documentDir(), "EnCroissant");
      const files = await readDir(dir, { recursive: true });
      const filesInfo = await processFiles(files as MetadataOrEntry[]);

      return filesInfo;
    },
  );
  return {
    files: data,
    isLoading,
    error,
    mutate,
  };
};

function FilesPage() {
  const { files, isLoading, error, mutate } = useFileDirectory();

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
          files={files}
          setFiles={mutate}
          setSelected={setSelected}
          metadata={selected}
        />
      )}
      <Group align="baseline" pl="lg" py="sm">
        <Title>Files</Title>
        <OpenFolderButton base="Document" folder="EnCroissant" />
      </Group>

      <Group grow flex={1} style={{ overflow: "hidden" }} px="md" pb="md">
        <Stack h="100%">
          <Group>
            <Input
              style={{ flexGrow: 1 }}
              rightSection={<IconSearch size="1rem" />}
              placeholder="Search for files"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Button
              size="xs"
              leftSection={<IconPlus size="1rem" />}
              onClick={() => toggleCreateModal()}
            >
              Create
            </Button>
            <Button
              size="xs"
              color="red"
              disabled={!selected}
              leftSection={<IconX size="1rem" />}
              onClick={() => toggleDeleteModal()}
            >
              Delete
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
                {capitalize(type)}
              </Chip>
            ))}
          </Group>

          <DirectoryTable
            files={files}
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
              title={"Delete file"}
              description={`Are you sure you want to delete "${selected.name}"?`}
              opened={deleteModal}
              onClose={toggleDeleteModal}
              onConfirm={async () => {
                await removeFile(selected.path);
                await removeFile(selected.path.replace(".pgn", ".info"));
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
