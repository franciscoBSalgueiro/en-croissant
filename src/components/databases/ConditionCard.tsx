import {
  ActionIcon,
  Box,
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
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import type {
  ConditionRule,
  ConditionRuleType,
  ScoutfishCondition,
} from "./scoutfishQuery";
import {
  ALL_RULE_TYPES,
  createEmptyRule,
  LIST_RULES,
  NO_VALUE_RULES,
  RULE_DESCRIPTIONS,
  RULE_LABELS,
  SELECT_RULES,
  SINGLE_VALUE_RULES,
  STM_OPTIONS,
} from "./scoutfishQuery";
import { SubFenEditor } from "./SubFenEditor";
import { ImbalanceInput, MaterialInput, PieceToggleBar } from "./PieceInput";

interface ConditionCardProps {
  condition: ScoutfishCondition;
  index: number;
  isSequenceMode: boolean;
  canRemove: boolean;
  onChange: (updated: ScoutfishCondition) => void;
  onRemove: () => void;
}

function RuleEditor({
  rule,
  onChange,
  onRemove,
  canRemove,
}: {
  rule: ConditionRule;
  onChange: (updated: ConditionRule) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [boardOpen, { toggle: toggleBoard }] = useDisclosure(false);

  const ruleOptions = ALL_RULE_TYPES.map((t) => ({
    value: t,
    label: RULE_LABELS[t],
  }));

  const renderValueEditor = () => {
    if (NO_VALUE_RULES.includes(rule.type)) {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          Matches any position
        </Text>
      );
    }

    if (rule.type === "sub-fen") {
      return (
        <Stack gap="xs">
          <TagsInput
            placeholder="Type a sub-FEN pattern and press Enter"
            value={rule.values}
            onChange={(values) => onChange({ ...rule, values })}
            size="sm"
          />
          <Box>
            <Text
              size="xs"
              c="blue"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={toggleBoard}
            >
              {boardOpen ? "▾ Hide board editor" : "▸ Open board editor"}
            </Text>
            <Collapse in={boardOpen}>
              <Box mt="xs">
                <SubFenEditor
                  value={rule.values[0] ?? ""}
                  onChange={(fen) => {
                    const newVals = [...rule.values];
                    if (newVals.length === 0) {
                      newVals.push(fen);
                    } else {
                      newVals[0] = fen;
                    }
                    onChange({ ...rule, values: newVals });
                  }}
                />
              </Box>
            </Collapse>
          </Box>
        </Stack>
      );
    }

    if (rule.type === "material") {
      return (
        <MaterialInput
          value={rule.values[0] ?? ""}
          onChange={(v) => onChange({ ...rule, values: v ? [v] : [] })}
        />
      );
    }

    if (rule.type === "imbalance") {
      return (
        <ImbalanceInput
          value={rule.values[0] ?? ""}
          onChange={(v) => onChange({ ...rule, values: v ? [v] : [] })}
        />
      );
    }

    if (rule.type === "moved") {
      return (
        <PieceToggleBar
          value={rule.values[0] ?? ""}
          onChange={(v) => onChange({ ...rule, values: v ? [v] : [] })}
          description="Select piece types that moved. Multiple piece types = OR match."
          allowMultiple={false}
        />
      );
    }

    if (rule.type === "captured") {
      return (
        <PieceToggleBar
          value={rule.values[0] ?? ""}
          onChange={(v) => onChange({ ...rule, values: [v] })}
          description="Select piece types captured. Leave empty for quiet (non-capture) moves."
          allowMultiple={false}
          excludeKing={true}
        />
      );
    }

    if (LIST_RULES.includes(rule.type)) {
      const placeholders: Record<string, string> = {
        "white-move": "e.g. e8=Q, O-O — press Enter to add",
        "black-move": "e.g. O-O-O, Rac1 — press Enter to add",
      };
      return (
        <TagsInput
          placeholder={placeholders[rule.type] ?? "Type and press Enter"}
          value={rule.values}
          onChange={(values) => onChange({ ...rule, values })}
          size="sm"
        />
      );
    }

    if (SELECT_RULES.includes(rule.type)) {
      const options = rule.type === "stm" ? STM_OPTIONS : [];
      return (
        <Select
          placeholder="Select..."
          data={options}
          value={rule.values[0] ?? null}
          onChange={(value) =>
            onChange({ ...rule, values: value ? [value] : [] })
          }
          size="sm"
          clearable
        />
      );
    }

    return null;
  };

  return (
    <Box
      style={{
        padding: "0.5rem 0",
        borderBottom: "1px solid var(--mantine-color-default-border)",
      }}
    >
      <Group gap="sm" align="start" wrap="nowrap">
        <Box style={{ flexGrow: 1 }}>
          <Group gap="xs" mb={4}>
            <Select
              data={ruleOptions}
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
              style={{ width: 160 }}
            />
            <Text size="xs" c="dimmed" style={{ flex: 1 }}>
              {RULE_DESCRIPTIONS[rule.type]}
            </Text>
          </Group>
          {renderValueEditor()}
        </Box>
        {canRemove && (
          <Tooltip label="Remove rule">
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={onRemove}
              mt={4}
            >
              <IconTrash size="0.875rem" />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Box>
  );
}

export function ConditionCard({
  condition,
  index,
  isSequenceMode,
  canRemove,
  onChange,
  onRemove,
}: ConditionCardProps) {
  const [collapsed, { toggle }] = useDisclosure(false);

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
    onChange({
      ...condition,
      rules: [...condition.rules, createEmptyRule()],
    });
  };

  const rulesSummary = condition.rules
    .map((r) => RULE_LABELS[r.type])
    .join(" + ");

  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: isSequenceMode
          ? "var(--mantine-color-blue-6)"
          : "var(--mantine-color-teal-6)",
      }}
    >
      <Group justify="space-between" mb={collapsed ? 0 : "xs"}>
        <Group gap="xs">
          {isSequenceMode && (
            <Text
              size="xs"
              fw={700}
              c="blue"
              style={{
                background: "var(--mantine-color-blue-light)",
                borderRadius: "var(--mantine-radius-sm)",
                padding: "2px 8px",
              }}
            >
              Step {index + 1}
            </Text>
          )}
          <Text size="sm" fw={500}>
            {collapsed ? rulesSummary : "Condition"}
          </Text>
        </Group>
        <Group gap={4}>
          <Tooltip label={collapsed ? "Expand" : "Collapse"}>
            <ActionIcon variant="subtle" size="sm" onClick={toggle}>
              {collapsed ? (
                <IconChevronDown size="0.875rem" />
              ) : (
                <IconChevronUp size="0.875rem" />
              )}
            </ActionIcon>
          </Tooltip>
          {canRemove && (
            <Tooltip label="Remove condition">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={onRemove}
              >
                <IconTrash size="0.875rem" />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <Collapse in={!collapsed}>
        <Stack gap={0}>
          {condition.rules.map((rule, ruleIdx) => (
            <RuleEditor
              key={`${condition.id}-rule-${ruleIdx}`}
              rule={rule}
              onChange={(updated) => updateRule(ruleIdx, updated)}
              onRemove={() => removeRule(ruleIdx)}
              canRemove={condition.rules.length > 1}
            />
          ))}
        </Stack>
        <Group mt="xs">
          <Tooltip label="Combine another rule with AND in this condition">
            <ActionIcon variant="light" size="sm" onClick={addRule}>
              <IconPlus size="0.875rem" />
            </ActionIcon>
          </Tooltip>
          <Text size="xs" c="dimmed">
            Add rule (AND)
          </Text>
        </Group>
      </Collapse>
    </Paper>
  );
}
