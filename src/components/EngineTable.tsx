import { Button, Group, Image, ScrollArea, Table, Text } from "@mantine/core";
import { useOs } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import { ProgressButton } from "./ProgressButton";

export enum EngineStatus {
  Installed,
  Downloading,
  NotInstalled,
}

interface Engine {
  image: string;
  name: string;
  status: EngineStatus;
  id: number;
  downloadLink: string;
  rootPath: string;
  path: string;
  progress?: number;
}

export default function EngineTable() {
  const os = useOs();

  const [directories, setDirectories] = useState<string[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);

  async function downloadEngine(id:number, url: string) {
    invoke("download_file", {
      id,
      url,
      path: "engines",
    });
    // FIXME: track real progress of download
    // for (let i = 0; i < 100; i++) {
    //   await new Promise((resolve) => setTimeout(resolve, 50));
    //   setEngines((engines) =>
    //     engines.map((engine) => {
    //       if (engine.downloadLink === url) {
    //         return { ...engine, progress: i };
    //       }
    //       return engine;
    //     })
    //   );
    // }
  }

  function refreshEngines() {
    invoke("list_folders", {
      directory: "engines",
    }).then((res) => {
      const engineStrings = res as string;
      setDirectories(engineStrings.split(","));
    });
  }

  async function removeEngine(id: number) {
    await invoke("remove_folder", {
      directory: "engines/" + engines[id].rootPath,
    });
    refreshEngines();
  }

  function installEngine(id: number) {
    downloadEngine(id, engines[id].downloadLink).then(() => {
      refreshEngines();
    });
  }

  async function getEngineProgress() {
    await listen("download_progress", (event) => {
      const { progress, id } = event.payload as any;
      if (progress === 100) {
        refreshEngines();
      }
      setEngines((engines) =>
        engines.map((engine) => {
          if (engine.id === id) {
            return { ...engine, progress };
          }
          return engine;
        })
      );
    });
  }

  useEffect(() => {
    getEngineProgress();
    refreshEngines();
  }, []);

  useEffect(() => {
    const defaultEngines: Engine[] = [
      {
        image: "/stockfish.png",
        name: "Stockfish 15",
        status: EngineStatus.NotInstalled,
        id: 0,
        downloadLink:
          os === "windows"
            ? "https://stockfishchess.org/files/stockfish_15_win_x64_avx2.zip"
            : "https://stockfishchess.org/files/stockfish_15_linux_x64_bmi2.zip",
        rootPath:
          os === "windows"
            ? "stockfish_15_win_x64_avx2"
            : "stockfish_15_linux_x64_bmi2",
        path:
          os === "windows"
            ? "stockfish_15_win_x64_avx2/stockfish_15_win_x64_avx2.exe"
            : "stockfish_15_linux_x64_bmi2/stockfish_15_linux_x64_bmi2",
      },
      {
        image: "/komodo.png",
        name: "Komodo 13",
        status: EngineStatus.NotInstalled,
        id: 1,
        downloadLink: "https://komodochess.com/pub/komodo-13.zip",
        rootPath: "komodo-13_201fd6",
        path:
          os === "windows"
            ? "komodo-13_201fd6/Windows/komodo-13.02-64bit-bmi2.exe"
            : "komodo-13_201fd6/Linux/komodo-13.02-bmi2",
      },
    ];
    directories.forEach((engine) => {
      const engineIndex = defaultEngines.findIndex(
        (e) => e.rootPath === engine
      );
      if (engineIndex !== -1) {
        defaultEngines[engineIndex].status = EngineStatus.Installed;
      }
    });
    setEngines(defaultEngines);
  }, [directories]);

  function handleInstallClick(loaded: boolean, id: number) {
    if (loaded) {
      console.log("uninstall");
      removeEngine(id);
    } else {
      installEngine(id);
    }
  }

  const rows = engines.map((item) => {
    return (
      <tr key={item.id}>
        <td>
          <Group spacing="sm">
            <Image width={60} height={60} src={item.image} />
            <Text size="md" weight={500}>
              {item.name}
            </Text>
          </Group>
        </td>
        <td>{item.status}</td>
        <td>
          <ProgressButton
            loaded={item.status === EngineStatus.Installed}
            onClick={handleInstallClick}
            progress={item.progress ?? 0}
            id={item.id}
          />
        </td>
      </tr>
    );
  });

  return (
    <ScrollArea>
      <Table sx={{ minWidth: 800 }} verticalSpacing="sm">
        <thead>
          <tr>
            <th>Engine</th>
            <th>ELO</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows}
          <tr>
            <Button variant="default" rightIcon={<IconPlus size={14} />}>
              Add new
            </Button>
          </tr>
        </tbody>
      </Table>
    </ScrollArea>
  );
}
