import { Button, Center, Collapse, Grid, Stack, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Engine, EngineStatus, getEngines } from "../../../utils/engines";
import ImageCheckbox from "./ImageCheckbox";

function EngineSettingsBoard({
  selectedEngines,
  setSelectedEngines,
}: {
  selectedEngines: Engine[];
  setSelectedEngines: React.Dispatch<React.SetStateAction<Engine[]>>;
}) {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [installedEngines, setInstalledEngines] = useState<Engine[]>([]);
  const [showSettings, toggleShowSettings] = useToggle();
  const router = useRouter();

  useEffect(() => {
    getEngines().then((engines) => {
      setEngines(engines);
      const foundEngines = engines.filter(
        (engine) => engine.status === EngineStatus.Installed
      );

      // if (foundEngines.length === 0) {
      //   router.push("/engines");
      // }

      const selectedEnginesNotInstalled = selectedEngines.filter(
        (selectedEngine) =>
          !foundEngines.some(
            (installedEngine) => installedEngine.name === selectedEngine.name
          )
      );

      if (selectedEnginesNotInstalled.length > 0) {
        setSelectedEngines((prev) =>
          prev.filter(
            (selectedEngine) =>
              !selectedEnginesNotInstalled.some(
                (selectedEngineNotInstalled) =>
                  selectedEngineNotInstalled.name === selectedEngine.name
              )
          )
        );
      }
      setInstalledEngines(foundEngines);
    });
  }, []);

  return (
    <>
      <Button
        variant="default"
        onClick={() => {
          toggleShowSettings();
        }}
        leftIcon={<IconSettings size={14} />}
      >
        Manage Engines
      </Button>
      <Collapse in={showSettings}>
        <Stack spacing="xl">
          {installedEngines.length === 0 && (
            <Center>
              <Text>
                No engines installed. Please{" "}
                <Link href="/engines">Add an engine</Link> first.
              </Text>
            </Center>
          )}
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
