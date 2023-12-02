import { Button, Center, Collapse, Grid, Stack, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { memo, useEffect, useState } from "react";
import { Engine, localEngine } from "@/utils/engines";
import ImageCheckbox from "./ImageCheckbox";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useAtom, useAtomValue } from "jotai";
import { activeTabAtom, enginesAtom, remoteEnabledAtom } from "@/atoms/atoms";
import { lichessCloudEval } from "@/utils/lichess";
import { chessdb } from "@/utils/chessdb";

function EngineBox({
  engine,
  toggleEnabled,
}: {
  engine: Engine;
  toggleEnabled: () => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);
  const activeTab = useAtomValue(activeTabAtom);

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
        onChange={(checked) => {
          if (!checked) {
            engine.stop(activeTab!);
          }
          toggleEnabled();
        }}
      />
    </Grid.Col>
  );
}

function EngineSelection() {
  const [showSettings, toggleShowSettings] = useToggle();
  const [engines, setEngines] = useAtom(enginesAtom);
  const [remoteEnabled, setRemoteEnabled] = useAtom(remoteEnabledAtom);

  return (
    <>
      <Button
        variant="default"
        onClick={() => {
          toggleShowSettings();
        }}
        leftIcon={<IconSettings size="0.875rem" />}
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
          <Grid grow w="100%">
            {engines.map((engine) => (
              <EngineBox
                key={engine.name}
                engine={localEngine(engine)}
                toggleEnabled={() => {
                  setEngines(async (prev) =>
                    (await prev).map((e) =>
                      e.name === engine.name ? { ...e, loaded: !e.loaded } : e
                    )
                  );
                }}
              />
            ))}

            <EngineBox
              key="lichess"
              engine={{ ...lichessCloudEval, loaded: remoteEnabled.lichess }}
              toggleEnabled={() =>
                setRemoteEnabled((prev) => ({
                  ...prev,
                  lichess: !prev.lichess,
                }))
              }
            />
            <EngineBox
              key="chessdb"
              engine={{ ...chessdb, loaded: remoteEnabled.chessdb }}
              toggleEnabled={() =>
                setRemoteEnabled((prev) => ({
                  ...prev,
                  chessdb: !prev.chessdb,
                }))
              }
            />
          </Grid>
        </Stack>
      </Collapse>
    </>
  );
}

export default memo(EngineSelection);
