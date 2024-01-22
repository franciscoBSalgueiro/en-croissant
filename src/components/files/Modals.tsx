import {
  Button,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  BaseDirectory,
  exists,
  renameFile,
  writeTextFile,
} from "@tauri-apps/api/fs";
import { documentDir, resolve } from "@tauri-apps/api/path";
import { useState } from "react";
import GenericCard from "../common/GenericCard";
import { FileMetadata, FileType } from "./file";

const FILE_TYPES = [
  { label: "Game", value: "game" },
  { label: "Repertoire", value: "repertoire" },
  { label: "Tournament", value: "tournament" },
  { label: "Puzzle", value: "puzzle" },
  { label: "Other", value: "other" },
] as const;

export function CreateModal({
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
    const file = await resolve(dir, `${filename}.pgn`);
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
      JSON.stringify(metadata),
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

          <Text fz="sm" fw="bold">
            File type
          </Text>

          <SimpleGrid cols={3}>
            {FILE_TYPES.map((v) => (
              <GenericCard
                key={v.value}
                id={v.value}
                isSelected={filetype === v.value}
                setSelected={setFiletype}
                Header={<Text ta="center">{v.label}</Text>}
              />
            ))}
          </SimpleGrid>

          <Button style={{ marginTop: "1rem" }} type="submit">
            Create
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

export function EditModal({
  opened,
  setOpened,
  setFiles,
  setSelected,
  metadata,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setFiles: React.Dispatch<React.SetStateAction<FileMetadata[]>>;
  setSelected: React.Dispatch<React.SetStateAction<FileMetadata | null>>;
  metadata: FileMetadata;
}) {
  const [filename, setFilename] = useState(metadata.name);
  const [filetype, setFiletype] = useState<FileType>(metadata.metadata.type);
  const [error, setError] = useState("");

  async function editFile() {
    const metadataPath = metadata.path.replace(".pgn", ".info");
    const newMetadata = {
      type: filetype,
      tags: [],
    };

    await writeTextFile(metadataPath, JSON.stringify(newMetadata));

    const newPGNPath = await resolve(
      await documentDir(),
      "EnCroissant",
      `${filename}.pgn`,
    );

    try {
      await renameFile(
        `EnCroissant/${metadata.name}.pgn`,
        `EnCroissant/${filename}.pgn`,
        {
          dir: BaseDirectory.Document,
        },
      );
      await renameFile(
        `EnCroissant/${metadata.name}.info`,
        `EnCroissant/${filename}.info`,
        {
          dir: BaseDirectory.Document,
        },
      );
    } catch {
      await renameFile(
        `documents/${metadata.name}.pgn`,
        `documents/${filename}.pgn`,
        {
          dir: BaseDirectory.AppData,
        },
      );
      await renameFile(
        `documents/${metadata.name}.info`,
        `documents/${filename}.info`,
        {
          dir: BaseDirectory.AppData,
        },
      );
    }

    setFiles((files) =>
      [
        ...files.filter(
          (v) => v.path !== metadata.path && v.path !== metadataPath,
        ),
        {
          ...metadata,
          name: filename,
          path: newPGNPath,
          numGames: metadata.numGames,
          metadata: newMetadata,
        },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setSelected((selected) =>
      selected?.path === metadata.path
        ? {
            ...metadata,
            name: filename,
            path: newPGNPath,
            numGames: metadata.numGames,
            metadata: newMetadata,
          }
        : selected,
    );

    setError("");
    setOpened(false);
  }

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title="Edit file">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          editFile();
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

          <Text fz="sm" fw="bold">
            File type
          </Text>

          <SimpleGrid cols={3}>
            {FILE_TYPES.map((v) => (
              <GenericCard
                key={v.value}
                id={v.value}
                isSelected={filetype === v.value}
                setSelected={setFiletype}
                Header={<Text ta="center">{v.label}</Text>}
              />
            ))}
          </SimpleGrid>

          <Button style={{ marginTop: "1rem" }} type="submit">
            Edit
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
