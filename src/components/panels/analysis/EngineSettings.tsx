import { Collapse, Group, Text } from "@mantine/core";
import { memo } from "react";
import CoresSlide from "./CoresSlider";
import DepthSlider from "./DepthSlider";
import LinesSlider from "./LinesSlider";

interface EngineSettingsProps {
  settingsOn: boolean;
  numberLines: number;
  setNumberLines: React.Dispatch<React.SetStateAction<number>>;
  maxDepth: number;
  setMaxDepth: React.Dispatch<React.SetStateAction<number>>;
  cores: number;
  setCores: React.Dispatch<React.SetStateAction<number>>;
}

function EngineSettings({
  settingsOn,
  numberLines,
  setNumberLines,
  maxDepth,
  setMaxDepth,
  cores,
  setCores,
}: EngineSettingsProps) {
  return (
    <Collapse in={settingsOn} px={30} pb={15}>
      <Group grow>
        <Text size="sm" fw="bold">
          Number of Lines
        </Text>
        <LinesSlider value={numberLines} setValue={setNumberLines} />
      </Group>
      <Group grow>
        <Text size="sm" fw="bold">
          Engine Depth
        </Text>
        <DepthSlider value={maxDepth} setValue={setMaxDepth} />
      </Group>
      <Group grow>
        <Text size="sm" fw="bold">
          Number of cores
        </Text>
        <CoresSlide value={cores} setValue={setCores} />
      </Group>
    </Collapse>
  );
}

export default memo(EngineSettings);
