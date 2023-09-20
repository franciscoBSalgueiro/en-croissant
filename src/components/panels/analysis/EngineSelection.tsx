import { Button, Center, Collapse, Grid, Stack, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { memo, useEffect, useState } from "react";
import { Engine } from "@/utils/engines";
import ImageCheckbox from "./ImageCheckbox";
import { convertFileSrc } from "@tauri-apps/api/tauri";

function EngineBox(props: {
  engine: Engine;
  setEngines: React.Dispatch<React.SetStateAction<Engine[]>>;
}) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      if (props.engine.image.startsWith("http")) {
        setImageSrc(props.engine.image);
      } else if (props.engine.image) {
        setImageSrc(await convertFileSrc(props.engine.image));
      }
    })();
  }, [props.engine.image]);

  return (
    <Grid.Col span={4}>
      {imageSrc && (
        <ImageCheckbox
          title={props.engine.name}
          image={imageSrc}
          checked={props.engine.loaded}
          onChange={(checked) =>
            props.setEngines((engines) =>
              engines.map((e) =>
                e.name === props.engine.name ? { ...e, loaded: checked } : e
              )
            )
          }
        />
      )}
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
