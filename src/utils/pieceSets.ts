/**
 * Piece set helpers shared by the settings UI, the theme loader and the custom
 * piece set importer.
 *
 * A piece set is a CSS file that only sets `background-image` for the twelve
 * `.role.color` selectors used by chessground and by the `Piece` component.
 * Built-in piece sets live in `public/pieces` and are referenced by their bare
 * file name; user piece sets live in the app's pieces directory and are
 * referenced as `custom/<file name without extension>`.
 *
 * This module deliberately has no imports so it can be unit tested in isolation
 * and reused from both the Tauri and the web side.
 */

export const PIECE_ROLES = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;
export const PIECE_COLORS = ["white", "black"] as const;

export type PieceRole = (typeof PIECE_ROLES)[number];
export type PieceColor = (typeof PIECE_COLORS)[number];

/** Piece slot, e.g. `white.knight`, which maps to the `.knight.white` selector. */
export type PieceSlot = `${PieceColor}.${PieceRole}`;

export const PIECE_SLOTS: PieceSlot[] = PIECE_COLORS.flatMap((color) =>
    PIECE_ROLES.map((role) => `${color}.${role}` as PieceSlot),
);

export const DEFAULT_PIECE_SET = "staunty";
export const CUSTOM_PIECE_SET_PREFIX = "custom/";

/** Upper bound for an imported stylesheet, to keep the webview responsive. */
export const MAX_PIECE_SET_CSS_LENGTH = 8 * 1024 * 1024;

export type PieceSetOption = {
    label: string;
    value: string;
};

export const BUILTIN_PIECE_SETS: PieceSetOption[] = [
    { label: "Alpha", value: "alpha" },
    { label: "Anarcandy", value: "anarcandy" },
    { label: "California", value: "california" },
    { label: "Cardinal", value: "cardinal" },
    { label: "Cburnett", value: "cburnett" },
    { label: "Chess7", value: "chess7" },
    { label: "Chessnut", value: "chessnut" },
    { label: "Companion", value: "companion" },
    { label: "Disguised", value: "disguised" },
    { label: "Dubrovny", value: "dubrovny" },
    { label: "Fantasy", value: "fantasy" },
    { label: "Fresca", value: "fresca" },
    { label: "Gioco", value: "gioco" },
    { label: "Governor", value: "governor" },
    { label: "Horsey", value: "horsey" },
    { label: "ICpieces", value: "icpieces" },
    { label: "Kosal", value: "kosal" },
    { label: "Leipzig", value: "leipzig" },
    { label: "Letter", value: "letter" },
    { label: "Libra", value: "libra" },
    { label: "Maestro", value: "maestro" },
    { label: "Merida", value: "merida" },
    { label: "Pirouetti", value: "pirouetti" },
    { label: "Pixel", value: "pixel" },
    { label: "Reillycraig", value: "reillycraig" },
    { label: "Riohacha", value: "riohacha" },
    { label: "Shapes", value: "shapes" },
    { label: "Spatial", value: "spatial" },
    { label: "Staunty", value: "staunty" },
    { label: "Tatiana", value: "tatiana" },
];

export function isBuiltinPieceSet(value: string): boolean {
    return BUILTIN_PIECE_SETS.some((set) => set.value === value);
}

/** Built-in piece sets are served from `public/pieces`, custom ones are user files. */
export function isCustomPieceSetId(id: string): boolean {
    return id.startsWith(CUSTOM_PIECE_SET_PREFIX) && id.length > CUSTOM_PIECE_SET_PREFIX.length;
}

export function customPieceSetName(id: string): string {
    return isCustomPieceSetId(id) ? id.slice(CUSTOM_PIECE_SET_PREFIX.length) : id;
}

export function customPieceSetId(name: string): string {
    return `${CUSTOM_PIECE_SET_PREFIX}${name}`;
}

export function builtinPieceSetHref(value: string): string {
    return `/pieces/${value}.css`;
}

export function slotSelector(slot: PieceSlot): string {
    const [color, role] = slot.split(".") as [PieceColor, PieceRole];
    return `.${role}.${color}`;
}

/** Human readable, locale independent list of slots, e.g. `white.knight, black.queen`. */
export function formatSlots(slots: PieceSlot[]): string {
    return slots.join(", ");
}

export type CssUrlKind = "data" | "remote" | "absolute" | "relative" | "fragment";

export type CssUrlRef = {
    value: string;
    kind: CssUrlKind;
};

export type PieceSetCssInfo = {
    /** Slots covered by a rule, in `PIECE_SLOTS` order. */
    covered: PieceSlot[];
    /** Slots without any rule. */
    missing: PieceSlot[];
    /** Number of rule blocks found in the stylesheet. */
    ruleCount: number;
    /** Every `url()` reference found in the stylesheet. */
    urls: CssUrlRef[];
    /** `url()` references that point outside of the stylesheet itself. */
    externalUrls: string[];
};

/**
 * Splits a stylesheet into rule blocks. Nested blocks (e.g. inside `@media`) are
 * flattened so that rules are reported with their own selector text.
 */
function splitRuleBlocks(css: string): { selector: string; body: string }[] {
    const rules: { selector: string; body: string }[] = [];

    const walk = (text: string) => {
        let buffer = "";
        let body = "";
        let depth = 0;
        let quote: string | null = null;
        let comment = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];

            if (comment) {
                if (char === "*" && next === "/") {
                    comment = false;
                    i++;
                }
                continue;
            }
            if (quote) {
                if (char === "\\") {
                    i++;
                } else if (char === quote) {
                    quote = null;
                }
                if (depth === 0) {
                    buffer += char;
                } else {
                    body += char;
                }
                continue;
            }
            if (char === "/" && next === "*") {
                comment = true;
                i++;
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
                if (depth === 0) {
                    buffer += char;
                } else {
                    body += char;
                }
                continue;
            }
            if (char === "{") {
                if (depth === 0) {
                    body = "";
                } else {
                    body += char;
                }
                depth++;
                continue;
            }
            if (char === "}") {
                depth--;
                if (depth <= 0) {
                    const selector = buffer.trim();
                    if (body.includes("{")) {
                        walk(body);
                    } else if (selector) {
                        rules.push({ selector, body });
                    }
                    buffer = "";
                    body = "";
                    depth = 0;
                } else {
                    body += char;
                }
                continue;
            }
            if (depth === 0) {
                buffer += char;
            } else {
                body += char;
            }
        }
    };

    walk(css);
    return rules;
}

function splitSelectorList(selector: string): string[] {
    return selector
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

const COLOR_CLASSES: Record<string, PieceColor> = { white: "white", black: "black" };
const ROLE_CLASSES: Record<string, PieceRole> = {
    pawn: "pawn",
    knight: "knight",
    bishop: "bishop",
    rook: "rook",
    queen: "queen",
    king: "king",
};

function selectorToSlot(selector: string): PieceSlot | null {
    const classes = selector.match(/\.[A-Za-z_-][\w-]*/g);
    if (!classes) return null;

    let color: PieceColor | null = null;
    let role: PieceRole | null = null;

    for (const className of classes) {
        const name = className.slice(1).toLowerCase();
        if (!color && COLOR_CLASSES[name]) {
            color = COLOR_CLASSES[name];
            continue;
        }
        if (!role && ROLE_CLASSES[name]) {
            role = ROLE_CLASSES[name];
        }
    }

    if (!color || !role) return null;
    return `${color}.${role}`;
}

function classifyUrl(value: string): CssUrlKind {
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("data:")) return "data";
    if (lower.startsWith("http:") || lower.startsWith("https:") || lower.startsWith("//")) {
        return "remote";
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return "absolute";
    if (trimmed.startsWith("#")) return "fragment";
    if (trimmed.startsWith("/") || trimmed.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(trimmed)) {
        return "absolute";
    }
    return "relative";
}

export function findCssUrlRefs(css: string): CssUrlRef[] {
    const refs: CssUrlRef[] = [];
    const pattern = /url\(\s*(?:'([^']*)'|"([^"]*)"|([^)'"]*))\s*\)/gi;
    let match = pattern.exec(css);
    while (match) {
        const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
        if (value) {
            refs.push({ value, kind: classifyUrl(value) });
        }
        match = pattern.exec(css);
    }
    return refs;
}

/**
 * Inspects a piece set stylesheet: which of the twelve piece slots it styles,
 * which ones are missing and whether it depends on external image files.
 */
export function parsePieceSetCss(css: string): PieceSetCssInfo {
    const rules = splitRuleBlocks(css);
    const covered = new Set<PieceSlot>();

    for (const rule of rules) {
        for (const selector of splitSelectorList(rule.selector)) {
            const slot = selectorToSlot(selector);
            if (slot) covered.add(slot);
        }
    }

    const urls = findCssUrlRefs(css);
    const ordered = PIECE_SLOTS.filter((slot) => covered.has(slot));

    return {
        covered: ordered,
        missing: PIECE_SLOTS.filter((slot) => !covered.has(slot)),
        ruleCount: rules.length,
        urls,
        externalUrls: urls
            .filter((url) => url.kind !== "data" && url.kind !== "fragment")
            .map((url) => url.value),
    };
}

/**
 * Makes a user supplied stylesheet safe to inject into the document:
 * `@import` is dropped (it can load remote stylesheets) and markup that could
 * break out of the surrounding `<style>` element is stripped.
 */
export function sanitizePieceSetCss(css: string): string {
    return css
        .replace(/^\uFEFF/, "")
        .replace(/@import[^;]*;?/gi, "")
        .replace(/@charset[^;]*;?/gi, "")
        .replace(/<\/?style/gi, "")
        .replace(/<\/?script/gi, "")
        .replace(/<!--|-->/g, "")
        .trim();
}

export type PieceSetImageEntry = {
    slot: PieceSlot;
    dataUri: string;
};

const HEADER_COMMENT = "/* Custom piece set generated by En Croissant. */";

function sanitizeComment(text: string): string {
    return text
        .replace(/\*\//g, "* /")
        .replace(/[\r\n]+/g, " ")
        .slice(0, 200);
}

/** Builds a piece set stylesheet out of already encoded piece images. */
export function buildPieceSetCss(entries: PieceSetImageEntry[], source?: string): string {
    const bySlot = new Map(
        entries.filter((entry) => entry.dataUri).map((entry) => [entry.slot, entry.dataUri]),
    );

    const lines = [HEADER_COMMENT];
    if (source) {
        lines.push(`/* Source: ${sanitizeComment(source)} */`);
    }
    for (const slot of PIECE_SLOTS) {
        const dataUri = bySlot.get(slot);
        if (dataUri) {
            lines.push(`${slotSelector(slot)} { background-image: url("${dataUri}"); }`);
        }
    }

    return `${lines.join("\n")}\n`;
}

/** Turns an arbitrary display name into a safe file name (without extension). */
export function slugifyPieceSetName(name: string): string {
    return name
        .replace(/\.[A-Za-z0-9]{1,5}$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^[-_]+|[-_]+$/g, "")
        .slice(0, 64);
}

/**
 * Returns `candidate` if it is free, otherwise appends a numeric suffix. Used so
 * that two imported themes never overwrite each other.
 */
export function uniquePieceSetName(candidate: string, taken: Iterable<string>): string {
    const used = new Set(taken);
    const base = candidate || "piece-set";
    if (!used.has(base)) return base;

    for (let i = 2; i < 1000; i++) {
        const next = `${base}-${i}`;
        if (!used.has(next)) return next;
    }
    return `${base}-${Date.now()}`;
}

const IMAGE_MIME_TYPES: Record<string, string> = {
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
};

export function fileExtension(fileName: string): string {
    const match = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
    return match ? match[1].toLowerCase() : "";
}

export function guessImageMime(fileName: string): string | null {
    return IMAGE_MIME_TYPES[fileExtension(fileName)] ?? null;
}

export function isPieceImageFile(fileName: string): boolean {
    return guessImageMime(fileName) !== null;
}

const COLOR_WORDS: Record<string, PieceColor> = {
    w: "white",
    white: "white",
    b: "black",
    black: "black",
};

const ROLE_WORDS: Record<string, PieceRole> = {
    p: "pawn",
    pawn: "pawn",
    n: "knight",
    knight: "knight",
    b: "bishop",
    bishop: "bishop",
    r: "rook",
    rook: "rook",
    q: "queen",
    queen: "queen",
    k: "king",
    king: "king",
};

/**
 * Maps a piece image file name to a piece slot. Supported shapes:
 *
 * - compact: `wK.svg`, `bp.png` (first letter = color, second letter = role)
 * - color first: `white-knight.svg`, `white_bishop.png`, `black queen.svg`
 * - role first: `knight-white.svg`, `rook_black.png`
 * - short colors: `w-b.svg`, `n-b.png`
 *
 * Ambiguous names (e.g. `b-b.svg`, which could be black bishop or black... ) are
 * rejected rather than guessed. Returns `null` for unrelated file names.
 */
export function imageFileNameToSlot(fileName: string): PieceSlot | null {
    if (!isPieceImageFile(fileName)) return null;

    const words = fileName
        .replace(/\.[A-Za-z0-9]+$/, "")
        .replace(/@?\d+x$/i, "")
        .toLowerCase()
        .split(/[\s_\-.]+/)
        .filter(Boolean);

    if (words.length === 0) return null;

    if (words.length === 1) {
        const compact = words[0];
        if (compact.length !== 2) return null;
        const color = COLOR_WORDS[compact[0]];
        const role = ROLE_WORDS[compact[1]];
        if (!color || !role) return null;
        return `${color}.${role}`;
    }

    const colorCandidates = words
        .map((word, index) => (COLOR_WORDS[word] ? index : -1))
        .filter((index) => index >= 0);
    const roleCandidates = words
        .map((word, index) => (ROLE_WORDS[word] ? index : -1))
        .filter((index) => index >= 0);

    // A word can be a color and a role at the same time (`b`), so only accept the
    // name when exactly one assignment of the two words is possible.
    const pairs: [number, number][] = [];
    for (const colorIndex of colorCandidates) {
        for (const roleIndex of roleCandidates) {
            if (colorIndex !== roleIndex) pairs.push([colorIndex, roleIndex]);
        }
    }
    if (pairs.length !== 1) return null;

    const [colorIndex, roleIndex] = pairs[0];
    const color = COLOR_WORDS[words[colorIndex]];
    const role = ROLE_WORDS[words[roleIndex]];
    if (!color || !role) return null;
    return `${color}.${role}`;
}
