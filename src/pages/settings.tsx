import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import { EngineTable } from "../components/EngineTable";

export default function Page() {
  const [engines, setEngines] = useState<string[]>([]);
  useEffect(() => {
    invoke("list_folders", {
      directory: "engines",
    }).then((res) => {
      const engineStrings = res as string;
      setEngines(engineStrings.split(","));
    });
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
    </div>
  );
}
