import { Typography } from "@mantine/core";
import { memo } from "react";

import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { isPlainText } from "@/utils/markdown";

function normalizeTiptapMarkdown(comment: string) {
  return comment.replace(/\+\+([\s\S]+?)\+\+/g, "<u>$1</u>");
}

function Comment({ comment }: { comment: string }) {
  // Big repertoires have thousands of comments, most of them without any formatting
  if (isPlainText(comment)) {
    return (
      <Typography pl={0} mx={4} style={{ display: "inline" }}>
        <span>{comment.trim()}</span>
      </Typography>
    );
  }

  const normalizedComment = normalizeTiptapMarkdown(comment);
  const multipleLine = normalizedComment.split("\n").filter((v) => v.trim() !== "").length > 1;

  return (
    <Typography
      pl={0}
      mx={4}
      style={{
        display: multipleLine ? "block" : "inline",
      }}
    >
      <Markdown
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          p: ({ node: _node, ...props }) => (multipleLine ? <p {...props} /> : <span {...props} />),
        }}
        rehypePlugins={[rehypeRaw, remarkGfm]}
      >
        {normalizedComment}
      </Markdown>
    </Typography>
  );
}

export default memo(Comment);
