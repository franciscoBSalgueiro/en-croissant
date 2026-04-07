import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Modal,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { ConditionCard } from "./ConditionCard";
import {
  type QueryMode,
  type ScoutfishQueryState,
  buildScoutfishJson,
  createEmptyCondition,
  formatScoutfishJson,
  getDefaultQueryState,
} from "./scoutfishQuery";
import classes from "./ScoutfishQueryModal.module.css";

interface ScoutfishQueryModalProps {
  opened: boolean;
  onClose: () => void;
  onApply: (queryJson: string) => void;
}

export function ScoutfishQueryModal({ opened, onClose, onApply }: ScoutfishQueryModalProps) {
  const [state, setState] = useState<ScoutfishQueryState>(() => getDefaultQueryState());
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  const jsonPreview = formatScoutfishJson(state);
  const queryJson = buildScoutfishJson(state);
  const isValid = queryJson !== null;
  const isSequenceMode = state.mode === "sequence" || state.mode === "streak";

  const updateCondition = (index: number, updated: ScoutfishQueryState["conditions"][0]) => {
    setState((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? updated : c)),
    }));
  };

  const removeCondition = (index: number) => {
    setState((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const addCondition = () => {
    setState((prev) => ({
      ...prev,
      conditions: [...prev.conditions, createEmptyCondition()],
    }));
  };

  const clearAll = () => {
    setState(getDefaultQueryState());
  };

  const handleApply = () => {
    if (!isValid) return;
    onApply(JSON.stringify(queryJson));
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSearch size="1.25rem" />
          <Text fw={600} size="lg">
            Advanced Position Search
          </Text>
        </Group>
      }
      size="80%"
      centered
      styles={{
        content: {
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        },
        body: {
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        },
      }}
    >
      <Stack gap="md" className={classes.content}>
        <Box>
          <Text size="sm" fw={500} mb={4}>
            Query Mode
          </Text>
          <SegmentedControl
            data={[
              {
                value: "simple",
                label: (
                  <Tooltip label="All rules combined into one condition" withArrow>
                    <Text size="sm">Simple</Text>
                  </Tooltip>
                ),
              },
              {
                value: "sequence",
                label: (
                  <Tooltip
                    label="Conditions matched in order at any later point in the game"
                    withArrow
                  >
                    <Text size="sm">Sequence</Text>
                  </Tooltip>
                ),
              },
              {
                value: "streak",
                label: (
                  <Tooltip label="Conditions must match on consecutive half-moves" withArrow>
                    <Text size="sm">Streak</Text>
                  </Tooltip>
                ),
              },
            ]}
            value={state.mode}
            onChange={(value) => setState((prev) => ({ ...prev, mode: value as QueryMode }))}
            fullWidth
          />
          <Text size="xs" c="dimmed" mt={4}>
            {state.mode === "simple" &&
              "All rules are combined into a single condition with AND logic."}
            {state.mode === "sequence" &&
              "Each step must match in order, but can occur at any later point in the game. Useful for finding piece paths and maneuvers."}
            {state.mode === "streak" &&
              "Each step must match on consecutive half-moves. Useful for finding capture sequences or specific move patterns."}
          </Text>
        </Box>

        <Divider />

        <ScrollArea
          className={classes.queryScrollArea}
          scrollbarSize={8}
          offsetScrollbars
          scrollbars="y"
        >
          <Stack gap="md">
            <Stack gap="sm">
              {state.conditions.map((condition, idx) => (
                <ConditionCard
                  key={condition.id}
                  condition={condition}
                  index={idx}
                  isSequenceMode={isSequenceMode}
                  canRemove={state.conditions.length > 1}
                  onChange={(updated) => updateCondition(idx, updated)}
                  onRemove={() => removeCondition(idx)}
                />
              ))}
            </Stack>
          </Stack>
        </ScrollArea>
        <Button
          variant="light"
          leftSection={<IconPlus size="1rem" />}
          onClick={addCondition}
          size="sm"
        >
          {isSequenceMode ? "Add Step" : "Add Condition"}
        </Button>

        <Divider />

        {showJsonPreview && (
          <Box>
            <Group gap="xs" mb={4}>
              <Text size="sm" fw={500}>
                Query Preview
              </Text>
              {isValid ? (
                <Badge color="green" size="xs" variant="light">
                  Valid
                </Badge>
              ) : (
                <Badge color="gray" size="xs" variant="light">
                  Empty
                </Badge>
              )}
            </Group>
            <Code block className={classes.jsonPreview}>
              {jsonPreview}
            </Code>
          </Box>
        )}

        {/* Action Buttons */}
        <Group justify="space-between" className={classes.footer}>
          <Group>
            <Button
              variant="default"
              color="gray"
              leftSection={<IconTrash size="1rem" />}
              onClick={clearAll}
              size="sm"
            >
              Clear All
            </Button>
            <Button variant="default" onClick={() => setShowJsonPreview((prev) => !prev)} size="sm">
              {showJsonPreview ? "Hide Query" : "Show Query"}
            </Button>
          </Group>
          <Group>
            <Button variant="default" onClick={onClose} size="sm">
              Cancel
            </Button>
            <Button
              leftSection={<IconSearch size="1rem" />}
              onClick={handleApply}
              disabled={!isValid}
              size="sm"
            >
              Apply Search
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
