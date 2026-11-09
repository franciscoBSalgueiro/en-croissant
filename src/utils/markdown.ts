import type { Options as MarkdownOptions } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Markdown/GFM/HTML/tiptap syntax; chess notation like "Qh5+" or "1...e5" mid-text stays plain
const MARKDOWN_SYNTAX =
    /[*_`[\]<&\\~]|\+\+|[a-z][a-z0-9+.-]*:\/\/|www\.|@|^\s*([-+>#]|\d+[.)])|^\s{4}|\n/i;

// Text that Markdown would render unchanged, so it can skip the slow parser
export function isPlainText(text: string): boolean {
    return !MARKDOWN_SYNTAX.test(text);
}

// Comments come from PGN files and databases the user didn't write, so raw HTML in them
// is sanitized (GitHub's allowlist: no scripts, event handlers, iframes or javascript: URLs).
// <u> is added back because the tiptap editor stores underline as ++text++ -> <u>.
export const commentSanitizeSchema: SanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), "u"],
};

export const commentRehypePlugins: NonNullable<MarkdownOptions["rehypePlugins"]> = [
    rehypeRaw,
    [rehypeSanitize, commentSanitizeSchema],
    remarkGfm,
];
