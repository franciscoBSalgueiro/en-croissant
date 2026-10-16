import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
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
  type ScoutfishCondition,
  buildScoutfishJson,
  changeQueryMode,
  createEmptyCondition,
  getDefaultQueryState,
  hasDuplicateRules,
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

  const queryJson = buildScoutfishJson(state);
  const isValid = queryJson !== null;
  const isOrderedMode = state.mode !== "simple";
  const hasDuplicates = hasDuplicateRules(state);

  const updateCondition = (index: number, updated: ScoutfishCondition) => {
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

  const moveCondition = ({ source, destination }: DropResult) => {
    if (!destination || source.index === destination.index) return;

    setState((prev) => {
      const conditions = [...prev.conditions];
      const [condition] = conditions.splice(source.index, 1);
      conditions.splice(destination.index, 0, condition);
      return { ...prev, conditions };
    });
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
            Advanced Search
          </Text>
        </Group>
      }
      size="80%"
      centered
      transitionProps={{ transition: "fade" }}
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
      <Stack gap="xs" className={classes.content}>
        <Box>
          <Group gap="sm">
            <Text size="sm" fw={500}>
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
              onChange={(value) => setState((prev) => changeQueryMode(prev, value as QueryMode))}
              size="xs"
            />
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {state.mode === "simple" && "All rules must match the same position."}
            {state.mode === "sequence" &&
              "Each step must match in order, but can occur at any later point in the game. Useful for finding piece paths and maneuvers."}
            {state.mode === "streak" &&
              "Each step must match on consecutive half-moves. Useful for finding capture sequences or specific move patterns."}
          </Text>
        </Box>

        <Divider />

        {hasDuplicates && (
          <Text size="xs" c="red">
            Each rule type can appear only once {isOrderedMode ? "per step" : "in Simple mode"}.{" "}
            Remove or change the highlighted duplicates to apply the search.
          </Text>
        )}

        <ScrollArea
          className={classes.queryScrollArea}
          scrollbarSize={8}
          offsetScrollbars
          scrollbars="y"
        >
          {isOrderedMode ? (
            <DragDropContext onDragEnd={moveCondition}>
              <Droppable droppableId="scoutfish-steps">
                {(provided) => (
                  <Stack gap={6} ref={provided.innerRef} {...provided.droppableProps}>
                    {state.conditions.map((condition, idx) => (
                      <Draggable
                        key={condition.id}
                        draggableId={condition.id}
                        index={idx}
                        isDragDisabled={state.conditions.length < 2}
                      >
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps}>
                            <ConditionCard
                              condition={condition}
                              index={idx}
                              dragHandleProps={provided.dragHandleProps}
                              onChange={(updated) => updateCondition(idx, updated)}
                              onRemove={
                                state.conditions.length > 1 ? () => removeCondition(idx) : undefined
                              }
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Stack>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <ConditionCard
              condition={state.conditions[0]}
              onChange={(updated) => updateCondition(0, updated)}
            />
          )}
        </ScrollArea>
        {isOrderedMode && (
          <Button
            variant="light"
            leftSection={<IconPlus size="1rem" />}
            onClick={addCondition}
            size="compact-sm"
            className={classes.addCondition}
          >
            Add Step
          </Button>
        )}

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
                <Badge color={hasDuplicates ? "red" : "gray"} size="xs" variant="light">
                  {hasDuplicates ? "Duplicates" : "Empty"}
                </Badge>
              )}
            </Group>
            <Code block className={classes.jsonPreview}>
              {queryJson
                ? JSON.stringify(queryJson, null, 2)
                : hasDuplicates
                  ? "// Resolve duplicate rule types above"
                  : "// Empty query — add rules above"}
            </Code>
          </Box>
        )}

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
