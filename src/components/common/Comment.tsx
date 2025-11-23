import { TypographyStylesProvider } from "@mantine/core";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

export function Comment({ comment }: { comment: string }) {
  const multipleLine =
    comment.split("\n").filter((v) => v.trim() !== "").length > 1;

  return (
    <TypographyStylesProvider
      style={{
        display: multipleLine ? "block" : "inline",
        lineHeight: multipleLine ? undefined : "inherit",
      }}
    >
      <Markdown
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" />
          ),
          p: ({ children }) => (
            <span
              style={{
                display: multipleLine ? "block" : "inline",
                marginBottom: multipleLine ? undefined : 0,
              }}
            >
              {children}
            </span>
          ),
        }}
        rehypePlugins={[rehypeRaw, remarkGfm]}
      >
        {comment}
      </Markdown>
    </TypographyStylesProvider>
  );
}
