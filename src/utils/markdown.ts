// Markdown/GFM/HTML/tiptap syntax; chess notation like "Qh5+" or "1...e5" mid-text stays plain
const MARKDOWN_SYNTAX =
    /[*_`[\]<&\\~]|\+\+|[a-z][a-z0-9+.-]*:\/\/|www\.|@|^\s*([-+>#]|\d+[.)])|^\s{4}|\n/i;

// Text that Markdown would render unchanged, so it can skip the slow parser
export function isPlainText(text: string): boolean {
    return !MARKDOWN_SYNTAX.test(text);
}
