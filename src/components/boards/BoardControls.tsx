import { useAtom } from "jotai";
import { Box, Button, Group, Menu, ActionIcon, SegmentedControl, Slider, Switch, Text } from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop, IconChevronDown } from "@tabler/icons-react";
import {
  showArrowsAtom,
  arrowColorMeaningAtom,
  arrowOpacityMeaningAtom,
  arrowSizeMeaningAtom,
  arrowOpacityAtom,
  arrowSizeScaleAtom,
  arrowCountPolicyAtom,
  arrowBestThresholdAtom,
  snapArrowsAtom,
  showConsecutiveArrowsAtom,
  currentEnginePausedAtom,
} from "@/state/atoms";

export default function BoardControls() {
  const [enginePaused, setEnginePaused] = useAtom(currentEnginePausedAtom);
  const [showArrows, setShowArrows] = useAtom(showArrowsAtom);
  const [arrowColorMeaning, setArrowColorMeaning] = useAtom(arrowColorMeaningAtom);
  const [arrowOpacityMeaning, setArrowOpacityMeaning] = useAtom(arrowOpacityMeaningAtom);
  const [arrowSizeMeaning, setArrowSizeMeaning] = useAtom(arrowSizeMeaningAtom);
  const [arrowOpacity, setArrowOpacity] = useAtom(arrowOpacityAtom);
  const [arrowSizeScale, setArrowSizeScale] = useAtom(arrowSizeScaleAtom);
  const [arrowCountPolicy, setArrowCountPolicy] = useAtom(arrowCountPolicyAtom);
  const [arrowBestThreshold, setArrowBestThreshold] = useAtom(arrowBestThresholdAtom);
  const [snapArrows, setSnapArrows] = useAtom(snapArrowsAtom);
  const [showConsecutiveArrows, setShowConsecutiveArrows] = useAtom(showConsecutiveArrowsAtom);

  return (
    <Group gap="sm" justify="space-between">
      <Group gap="sm">
        <Button onClick={() => setEnginePaused((prev) => !prev)} leftSection={enginePaused ? <IconPlayerPlay /> : <IconPlayerStop />} variant="default">
          {enginePaused ? "Play" : "Pause"}
        </Button>
        <Group gap={4}>
          <Button onClick={() => setShowArrows((prev) => !prev)} variant={showArrows ? "filled" : "default"}>
            {showArrows ? "Arrows On" : "Arrows Off"}
          </Button>
          <Menu position="bottom-start" shadow="md" width={280}>
            <Menu.Target>
              <ActionIcon variant={showArrows ? "filled" : "default"} aria-label="Arrow settings">
                <IconChevronDown size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box p="sm">
                <Text size="sm" fw={500} mb={4}>Color</Text>
                <SegmentedControl
                  fullWidth
                  value={arrowColorMeaning}
                  onChange={(v) => setArrowColorMeaning(v as any)}
                  data={[
                    { label: "Rank", value: "rank" },
                    { label: "Score", value: "score" },
                    { label: "%Best", value: "pctBest" },
                    { label: "None", value: "uniform" },
                  ]}
                />
                <Box mt="sm">
                  <Text size="sm" fw={500} mb={4}>Opacity</Text>
                  <SegmentedControl
                    fullWidth
                    value={arrowOpacityMeaning}
                    onChange={(v) => setArrowOpacityMeaning(v as any)}
                    data={[
                      { label: "Rank", value: "rank" },
                      { label: "Score", value: "score" },
                      { label: "%Best", value: "pctBest" },
                      { label: "None", value: "uniform" },
                    ]}
                  />
                </Box>
                <Box mt="sm">
                  <Text size="sm" fw={500} mb={4}>Size</Text>
                  <SegmentedControl
                    fullWidth
                    value={arrowSizeMeaning}
                    onChange={(v) => setArrowSizeMeaning(v as any)}
                    data={[
                      { label: "Rank", value: "rank" },
                      { label: "Score", value: "score" },
                      { label: "%Best", value: "pctBest" },
                      { label: "None", value: "uniform" },
                    ]}
                  />
                </Box>
                <Box mt="md">
                  <Text size="sm" fw={500} mb={4}>Opacity ({Math.round(arrowOpacity * 100)}%)</Text>
                  <Slider min={0} max={1} step={0.05} value={arrowOpacity} onChange={setArrowOpacity} />
                </Box>
                <Box mt="md">
                  <Text size="sm" fw={500} mb={4}>Which arrows</Text>
                  <SegmentedControl
                    fullWidth
                    value={arrowCountPolicy}
                    onChange={(v) => setArrowCountPolicy(v as any)}
                    data={[
                      { label: "Top N", value: "alwaysTopN" },
                      { label: "Within Δ", value: "threshold" },
                    ]}
                  />
                  {arrowCountPolicy === "threshold" && (
                    <Box mt="xs">
                      <Text size="xs" c="dimmed" mb={4}>Max gap from best (WDL %)</Text>
                      <Slider min={1} max={50} step={1} value={arrowBestThreshold} onChange={setArrowBestThreshold} />
                    </Box>
                  )}
                </Box>
                <Box mt="md">
                  <Text size="sm" fw={500} mb={4}>Size scale ({arrowSizeScale.toFixed(2)}x)</Text>
                  <Slider min={0.5} max={2} step={0.05} value={arrowSizeScale} onChange={setArrowSizeScale} />
                </Box>
                <Box mt="md">
                  <Group justify="space-between">
                    <Text size="sm">Snap arrows to valid moves</Text>
                    <Switch checked={snapArrows} onChange={(e) => setSnapArrows(e.currentTarget.checked)} />
                  </Group>
                </Box>
                <Box mt="sm">
                  <Group justify="space-between">
                    <Text size="sm">Consecutive arrows</Text>
                    <Switch checked={showConsecutiveArrows} onChange={(e) => setShowConsecutiveArrows(e.currentTarget.checked)} />
                  </Group>
                </Box>
              </Box>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Group>
  );
}


