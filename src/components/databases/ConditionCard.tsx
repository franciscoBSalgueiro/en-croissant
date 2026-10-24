import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Group,
  Paper,
  Select,
  Stack,
  TagsInput,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconChevronDown,
  IconChevronUp,
  IconGripVertical,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import type { ConditionRule, ConditionRuleType, ScoutfishCondition } from "./scoutfishQuery";
import {
  createEmptyRule,
  getAvailableRuleTypes,
  getDuplicateRuleTypes,
  RULE_LABELS,
  STM_OPTIONS,
} from "./scoutfishQuery";
import { SubFenEditor } from "./SubFenEditor";
import { PieceCountEditor, PieceToggleBar } from "./PieceInput";
import classes from "./ScoutfishQueryModal.module.css";

const RULE_OPTIONS = Object.entries(RULE_LABELS).map(([value, label]) => ({ value, label }));

interface ConditionCardProps {
  condition: ScoutfishCondition;
  index?: number;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onChange: (updated: ScoutfishCondition) => void;
  onRemove?: () => void;
}

function RuleEditor({
  rule,
  availableTypes,
  duplicate,
  onChange,
  onRemove,
}: {
  rule: ConditionRule;
  availableTypes: ConditionRuleType[];
  duplicate: boolean;
  onChange: (updated: ConditionRule) => void;
  onRemove?: () => void;
}) {
  const [boardOpen, { toggle: toggleBoard }] = useDisclosure(false);

  const renderValueEditor = () => {
    if (rule.type === "pass") {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          Matches any position
        </Text>
      );
    }

    if (rule.type === "sub-fen") {
      return (
        <Group gap="xs" wrap="nowrap">
          <TagsInput
            placeholder="Type a sub-FEN pattern and press Enter"
            value={rule.values}
            onChange={(values) => onChange({ ...rule, values })}
            size="xs"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button size="compact-xs" variant="default" onClick={toggleBoard}>
            {boardOpen ? "Hide board" : "Edit board"}
          </Button>
        </Group>
      );
    }

    if (rule.type === "material" || rule.type === "imbalance") {
      return (
        <PieceCountEditor
          type={rule.type}
          value={rule.values[0] ?? ""}
          onChange={(value) => onChange({ ...rule, values: value ? [value] : [] })}
        />
      );
    }
    if (rule.type === "moved" || rule.type === "captured") {
      return (
        <PieceToggleBar
          value={rule.values[0] ?? ""}
          onChange={(value) => onChange({ ...rule, values: [value] })}
          excludeKing={rule.type === "captured"}
        />
      );
    }
    if (rule.type === "white-move" || rule.type === "black-move") {
      return (
        <TagsInput
          placeholder={
            rule.type === "white-move"
              ? "e.g. e8=Q, O-O — press Enter to add"
              : "e.g. O-O-O, Rac1 — press Enter to add"
          }
          value={rule.values}
          onChange={(values) => onChange({ ...rule, values })}
          size="xs"
        />
      );
    }

    if (rule.type === "stm") {
      return (
        <Select
          placeholder="Select..."
          data={STM_OPTIONS}
          value={rule.values[0] ?? null}
          onChange={(value) => onChange({ ...rule, values: value ? [value] : [] })}
          size="xs"
          clearable
        />
      );
    }

    return null;
  };

  return (
    <Box
      className={classes.ruleRow}
      data-count-rule={rule.type === "material" || rule.type === "imbalance" || undefined}
    >
      <Select
        data={RULE_OPTIONS.map((option) => ({
          ...option,
          disabled:
            option.value !== rule.type &&
            !availableTypes.includes(option.value as ConditionRuleType),
        }))}
        error={duplicate}
        value={rule.type}
        onChange={(value) => {
          if (value) {
            onChange({
              type: value as ConditionRuleType,
              values: [],
            });
          }
        }}
        size="xs"
        className={classes.ruleType}
      />
      <Box className={classes.ruleValue}>{renderValueEditor()}</Box>
      <Box className={classes.ruleRemove}>
        {onRemove && (
          <Tooltip label="Remove rule">
            <ActionIcon variant="subtle" color="red" size="sm" onClick={onRemove}>
              <IconTrash size="0.875rem" />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>
      {rule.type === "sub-fen" && (
        <Collapse expanded={boardOpen} className={classes.boardDetails}>
          <SubFenEditor
            value={rule.values[0] ?? ""}
            onChange={(fen) => onChange({ ...rule, values: [fen, ...rule.values.slice(1)] })}
          />
        </Collapse>
      )}
    </Box>
  );
}

export function ConditionCard({
  condition,
  index,
  dragHandleProps,
  onChange,
  onRemove,
}: ConditionCardProps) {
  const [collapseRequested, { toggle }] = useDisclosure(false);
  const isStep = index !== undefined;
  const collapsed = isStep && collapseRequested;
  const availableTypes = getAvailableRuleTypes(condition.rules);
  const duplicateTypes = getDuplicateRuleTypes(condition.rules);

  const updateRule = (ruleIndex: number, updated: ConditionRule) => {
    const newRules = [...condition.rules];
    newRules[ruleIndex] = updated;
    onChange({ ...condition, rules: newRules });
  };

  const removeRule = (ruleIndex: number) => {
    const newRules = condition.rules.filter((_, i) => i !== ruleIndex);
    onChange({ ...condition, rules: newRules });
  };

  const addRule = () => {
    const type = availableTypes[0];
    if (!type) return;
    onChange({
      ...condition,
      rules: [...condition.rules, createEmptyRule(type)],
    });
  };

  const rulesSummary = condition.rules
    .map((rule) => {
      const value =
        rule.type === "captured" && !rule.values[0] ? "Quiet move" : rule.values.join(" / ");
      return `${RULE_LABELS[rule.type]}${value ? `: ${value}` : ""}`;
    })
    .join(" · ");

  return (
    <Paper
      withBorder
      p="xs"
      radius="sm"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: isStep ? "var(--mantine-color-blue-6)" : "var(--mantine-color-teal-6)",
      }}
    >
      <Group justify="space-between" gap="xs" wrap="nowrap" mb={collapsed ? 0 : 4}>
        <Group gap={6} wrap="nowrap" className={classes.conditionHeading}>
          {dragHandleProps && (
            <Tooltip label="Drag to reorder step">
              <Box {...dragHandleProps} c="dimmed" style={{ display: "flex", cursor: "grab" }}>
                <IconGripVertical size="1rem" />
              </Box>
            </Tooltip>
          )}
          {isStep && (
            <Text
              size="xs"
              fw={700}
              c="blue"
              style={{
                background: "var(--mantine-color-blue-light)",
                borderRadius: "var(--mantine-radius-sm)",
                padding: "2px 6px",
                flexShrink: 0,
              }}
            >
              Step {index + 1}
            </Text>
          )}
          <Text size="xs" c="dimmed" className={classes.conditionSummary}>
            {collapsed
              ? rulesSummary
              : `${condition.rules.length} ${condition.rules.length === 1 ? "rule" : "rules"}`}
          </Text>
        </Group>
        <Group gap={4} wrap="nowrap">
          {!collapsed && (
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<IconPlus size="0.875rem" />}
              onClick={addRule}
              disabled={availableTypes.length === 0}
            >
              Add rule
            </Button>
          )}
          {isStep && (
            <Tooltip label={collapsed ? "Expand" : "Collapse"}>
              <ActionIcon variant="subtle" size="sm" onClick={toggle} aria-expanded={!collapsed}>
                {collapsed ? (
                  <IconChevronDown size="0.875rem" />
                ) : (
                  <IconChevronUp size="0.875rem" />
                )}
              </ActionIcon>
            </Tooltip>
          )}
          {onRemove && (
            <Tooltip label="Remove condition">
              <ActionIcon variant="subtle" color="red" size="sm" onClick={onRemove}>
                <IconTrash size="0.875rem" />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <Collapse expanded={!collapsed}>
        <Stack gap={0}>
          {condition.rules.map((rule, ruleIdx) => (
            <RuleEditor
              key={`${condition.id}-rule-${ruleIdx}`}
              rule={rule}
              availableTypes={availableTypes}
              duplicate={duplicateTypes.includes(rule.type)}
              onChange={(updated) => updateRule(ruleIdx, updated)}
              onRemove={condition.rules.length > 1 ? () => removeRule(ruleIdx) : undefined}
            />
          ))}
        </Stack>
      </Collapse>
    </Paper>
  );
}
