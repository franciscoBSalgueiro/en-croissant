import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import { EngineTable } from "../components/EngineTable";
import LoadingButton from "../components/LoadingButton";

export default function Page() {
  const [engines, setEngines] = useState<string[]>([]);

  async function downloadEngine(url: string) {
    await invoke("download_file", {
      url,
      path: "engines",
    });
    refreshEngines();
  }

  function refreshEngines() {
    invoke("list_folders", {
      directory: "engines",
    }).then((res) => {
      const engineStrings = res as string;
      setEngines(engineStrings.split(","));
    });
  }

  useEffect(() => {
    refreshEngines();
  }, []);

  const data = engines.map((engine, index) => {
    return {
      image: "https://avatars.githubusercontent.com/u/18677354?v=4",
      name: engine,
      email: "email",
      job: "job",
      id: index.toString(),
    };
  });

  // const data = [
  //   {
  //     avatar: "https://avatars.githubusercontent.com/u/1443320?v=4",
  //     name: "Artur Klauser",
  //     email: "test@gmail.com",
  //     job: "Software Engineer",
  //     id: "1",
  //   },
  // ];

  return (
    <div>
      <EngineTable data={data} />
      <LoadingButton
        onClick={() =>
          downloadEngine(
            "https://stockfishchess.org/files/stockfish_15_win_x64_avx2.zip"
          )
        }
      >
        Download Stockfish
      </LoadingButton>
      <LoadingButton
        onClick={() =>
          downloadEngine("http://komodochess.com/pub/komodo-13.zip")
        }
      >
        Download Komodo 13
      </LoadingButton>
    </div>
  );
}
