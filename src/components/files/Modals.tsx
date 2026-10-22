import { Button, Modal, SimpleGrid, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useLoaderData } from "@tanstack/react-router";
import { resolve, dirname } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createFile } from "@/utils/files";
import { getGameFromUrl } from "@/utils/import";
import GameSourceInput, { type ImportType } from "../common/GameSourceInput";
import GenericCard from "../common/GenericCard";
import { newRepertoirePgn, RepertoireColorInput } from "../tabs/CreateRepertoireModal";
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
  selected,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  files: (FileMetadata | Directory)[];
  setFiles: (files: (FileMetadata | Directory)[]) => void;
  setSelected: React.Dispatch<React.SetStateAction<FileMetadata | Directory | null>>;
  selected: FileMetadata | Directory | null;
}) {
  const { t } = useTranslation();

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title={t("Files.Create.Title")}>
      <CreateFileForm
        setOpened={setOpened}
        files={files}
        setFiles={setFiles}
        setSelected={setSelected}
        selected={selected}
      />
    </Modal>
  );
}

// The Modal removes its content when it closes, so the dialog starts empty each time it opens
function CreateFileForm({
  setOpened,
  files,
  setFiles,
  setSelected,
  selected,
}: {
  setOpened: (opened: boolean) => void;
  files: (FileMetadata | Directory)[];
  setFiles: (files: (FileMetadata | Directory)[]) => void;
  setSelected: React.Dispatch<React.SetStateAction<FileMetadata | Directory | null>>;
  selected: FileMetadata | Directory | null;
}) {
  const { t } = useTranslation();

  const [filename, setFilename] = useState("");
  const [filetype, setFiletype] = useState<FileType>("game");
  const [pgn, setPgn] = useState("");
  const [error, setError] = useState("");
  const [color, setColor] = useState<"white" | "black">("white");
  const [importType, setImportType] = useState<ImportType>("PGN");
  const [file, setFile] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [loading, setLoading] = useState(false);
  const { documentDir } = useLoaderData({ from: "/files" });

  // What the new file holds: for a game, the one from the chosen source ("" for a blank game);
  // for a repertoire, what the home screen's New Repertoire starts it with. Null, after saying
  // why, when the game can't be read
  async function getFilePgn(name: string): Promise<string | null> {
    if (filetype === "repertoire") {
      return newRepertoirePgn(name, color);
    }
    if (filetype !== "game") {
      return pgn;
    }
    if (importType === "PGN") {
      return file ? await readTextFile(file) : pgn;
    }
    if (!link) return "";
    try {
      return await getGameFromUrl(link);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  async function addFile() {
    const trimmedFilename = filename.trim();
    if (!trimmedFilename) {
      setError(t("Common.RequireName"));
      return;
    }

    let targetDir = documentDir;
    if (selected) {
      if (selected.type === "directory") {
        targetDir = selected.path;
      } else {
        targetDir = await dirname(selected.path);
      }
    }

    setLinkError("");
    setLoading(true);
    const filePgn = await getFilePgn(trimmedFilename).finally(() => setLoading(false));
    if (filePgn === null) {
      return;
    }

    const newFile = await createFile({
      filename: trimmedFilename,
      filetype,
      pgn: filePgn,
      dir: targetDir,
    });
    if (newFile.isErr) {
      setError(newFile.error.message);
    } else {
      setFiles([...files, newFile.value]);
      setSelected(newFile.value);
      setOpened(false);
    }
  }

  return (
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
          value={filename}
          onChange={(e) => {
            setFilename(e.currentTarget.value);
            if (error) setError("");
          }}
          error={error}
          data-autofocus
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
              Header={<Text ta="center">{t(`Files.FileType.${v.label}`)}</Text>}
            />
          ))}
        </SimpleGrid>

        {filetype === "repertoire" ? (
          <RepertoireColorInput color={color} setColor={setColor} />
        ) : filetype === "game" ? (
          <>
            <Text fz="sm" fw="bold">
              {t("Files.Create.ImportType")}
            </Text>

            <GameSourceInput
              importType={importType}
              setImportType={setImportType}
              pgn={pgn}
              setPgn={setPgn}
              file={file}
              setFile={(file, name) => {
                setFile(file);
                if (file && !filename.trim()) {
                  setFilename(name);
                  setError("");
                }
              }}
              link={link}
              setLink={setLink}
              linkError={linkError}
              pgnPlaceholder={t("Files.Create.PGNPlaceholder")}
            />
          </>
        ) : (
          <Textarea
            value={pgn}
            onChange={(event) => setPgn(event.currentTarget.value)}
            label={t("Common.PGNGame")}
            placeholder={t("Files.Create.PGNPlaceholder")}
            rows={10}
          />
        )}

        <Button style={{ marginTop: "1rem" }} type="submit" loading={loading}>
          {t("Common.Create")}
        </Button>
      </Stack>
    </form>
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
  setSelected: React.Dispatch<React.SetStateAction<FileMetadata | Directory | null>>;
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

    const newPGNPath = metadata.path.replace(`${metadata.name}.pgn`, `${filename}.pgn`);

    await rename(metadata.path, newPGNPath);
    await rename(metadataPath.replace(".pgn", ".info"), newPGNPath.replace(".pgn", ".info"));

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
    <Modal opened={opened} onClose={() => setOpened(false)} title={t("Files.Edit.Title")}>
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
                Header={<Text ta="center">{t(`Files.FileType.${v.label}`)}</Text>}
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

export function CreateDirectoryModal({
  opened,
  setOpened,
  mutate,
  selected,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  mutate: () => void;
  selected: FileMetadata | Directory | null;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { documentDir } = useLoaderData({ from: "/files" });

  async function createDirectory() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Common.RequireName"));
      return;
    }
    try {
      let targetDir = documentDir;
      if (selected) {
        if (selected.type === "directory") {
          targetDir = selected.path;
        } else {
          targetDir = await dirname(selected.path);
        }
      }
      const newPath = await resolve(targetDir, trimmed);
      if (await exists(newPath)) {
        setError(t("Files.CreateDirectory.AlreadyExists"));
        return;
      }
      await mkdir(newPath);
      mutate();
      setName("");
      setError("");
      setOpened(false);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Files.CreateDirectory.Title")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createDirectory();
        }}
      >
        <Stack>
          <TextInput
            label={t("Common.Name")}
            placeholder={t("Files.CreateDirectory.Placeholder")}
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
              if (error) setError("");
            }}
            error={error}
            data-autofocus
          />
          <Button style={{ marginTop: "1rem" }} type="submit">
            {t("Common.Create")}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
