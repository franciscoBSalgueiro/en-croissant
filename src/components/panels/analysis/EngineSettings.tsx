import { Collapse, Group, Text } from "@mantine/core";
import React, { memo } from "react";
import CoresSlide from "./CoresSlider";
import DepthSlider from "./DepthSlider";
import LinesSlider from "./LinesSlider";
import { EngineSettings } from "@/atoms/atoms";

interface EngineSettingsProps {
  settingsOn: boolean;
  numberLines: number;
  maxDepth: number;
  cores: number;
  setSettings: React.Dispatch<React.SetStateAction<EngineSettings>>;
}

function EngineSettings({
  settingsOn,
  numberLines,
  maxDepth,
  cores,
  setSettings,
}: EngineSettingsProps) {
  return (
    <Collapse in={settingsOn} px={30} pb={15}>
      <Group grow>
        <Text size="sm" fw="bold">
          Number of Lines
        </Text>
        <LinesSlider
          value={numberLines}
          setValue={(v) => setSettings((prev) => ({ ...prev, numberLines: v }))}
        />
      </Group>
      <Group grow>
        <Text size="sm" fw="bold">
          Engine Depth
        </Text>
        <DepthSlider
          value={maxDepth}
          setValue={(v) => setSettings((prev) => ({ ...prev, maxDepth: v }))}
        />
      </Group>
      <Group grow>
        <Text size="sm" fw="bold">
          Number of cores
        </Text>
        <CoresSlide
          value={cores}
          setValue={(v) => setSettings((prev) => ({ ...prev, cores: v }))}
        />
      </Group>
    </Collapse>
  );
}

export default memo(EngineSettings);
