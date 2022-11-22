import { SimpleGrid } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  Engine,
  EngineStatus,
  getDefaultEngines,
  getEngines
} from "../utils/engines";
import ImageCheckbox from "./ImageCheckbox";

function EngineSettingsBoard() {
  const [engines, setEngines] = useState<Engine[]>(getDefaultEngines());

  console.log(engines);
  useEffect(() => {
    getEngines().then((engines) => {
      setEngines(engines);
    });
  }, []);
  return (
    <SimpleGrid
      cols={4}
      breakpoints={[
        { maxWidth: "md", cols: 2 },
        { maxWidth: "sm", cols: 1 },
      ]}
    >
      {engines
        .filter((engine) => engine.status === EngineStatus.Installed)
        .map((engine) => (
          <ImageCheckbox
            key={engine.name}
            title={engine.name}
            image={engine.image}
          />
        ))}
    </SimpleGrid>
  );
}

export default EngineSettingsBoard;
