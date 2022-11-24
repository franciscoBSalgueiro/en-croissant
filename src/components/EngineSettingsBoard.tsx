import { SimpleGrid } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  Engine,
  EngineStatus,
  getDefaultEngines,
  getEngines
} from "../utils/engines";
import ImageCheckbox from "./ImageCheckbox";

function EngineSettingsBoard({
  selectedEngines,
  setSelectedEngines,
}: {
  selectedEngines: Engine[];
  setSelectedEngines: React.Dispatch<React.SetStateAction<Engine[]>>;
}) {
  const [engines, setEngines] = useState<Engine[]>(getDefaultEngines());

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
            checked={selectedEngines.some(
              (selectedEngine) => selectedEngine.name === engine.name
            )}
            onChange={(checked) => {
              if (checked) {
                setSelectedEngines((engines: Engine[]) => [...engines, engine]);
              } else {
                setSelectedEngines((engines) =>
                  engines.filter((e) => e.name !== engine.name)
                );
              }
            }}
          />
        ))}
    </SimpleGrid>
  );
}

export default EngineSettingsBoard;
