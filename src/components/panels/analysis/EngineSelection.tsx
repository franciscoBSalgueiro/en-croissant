import {
  Button,
  Center,
  Checkbox,
  Image,
  Group,
  Stack,
  Text,
  Collapse,
  Paper,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconCloud, IconRobot, IconSettings } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { memo, useEffect, useState } from "react";
import { Engine, localEngine } from "@/utils/engines";
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
    <Paper
      withBorder
      p="sm"
      w="16rem"
      h="4rem"
      onClick={() => {
        if (engine.loaded) {
          engine.stop(activeTab!);
        }
        toggleEnabled();
      }}
      style={{ cursor: "pointer" }}
    >
      <Group>
        <Checkbox checked={engine.loaded} />
        {imageSrc ? (
          <Image src={imageSrc} alt={engine.name} h="2.5rem" />
        ) : engine.remote ? (
          <IconCloud size="2rem" />
        ) : (
          <IconRobot size="2rem" />
        )}
        <Text>{engine.name}</Text>
      </Group>
    </Paper>
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
        leftSection={<IconSettings size="0.875rem" />}
      >
        Manage Engines
      </Button>
      <Collapse title="Engine Selection" in={showSettings}>
        {engines.length === 0 && (
          <Center>
            <Text>
              No engines installed. Please{" "}
              <Link to="/engines">Add an engine</Link> first.
            </Text>
          </Center>
        )}
        <Stack>
          <Stack justify="center">
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
              engine={{
                ...lichessCloudEval,
                loaded: remoteEnabled.lichess,
              }}
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
          </Stack>
        </Stack>
      </Collapse>
    </>
  );
}

export default memo(EngineSelection);
