import { exists, readDir, removeFile, writeTextFile } from "@tauri-apps/api/fs";
import { documentDir, resolve } from "@tauri-apps/api/path";
import React, { useEffect, useState } from "react";
import GenericCard from "../common/GenericCard";
import {
  Button,
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
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { createTab } from "@/utils/tabs";
import { count_pgn_games, read_games } from "@/utils/db";
import { tabsAtom, activeTabAtom } from "@/atoms/atoms";
import { useAtom, useSetAtom } from "jotai";
import router from "next/router";
import OpenFolderButton from "../common/OpenFolderButton";
import ConfirmModal from "../common/ConfirmModal";
import { useToggle } from "@mantine/hooks";

type FileInfo = {
  name?: string;
  path: string;
  numGames: number;
};

function FilesPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

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
          files.map(async (file) => ({
            name: file.name?.replace(".pgn", ""),
            path: file.path,
            numGames: await count_pgn_games(file.path),
          }))
        );
        setFiles(filesInfo);
      });
    }
    loadFiles();
  }, []);

  return (
    <div>
      <CreateModal
        opened={createModal}
        setOpened={toggleCreateModal}
        setFiles={setFiles}
      />
      <Group align="baseline" ml="lg" my="xl">
        <Title>Files</Title>
        <OpenFolderButton base="Document" folder="EnCroissant" />
      </Group>

      <Group grow>
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
              leftIcon={<IconPlus />}
              onClick={() => toggleCreateModal()}
            >
              Create
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

        {selected && (
          <>
            <ConfirmModal
              title={"Delete file"}
              description={`Are you sure you want to delete "${selected.name}"?`}
              opened={deleteModal}
              onClose={toggleDeleteModal}
              onConfirm={async () => {
                await removeFile(selected.path);
                setFiles(files.filter((file) => file.name !== selected.name));
                toggleDeleteModal();
                setSelected(null);
              }}
            />
            <Stack>
              <Text align="center" fz="xl" fw="bold">
                {selected?.name}
              </Text>
              <Text align="center" color="dimmed">
                {selected?.numGames} Games
              </Text>
              <Group>
                <Button
                  loading={loading}
                  onClick={async () => {
                    setLoading(true);
                    const pgn = (await read_games(selected.path, 0, 0))[0];
                    setLoading(false);

                    const fileInfo = {
                      path: selected.path,
                      numGames: selected.numGames,
                    };
                    createTab({
                      tab: {
                        name: selected.name || "Untitled",
                        type: "analysis",
                      },
                      setTabs,
                      setActiveTab,
                      pgn,
                      fileInfo,
                    });
                    router.push("/boards");
                  }}
                >
                  Open
                </Button>
                <Button color="red" onClick={() => toggleDeleteModal()}>
                  Delete
                </Button>
              </Group>
            </Stack>
          </>
        )}
      </Group>
    </div>
  );
}

type GamefileType = "repertoire" | "game" | "tournament" | "puzzle" | "other";

function CreateModal({
  opened,
  setOpened,
  setFiles,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setFiles: React.Dispatch<React.SetStateAction<FileInfo[]>>;
}) {
  const [filename, setFilename] = useState("");
  const [filetype, setFiletype] = useState<GamefileType>("game");
  const [error, setError] = useState("");

  async function addFile() {
    const dir = await resolve(await documentDir(), "EnCroissant");
    const file = await resolve(dir, filename + ".pgn");
    if (await exists(file)) {
      setError("File already exists");
      return;
    }
    await writeTextFile(file, "");
    setFiles((files) => [
      ...files,
      {
        name: filename,
        path: file,
        numGames: 0,
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
            onChange={(v) => setFiletype(v as GamefileType)}
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
