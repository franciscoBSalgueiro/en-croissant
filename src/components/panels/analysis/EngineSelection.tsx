import { Button, Center, Collapse, Grid, Stack, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { memo, useEffect, useState } from "react";
import { Engine } from "@/utils/engines";
import ImageCheckbox from "./ImageCheckbox";
import { convertFileSrc } from "@tauri-apps/api/tauri";

function EngineBox({
  engine,
  setEngines,
}: {
  engine: Engine;
  setEngines: React.Dispatch<React.SetStateAction<Engine[]>>;
}) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      if (engine.image && engine.image.startsWith("http")) {
        setImageSrc(engine.image);
      } else if (engine.image) {
        setImageSrc(await convertFileSrc(engine.image));
      }
    })();
  }, [engine.image]);

  return (
    <Grid.Col span={4}>
      <ImageCheckbox
        title={engine.name}
        image={imageSrc}
        checked={engine.loaded}
        onChange={(checked) =>
          setEngines((engines) =>
            engines.map((e) =>
              e.name === engine.name ? { ...e, loaded: checked } : e
            )
          )
        }
      />
    </Grid.Col>
  );
}

function EngineSelection({
  engines,
  setEngines,
}: {
  engines: Engine[];
  setEngines: React.Dispatch<React.SetStateAction<Engine[]>>;
}) {
  const [showSettings, toggleShowSettings] = useToggle();

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
          {engines.length === 0 && (
            <Center>
              <Text>
                No engines installed. Please{" "}
                <Link to="/engines">Add an engine</Link> first.
              </Text>
            </Center>
          )}
          <Grid grow>
            {engines.map((engine) => (
              <EngineBox
                key={engine.name}
                setEngines={setEngines}
                engine={engine}
              />
            ))}
          </Grid>
        </Stack>
      </Collapse>
    </>
  );
}

export default memo(EngineSelection);
