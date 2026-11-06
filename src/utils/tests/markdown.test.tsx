import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { expect, test } from "vitest";
import { isPlainText } from "../markdown";

// The Markdown setup of Comment.tsx for a single line comment
function markdown(text: string) {
  return renderToStaticMarkup(
    createElement(
      Markdown,
      {
        components: { p: ({ node: _node, ...props }) => createElement("span", props) },
        rehypePlugins: [rehypeRaw, remarkGfm],
      },
      text,
    ),
  );
}

const plain = [
  "Main line",
  "Black recaptures; → Nf3 develops with tempo",
  "Qh5+ forks king and rook, Qxf7# is mate",
  "After 3...Nf6 4.Ng5 d5 the knight is attacked",
  "Threat: Bxf7+ then Ng5. Plan = kingside attack (h4-h5)!",
  "Eval +1.2, 0-0 next; a/b files open",
  "  leading and trailing spaces  ",
  "e4 e5 1-0 50% of games, 2 + 2 = 4",
];

const formatted = [
  "**bold**",
  "*italic*",
  "_italic_",
  "`code`",
  "[link](https://lichess.org)",
  "see https://lichess.org",
  "see www.lichess.org",
  "mail me@example.com",
  "<u>underline</u>",
  "++underline++",
  "&amp; entity",
  "~~struck~~",
  "escaped \\* star",
  "- list item",
  "+ list item",
  "1. list item",
  "1) list item",
  "# heading",
  "> quote",
  "    code block",
  "two\nlines",
];

test("only plain text skips Markdown, and renders exactly like it", () => {
  for (const text of plain) {
    expect({ text, plain: isPlainText(text) }).toEqual({ text, plain: true });
    expect(renderToStaticMarkup(createElement("span", null, text.trim()))).toBe(markdown(text));
  }
  for (const text of formatted) {
    expect({ text, plain: isPlainText(text) }).toEqual({ text, plain: false });
  }
});
