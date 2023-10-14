import { Button, Center, Collapse, Grid, Stack, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { memo, useEffect, useState } from "react";
import { Engine } from "@/utils/engines";
import ImageCheckbox from "./ImageCheckbox";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useAtom, useAtomValue } from "jotai";
import { enginesAtom } from "@/atoms/atoms";

function EngineBox({ engine }: { engine: Engine }) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);
  const [, setEngines] = useAtom(enginesAtom);

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
          setEngines(async (engines) =>
            (await engines).map((e) =>
              e.name === engine.name ? { ...e, loaded: checked } : e
            )
          )
        }
      />
    </Grid.Col>
  );
}

function EngineSelection() {
  const [showSettings, toggleShowSettings] = useToggle();
  const engines = useAtomValue(enginesAtom);

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
              <EngineBox key={engine.name} engine={engine} />
            ))}
          </Grid>
        </Stack>
      </Collapse>
    </>
  );
}

export default memo(EngineSelection);
