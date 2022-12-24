import { Button, Collapse, Grid, Stack } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons";
import { useRouter } from "next/router";
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
  numberLines,
  setNumberLines,
  maxDepth,
  setMaxDepth,
}: {
  selectedEngines: Engine[];
  setSelectedEngines: React.Dispatch<React.SetStateAction<Engine[]>>;
  numberLines: number;
  setNumberLines: React.Dispatch<React.SetStateAction<number>>;
  maxDepth: number;
  setMaxDepth: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [engines, setEngines] = useState<Engine[]>(getDefaultEngines());
  const [showSettings, toggleShowSettings] = useToggle();
  const router = useRouter();

  useEffect(() => {
    getEngines().then((engines) => {
      setEngines(engines);
    });
  }, []);
  const installedEngines = engines.filter(
    (engine) => engine.status === EngineStatus.Installed
  );
  useEffect(() => {
    // check if there's any selected engines that are not installed
    const selectedEnginesNotInstalled = selectedEngines.filter(
      (selectedEngine) =>
        !installedEngines.some(
          (installedEngine) => installedEngine.name === selectedEngine.name
        )
    );
    if (selectedEnginesNotInstalled.length > 0) {
      setSelectedEngines((engines) =>
        engines.filter(
          (engine) =>
            !selectedEnginesNotInstalled.some(
              (selectedEngine) => selectedEngine.name === engine.name
            )
        )
      );
    }
  }, [engines, selectedEngines, setSelectedEngines]);
  return (
    <>
      <Button
        variant="default"
        onClick={() => {
          toggleShowSettings();
          if (installedEngines.length === 0) {
            router.push("/engines");
          }
        }}
        leftIcon={<IconSettings size={14} />}
      >
        Manage Engines
      </Button>
      <Collapse in={showSettings}>
        <Stack spacing="xl">
          <Grid grow>
            {installedEngines.map((engine) => (
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
        </Stack>
      </Collapse>
    </>
  );
}

export default EngineSettingsBoard;
