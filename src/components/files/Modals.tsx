import { createFile } from "@/utils/files";
import {
  Button,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useLoaderData } from "@tanstack/react-router";
import { rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import GenericCard from "../common/GenericCard";
import type { Directory, FileMetadata, FileType } from "./file";

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
  files,
  setFiles,
  setSelected,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  files: (FileMetadata | Directory)[];
  setFiles: (files: (FileMetadata | Directory)[]) => void;
  setSelected: React.Dispatch<React.SetStateAction<FileMetadata | null>>;
}) {
  const { t } = useTranslation();

  const [filename, setFilename] = useState("");
  const [filetype, setFiletype] = useState<FileType>("game");
  const [pgn, setPgn] = useState("");
  const [error, setError] = useState("");
  const { documentDir } = useLoaderData({ from: "/files" });

  async function addFile() {
    const newFile = await createFile({
      filename,
      filetype,
      pgn,
      dir: documentDir,
    });
    if (newFile.isErr) {
      setError(newFile.error.message);
    } else {
      setFiles([...files, newFile.value]);
      setSelected(newFile.value);
      setError("");
      setOpened(false);
      setFilename("");
      setFiletype("game");
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Files.Create.Title")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addFile();
        }}
      >
        <Stack>
          <TextInput
            label={t("Common.Name")}
            placeholder={t("Common.EnterFileName")}
            required
            value={filename}
            onChange={(e) => setFilename(e.currentTarget.value)}
            error={error}
          />

          <Text fz="sm" fw="bold">
            {t("Files.FileType")}
          </Text>

          <SimpleGrid cols={3}>
            {FILE_TYPES.map((v) => (
              <GenericCard
                key={v.value}
                id={v.value}
                isSelected={filetype === v.value}
                setSelected={setFiletype}
                Header={
                  <Text ta="center">{t(`Files.FileType.${v.label}`)}</Text>
                }
              />
            ))}
          </SimpleGrid>

          <Textarea
            value={pgn}
            onChange={(event) => setPgn(event.currentTarget.value)}
            label={t("Common.PGNGame")}
            placeholder="Leave empty to start from scratch"
            rows={10}
          />

          <Button style={{ marginTop: "1rem" }} type="submit">
            {t("Common.Create")}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

export function EditModal({
  opened,
  setOpened,
  mutate,
  setSelected,
  metadata,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  mutate: () => void;
  setSelected: React.Dispatch<React.SetStateAction<FileMetadata | null>>;
  metadata: FileMetadata;
}) {
  const { t } = useTranslation();

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

    const newPGNPath = metadata.path.replace(
      `${metadata.name}.pgn`,
      `${filename}.pgn`,
    );

    await rename(metadata.path, newPGNPath);
    await rename(
      metadataPath.replace(".pgn", ".info"),
      newPGNPath.replace(".pgn", ".info"),
    );

    mutate();
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
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Files.Edit.Title")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          editFile();
        }}
      >
        <Stack>
          <TextInput
            label={t("Common.Name")}
            placeholder={t("Common.EnterFileName")}
            required
            value={filename}
            onChange={(e) => setFilename(e.currentTarget.value)}
            error={error}
          />

          <Text fz="sm" fw="bold">
            {t("Files.FileType")}
          </Text>

          <SimpleGrid cols={3}>
            {FILE_TYPES.map((v) => (
              <GenericCard
                key={v.value}
                id={v.value}
                isSelected={filetype === v.value}
                setSelected={setFiletype}
                Header={
                  <Text ta="center">{t(`Files.FileType.${v.label}`)}</Text>
                }
              />
            ))}
          </SimpleGrid>

          <Button style={{ marginTop: "1rem" }} type="submit">
            {t("Common.Edit")}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
