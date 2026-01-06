import { TypographyStylesProvider } from "@mantine/core";

import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

export function Comment({ comment }: { comment: string }) {
  const multipleLine =
    comment.split("\n").filter((v) => v.trim() !== "").length > 1;

  return (
    <TypographyStylesProvider
      pl={0}
      mx={4}
      style={{
        display: multipleLine ? "block" : "inline",
      }}
    >
      <Markdown
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" />
          ),
          p: ({ node, ...props }) =>
            multipleLine ? <p {...props} /> : <span {...props} />,
        }}
        rehypePlugins={[rehypeRaw, remarkGfm]}
      >
        {comment}
      </Markdown>
    </TypographyStylesProvider>
  );
}
