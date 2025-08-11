import LocalImage from "@/components/common/LocalImage";
import { activeTabAtom, enginesAtom, persistEnginesAtom } from "@/state/atoms";
import { type Engine, stopEngine } from "@/utils/engines";
import {
  Center,
  Checkbox,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { IconCloud, IconCpu } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { info } from "@tauri-apps/plugin-log";
import { useAtom, useAtomValue } from "jotai";
import { useSetAtom } from "jotai/react";
import { memo } from "react";

function EngineBox({
  engine,
  toggleEnabled,
}: {
  engine: Engine;
  toggleEnabled: () => void;
}) {
  const activeTab = useAtomValue(activeTabAtom);

  return (
    <Paper
      withBorder
      p="sm"
      w="100%"
      h="3rem"
      onClick={async () => {
        if (engine.loaded && engine.type === "local") {
          stopEngine(engine, activeTab!);
        }
        await info(
          `EngineSelection.toggle: ${engine.name} -> ${!engine.loaded ? "enabled" : "disabled"}`,
        );
        toggleEnabled();
      }}
      style={{ cursor: "pointer" }}
    >
      <Group wrap="nowrap">
        <Checkbox checked={!!engine.loaded} onChange={() => {}} />
        {engine.image ? (
          <LocalImage src={engine.image} alt={engine.name} h="1.5rem" />
        ) : engine.type !== "local" ? (
          <IconCloud size="1.5rem" />
        ) : (
          <IconCpu size="1.5rem" />
        )}
        <Text lineClamp={1} fz="sm">
          {engine.name}
        </Text>
      </Group>
    </Paper>
  );
}

function EngineSelection() {
  const [engines, setEngines] = useAtom(enginesAtom);
  const persist = useSetAtom(persistEnginesAtom);

  return (
    <>
      {engines.length === 0 && (
        <Center>
          <Text>
            No engines installed. Please{" "}
            <Link to="/engines">Add an engine</Link> first.
          </Text>
        </Center>
      )}

      <ScrollArea h={250} scrollbars="y">
        <Stack gap="xs" align="center" w="100%">
          {engines.map((engine) => (
            <EngineBox
              key={engine.name}
              engine={engine}
              toggleEnabled={() => {
                setEngines((prev) =>
                  prev.map((e) =>
                    e.name === engine.name ? { ...e, loaded: !e.loaded } : e,
                  ),
                );
                // write-through to disk
                // persist is triggered elsewhere after state changes
              }}
            />
          ))}
        </Stack>
      </ScrollArea>
    </>
  );
}

export default memo(EngineSelection);
