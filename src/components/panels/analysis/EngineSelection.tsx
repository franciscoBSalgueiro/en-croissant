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
import { useAtom, useAtomValue } from "jotai";
import { memo } from "react";
import { Trans } from "react-i18next";
import LocalImage from "@/components/common/LocalImage";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import { type Engine, stopEngine } from "@/utils/engines";

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
      onClick={() => {
        if (engine.loaded && engine.type === "local") {
          stopEngine(engine, activeTab!);
        }
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

  if (!engines) return null;

  return (
    <>
      {engines.length === 0 && (
        <Center>
          <Text>
            <Trans
              i18nKey="Engines.Selection.None"
              components={{
                addEngineLink: <Link to="/engines" />,
              }}
            />
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
                setEngines(async (prev) =>
                  (await prev).map((e) =>
                    e.name === engine.name ? { ...e, loaded: !e.loaded } : e,
                  ),
                );
              }}
            />
          ))}
        </Stack>
      </ScrollArea>
    </>
  );
}

export default memo(EngineSelection);
