import { ActionIcon, Group, Typography } from "@mantine/core";
import { IconVolume } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { memo, useCallback } from "react";

import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { ttsEnabledAtom } from "@/state/atoms";
import { speakComment } from "@/utils/tts";

function normalizeTiptapMarkdown(comment: string) {
  return comment.replace(/\+\+([\s\S]+?)\+\+/g, "<u>$1</u>");
}

function Comment({ comment }: { comment: string }) {
  const normalizedComment = normalizeTiptapMarkdown(comment);
  const multipleLine =
    normalizedComment.split("\n").filter((v) => v.trim() !== "").length > 1;
  const ttsEnabled = useAtomValue(ttsEnabledAtom);

  const handleSpeak = useCallback(() => {
    speakComment(comment);
  }, [comment]);

  return (
    <Group
      gap={2}
      align="flex-start"
      display={multipleLine ? "flex" : "inline-flex"}
      wrap="nowrap"
    >
      <Typography
        pl={0}
        mx={4}
        style={{
          display: multipleLine ? "block" : "inline",
          flex: 1,
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
          {normalizedComment}
        </Markdown>
      </Typography>
      {ttsEnabled && (
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          onClick={handleSpeak}
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          <IconVolume size="0.75rem" />
        </ActionIcon>
      )}
    </Group>
  );
}

export default memo(Comment);
