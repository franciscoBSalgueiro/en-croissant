import { Grid } from "@mantine/core";
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
    <Grid grow>
      {engines
        .filter((engine) => engine.status === EngineStatus.Installed)
        .map((engine) => (
          <Grid.Col span={4} key={engine.name}>
            <ImageCheckbox
              title={engine.name}
              image={engine.image}
              checked={selectedEngines.some(
                (selectedEngine) => selectedEngine.name === engine.name
              )}
              onChange={(checked) => {
                if (checked) {
                  setSelectedEngines((engines: Engine[]) => [
                    ...engines,
                    engine,
                  ]);
                } else {
                  setSelectedEngines((engines) =>
                    engines.filter((e) => e.name !== engine.name)
                  );
                }
              }}
            />
          </Grid.Col>
        ))}
    </Grid>
  );
}

export default EngineSettingsBoard;
