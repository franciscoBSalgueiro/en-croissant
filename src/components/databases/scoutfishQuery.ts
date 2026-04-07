/**
 * Scoutfish query builder types and JSON serialization helpers.
 *
 * A scoutfish query is either:
 * - A single condition (object with rule keys)
 * - A sequence of conditions (ordered, matched progressively through the game)
 * - A streak of conditions (consecutive half-moves)
 *
 * Each "condition" can combine multiple rules via AND (e.g. sub-fen + material).
 *
 * Note: Aix's scoutfish_query() does NOT support `result` or `result-type` —
 * use the SQL `result` column and existing game table filters instead.
 */

// ---------------------------------------------------------------------------
// Condition rule types
// ---------------------------------------------------------------------------

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
    /** For list-capable rules this is string[]; for single-value rules it's string */
    values: string[];
}

/** A single condition card: one or more rules combined via AND */
export interface ScoutfishCondition {
    id: string;
    rules: ConditionRule[];
}

export type QueryMode = "simple" | "sequence" | "streak";

/** Top-level query builder state */
export interface ScoutfishQueryState {
    mode: QueryMode;
    conditions: ScoutfishCondition[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 1;
export function generateId(): string {
    return `cond-${nextId++}-${Date.now()}`;
}

export function createEmptyCondition(): ScoutfishCondition {
    return {
        id: generateId(),
        rules: [{ type: "material", values: [] }],
    };
}

export function createEmptyRule(): ConditionRule {
    return { type: "material", values: [] };
}

export function getDefaultQueryState(): ScoutfishQueryState {
    return {
        mode: "simple",
        conditions: [createEmptyCondition()],
    };
}

/** Rules that support a list of values (rendered as TagsInput) */
export const LIST_RULES: ConditionRuleType[] = [
    "material",
    "imbalance",
    "sub-fen",
    "white-move",
    "black-move",
];

/** Rules that take a single free-text value */
export const SINGLE_VALUE_RULES: ConditionRuleType[] = ["moved", "captured"];

/** Rules rendered as a select dropdown */
export const SELECT_RULES: ConditionRuleType[] = ["stm"];

/** Rules with no value */
export const NO_VALUE_RULES: ConditionRuleType[] = ["pass"];

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

export const RULE_DESCRIPTIONS: Record<ConditionRuleType, string> = {
    material:
        "Match material distribution. Capital = white, lowercase for black after K. E.g. KBNKNN, KBNPKNN",
    imbalance:
        "Match material imbalance. E.g. PPPv = 3 pawn advantage for white, PPvN = 2 pawns up but down a knight",
    "sub-fen":
        "Match a sub-FEN board pattern. Use the board editor to place pieces. 1-8 = empty squares",
    "white-move": "Match a specific white move in SAN notation. E.g. e8=Q, O-O, Nf3",
    "black-move": "Match a specific black move in SAN notation. E.g. O-O-O, Rac1, dxe5",
    moved: "Match specific piece types that moved. E.g. KP = king or pawn. Listed in a single string",
    captured:
        "Match specific piece types captured. E.g. Q = queen captured. Empty string = quiet move",
    stm: "Side to move at the matched position",
    pass: "Matches any position. Useful as a placeholder in sequences/streaks",
};

export const ALL_RULE_TYPES: ConditionRuleType[] = [
    "material",
    "imbalance",
    "sub-fen",
    "white-move",
    "black-move",
    "moved",
    "captured",
    "stm",
    "pass",
];

export const STM_OPTIONS = [
    { value: "white", label: "White" },
    { value: "black", label: "Black" },
];

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
    const merged: Record<string, unknown> = {};
    for (const rule of condition.rules) {
        const obj = ruleToJson(rule);
        if (obj) {
            Object.assign(merged, obj);
        }
    }
    return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * Convert the UI state into a scoutfish JSON query object.
 * Returns `null` if the query is empty / invalid.
 */
export function buildScoutfishJson(state: ScoutfishQueryState): Record<string, unknown> | null {
    const jsonConditions = state.conditions
        .map(conditionToJson)
        .filter((c): c is Record<string, unknown> => c !== null);

    if (jsonConditions.length === 0) return null;

    switch (state.mode) {
        case "simple":
            // Simple mode: merge all conditions into one object
            if (jsonConditions.length === 1) return jsonConditions[0];
            return Object.assign({}, ...jsonConditions);
        case "sequence":
            return { sequence: jsonConditions };
        case "streak":
            return { streak: jsonConditions };
        default:
            return null;
    }
}

/**
 * Pretty-print the JSON for preview.
 */
export function formatScoutfishJson(state: ScoutfishQueryState): string {
    const json = buildScoutfishJson(state);
    if (!json) return "// Empty query — add conditions above";
    return JSON.stringify(json, null, 2);
}
