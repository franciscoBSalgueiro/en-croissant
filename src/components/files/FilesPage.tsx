import { readDir, removeFile } from "@tauri-apps/api/fs";
import { documentDir, resolve } from "@tauri-apps/api/path";
import React, { useEffect, useMemo, useState } from "react";
import GenericCard from "../common/GenericCard";
import {
  Button,
  Center,
  Chip,
  Group,
  Input,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import OpenFolderButton from "../common/OpenFolderButton";
import ConfirmModal from "../common/ConfirmModal";
import { useToggle } from "@mantine/hooks";
import { readFileMetadata, FileMetadata, FileType } from "./file";
import FileCard from "./FileCard";
import Fuse from "fuse.js";
import { CreateModal, EditModal } from "./Modals";
import { capitalize } from "@/utils/format";

const FILE_TYPES: FileType[] = [
  "game",
  "repertoire",
  "tournament",
  "puzzle",
  "other",
];

function FilesPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FileMetadata | null>(null);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const [filter, setFilter] = useState<FileType | null>(null);

  const fuse = useMemo(
    () =>
      new Fuse(files, {
        keys: ["name"],
      }),
    [files]
  );

  let filteredFiles = files;
  if (search) {
    filteredFiles = fuse.search(search).map((r) => r.item);
  }
  if (filter) {
    filteredFiles = filteredFiles.filter((f) => f.metadata.type === filter);
  }

  const [deleteModal, toggleDeleteModal] = useToggle();
  const [createModal, toggleCreateModal] = useToggle();
  const [editModal, toggleEditModal] = useToggle();

  useEffect(() => {
    async function loadFiles() {
      const dir = await resolve(await documentDir(), "EnCroissant");
      readDir(dir).then(async (files) => {
        const filesInfo = await Promise.all(
          files
            .filter((f) => f.name?.endsWith(".pgn"))
            .map((f) => readFileMetadata(f.name || "", f.path))
        );
        setFiles(filesInfo);
      });
    }
    loadFiles();
  }, []);

  useEffect(() => {
    setGames(new Map());
  }, [selected]);

  return (
    <>
      <CreateModal
        opened={createModal}
        setOpened={toggleCreateModal}
        setFiles={setFiles}
      />
      {selected && (
        <EditModal
          key={selected.name}
          opened={editModal}
          setOpened={toggleEditModal}
          setFiles={setFiles}
          setSelected={setSelected}
          metadata={selected}
        />
      )}
      <Group align="baseline" ml="lg" my="xl">
        <Title>Files</Title>
        <OpenFolderButton base="Document" folder="EnCroissant" />
      </Group>

      <Group grow align="baseline">
        <Stack>
          <Group>
            <Input
              sx={{ flexGrow: 1 }}
              icon={<IconSearch size={16} />}
              placeholder="Search for files"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Button
              size="xs"
              leftIcon={<IconPlus size={16} />}
              onClick={() => toggleCreateModal()}
            >
              Create
            </Button>
            <Button
              size="xs"
              color="red"
              disabled={!selected}
              leftIcon={<IconX size={16} />}
              onClick={() => toggleDeleteModal()}
            >
              Delete
            </Button>
          </Group>
          <Group>
            {FILE_TYPES.map((type) => (
              <Chip
                key={type}
                onChange={(v) =>
                  setFilter((filter) =>
                    v ? type : filter === type ? null : filter
                  )
                }
                checked={filter === type}
              >
                {capitalize(type)}
              </Chip>
            ))}
          </Group>

          <ScrollArea h={500} offsetScrollbars>
            <Stack>
              {filteredFiles.map((file) => (
                <GenericCard
                  key={file.name}
                  id={file}
                  isSelected={selected?.name === file.name}
                  setSelected={setSelected}
                  Header={
                    <Group noWrap>
                      <Text weight={500}>{file.name}</Text>
                    </Group>
                  }
                />
              ))}
            </Stack>
          </ScrollArea>
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
                setFiles(files.filter((file) => file.name !== selected.name));
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
    </>
  );
}
export default FilesPage;
