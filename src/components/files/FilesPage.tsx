import { exists, readDir, removeFile, writeTextFile } from "@tauri-apps/api/fs";
import { documentDir, resolve } from "@tauri-apps/api/path";
import React, { useEffect, useState } from "react";
import GenericCard from "../common/GenericCard";
import {
  Button,
  Center,
  Group,
  Input,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import OpenFolderButton from "../common/OpenFolderButton";
import ConfirmModal from "../common/ConfirmModal";
import { useToggle } from "@mantine/hooks";
import { readFileMetadata, FileMetadata, FileType } from "./file";
import FileCard from "./FileCard";

function FilesPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FileMetadata | null>(null);

  let filteredFiles = files;
  if (search) {
    filteredFiles = files.filter((file) => file.name?.includes(search));
  }
  const [deleteModal, toggleDeleteModal] = useToggle();
  const [createModal, toggleCreateModal] = useToggle();

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

  return (
    <>
      <CreateModal
        opened={createModal}
        setOpened={toggleCreateModal}
        setFiles={setFiles}
      />
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
            <FileCard selected={selected} />
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

function CreateModal({
  opened,
  setOpened,
  setFiles,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setFiles: React.Dispatch<React.SetStateAction<FileMetadata[]>>;
}) {
  const [filename, setFilename] = useState("");
  const [filetype, setFiletype] = useState<FileType>("game");
  const [error, setError] = useState("");

  async function addFile() {
    const dir = await resolve(await documentDir(), "EnCroissant");
    const file = await resolve(dir, filename + ".pgn");
    if (await exists(file)) {
      setError("File already exists");
      return;
    }
    const metadata = {
      type: filetype,
      tags: [],
    };
    await writeTextFile(file, "");
    await writeTextFile(
      file.replace(".pgn", ".info"),
      JSON.stringify(metadata)
    );
    setFiles((files) => [
      ...files,
      {
        name: filename,
        path: file,
        numGames: 0,
        metadata,
      },
    ]);
    setError("");
    setOpened(false);
    setFilename("");
    setFiletype("game");
  }

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title="Create file">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addFile();
        }}
      >
        <Stack>
          <TextInput
            label="Name"
            placeholder="Enter your filename"
            required
            value={filename}
            onChange={(e) => setFilename(e.currentTarget.value)}
            error={error}
          />

          <Select
            label="Type"
            placeholder="Select the type of file"
            data={[
              { label: "Game", value: "game" },
              { label: "Repertoire", value: "repertoire" },
              { label: "Tournament", value: "tournament" },
              { label: "Puzzle", value: "puzzle" },
              { label: "Other", value: "other" },
            ]}
            value={filetype}
            onChange={(v) => setFiletype(v as FileType)}
            required
            searchable
          />
          <Button sx={{ marginTop: "1rem" }} type="submit">
            Create
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

export default FilesPage;
