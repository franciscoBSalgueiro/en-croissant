import { Button, Center, Collapse, Grid, Stack, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import Link from "next/link";
import { memo } from "react";
import { Engine } from "@/utils/engines";
import ImageCheckbox from "./ImageCheckbox";

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
                <Link href="/engines">Add an engine</Link> first.
              </Text>
            </Center>
          )}
          <Grid grow>
            {engines.map((engine) => (
              <Grid.Col span={4} key={engine.name}>
                <ImageCheckbox
                  title={engine.name}
                  image={engine.image}
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
            ))}
          </Grid>
        </Stack>
      </Collapse>
    </>
  );
}

export default memo(EngineSelection);
