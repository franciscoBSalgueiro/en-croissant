import { EngineSettings } from "@/atoms/atoms";
import { Collapse, Group, Text } from "@mantine/core";
import React, { memo } from "react";
import CoresSlide from "./CoresSlider";
import DepthSlider from "./DepthSlider";
import LinesSlider from "./LinesSlider";

interface EngineSettingsProps {
  settingsOn: boolean;
  settings: EngineSettings;
  setSettings: React.Dispatch<React.SetStateAction<EngineSettings>>;
}

function EngineSettings({
  settingsOn,
  settings,
  setSettings,
}: EngineSettingsProps) {
  return (
    <Collapse in={settingsOn} px={30} pb={15}>
      <Group grow>
        <Text size="sm" fw="bold">
          Number of Lines
        </Text>
        <LinesSlider
          value={settings.numberLines}
          setValue={(v) => setSettings((prev) => ({ ...prev, numberLines: v }))}
        />
      </Group>
      <Group grow>
        <Text size="sm" fw="bold">
          Engine Depth
        </Text>
        <DepthSlider
          value={settings.go}
          setValue={(v) => setSettings((prev) => ({ ...prev, go: v }))}
        />
      </Group>
      <Group grow>
        <Text size="sm" fw="bold">
          Number of cores
        </Text>
        <CoresSlide
          value={settings.cores}
          setValue={(v) => setSettings((prev) => ({ ...prev, cores: v }))}
        />
      </Group>
    </Collapse>
  );
}

export default memo(EngineSettings);
