export type ConditionRuleType =
    | "material"
    | "imbalance"
    | "sub-fen"
    | "white-move"
    | "black-move"
    | "moved"
    | "captured"
    | "stm"
    | "pass";

export interface ConditionRule {
    type: ConditionRuleType;
    values: string[];
}

export interface ScoutfishCondition {
    id: string;
    rules: ConditionRule[];
}

export type QueryMode = "simple" | "sequence" | "streak";

/** Top-level query builder state */
export interface ScoutfishQueryState {
    mode: QueryMode;
    conditions: ScoutfishCondition[];
    /** Ordered steps retained while Simple displays a flattened rule list. */
    orderedConditions?: ScoutfishCondition[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 1;
function generateId(): string {
    return `cond-${nextId++}-${Date.now()}`;
}

export function createEmptyCondition(): ScoutfishCondition {
    return {
        id: generateId(),
        rules: [createEmptyRule()],
    };
}

export function createEmptyRule(type: ConditionRuleType = "material"): ConditionRule {
    return { type, values: [] };
}

export function getDefaultQueryState(): ScoutfishQueryState {
    return {
        mode: "simple",
        conditions: [createEmptyCondition()],
    };
}

export function changeQueryMode(state: ScoutfishQueryState, mode: QueryMode): ScoutfishQueryState {
    if (mode === "simple" && state.mode !== "simple") {
        return {
            ...state,
            mode,
            orderedConditions: state.conditions,
            conditions:
                state.conditions.length > 1
                    ? [
                          {
                              ...state.conditions[0],
                              rules: state.conditions.flatMap((condition) => condition.rules),
                          },
                      ]
                    : state.conditions,
        };
    }
    if (mode !== "simple" && state.mode === "simple" && state.orderedConditions) {
        return { mode, conditions: state.orderedConditions };
    }
    return { ...state, mode };
}

export const RULE_LABELS: Record<ConditionRuleType, string> = {
    material: "Material",
    imbalance: "Imbalance",
    "sub-fen": "Sub-FEN",
    "white-move": "White Move",
    "black-move": "Black Move",
    moved: "Moved Piece(s)",
    captured: "Captured Piece(s)",
    stm: "Side to Move",
    pass: "Pass (any)",
};

export const STM_OPTIONS = [
    { value: "white", label: "White" },
    { value: "black", label: "Black" },
];

export function getAvailableRuleTypes(rules: ConditionRule[]): ConditionRuleType[] {
    return (Object.keys(RULE_LABELS) as ConditionRuleType[]).filter(
        (type) => !rules.some((rule) => rule.type === type),
    );
}

export function getDuplicateRuleTypes(rules: ConditionRule[]): ConditionRuleType[] {
    const seen = new Set<ConditionRuleType>();
    const duplicates = new Set<ConditionRuleType>();
    for (const rule of rules) {
        if (seen.has(rule.type)) duplicates.add(rule.type);
        seen.add(rule.type);
    }
    return [...duplicates];
}

export function hasDuplicateRules(state: ScoutfishQueryState): boolean {
    const groups =
        state.mode === "simple"
            ? [state.conditions.flatMap((condition) => condition.rules)]
            : state.conditions.map((condition) => condition.rules);
    return groups.some((rules) => getDuplicateRuleTypes(rules).length > 0);
}

// ---------------------------------------------------------------------------
// JSON builder
// ---------------------------------------------------------------------------

function ruleToJson(rule: ConditionRule): Record<string, unknown> | null {
    switch (rule.type) {
        case "material":
        case "imbalance":
        case "sub-fen":
        case "white-move":
        case "black-move": {
            if (rule.values.length === 0) return null;
            return {
                [rule.type]: rule.values.length === 1 ? rule.values[0] : rule.values,
            };
        }
        case "moved":
        case "captured": {
            const val = rule.values[0] ?? "";
            return { [rule.type]: val };
        }
        case "stm": {
            if (rule.values.length === 0 || !rule.values[0]) return null;
            return { [rule.type]: rule.values[0] };
        }
        case "pass":
            return { pass: "" };
        default:
            return null;
    }
}

function conditionToJson(condition: ScoutfishCondition): Record<string, unknown> | null {
    return combineRules(
        condition.rules
            .map(ruleToJson)
            .filter((rule): rule is Record<string, unknown> => rule !== null),
    );
}

function combineRules(rules: Record<string, unknown>[]): Record<string, unknown> | null {
    const merged: Record<string, unknown> = {};
    for (const rule of rules) {
        Object.assign(merged, rule);
    }
    return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * Convert the UI state into a scoutfish JSON query object.
 * Returns `null` if the query is empty / invalid.
 */
export function buildScoutfishJson(state: ScoutfishQueryState): Record<string, unknown> | null {
    if (hasDuplicateRules(state)) return null;
    const jsonConditions = state.conditions
        .map(conditionToJson)
        .filter((c): c is Record<string, unknown> => c !== null);

    if (jsonConditions.length === 0) return null;

    switch (state.mode) {
        case "simple":
            return combineRules(jsonConditions);
        case "sequence":
            return { sequence: jsonConditions };
        case "streak":
            return { streak: jsonConditions };
        default:
            return null;
    }
}
