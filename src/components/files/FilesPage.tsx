import { FileEntry, readDir, removeFile } from "@tauri-apps/api/fs";
import { documentDir, resolve } from "@tauri-apps/api/path";
import { useEffect, useState } from "react";
import GenericCard from "../common/GenericCard";
import { Button, Group, Input, Stack, Text, Title } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { createTab } from "@/utils/tabs";
import { count_pgn_games, read_games } from "@/utils/db";
import { tabsAtom, activeTabAtom } from "@/atoms/atoms";
import { useAtom, useSetAtom } from "jotai";
import router from "next/router";
import OpenFolderButton from "../common/OpenFolderButton";

function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  let filteredFiles = files;
  if (search) {
    filteredFiles = files.filter((file) => file.name?.includes(search));
  }

  useEffect(() => {
    async function loadFiles() {
      const dir = await resolve(await documentDir(), "EnCroissant");
      readDir(dir).then((files) => {
        setFiles(files);
      });
    }
    loadFiles();
  }, []);

  return (
    <div>
      <Group align="baseline" ml="lg" my="xl">
        <Title>Files</Title>
        <OpenFolderButton base="Document" folder="EnCroissant" />
      </Group>

      <Group>
        <Stack sx={{ flexGrow: 1 }}>
          <Group>
            <Input
              sx={{ flexGrow: 1 }}
              icon={<IconSearch size={16} />}
              placeholder="Search for files"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          </Group>

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

        {selected && (
          <Stack>
            <Text fz="xl" fw="bold">
              {selected?.name}
            </Text>
            <Group>
              <Button
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  const count = await count_pgn_games(selected.path);
                  const pgn = (await read_games(selected.path, 0, 0))[0];
                  setLoading(false);

                  const fileInfo = {
                    path: selected.path,
                    numGames: count,
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
              <Button
                color="red"
                onClick={async () => {
                  await removeFile(selected.path);
                  setFiles(files.filter((file) => file.name !== selected.name));
                }}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        )}
      </Group>
    </div>
  );
}

export default FilesPage;
