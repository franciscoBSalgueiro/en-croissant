import { Box, Textarea } from "@mantine/core";
import { RichTextEditor } from "@mantine/tiptap";
import { IconMarkdown } from "@tabler/icons-react";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { atom, useAtom, useAtomValue } from "jotai";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { spellCheckAtom } from "@/state/atoms";
import { getNodeAtPath } from "@/utils/treeReducer";

type EditorMode = "rich" | "source";

const annotationEditorModeAtom = atom<EditorMode>("rich");

function AnnotationEditor() {
  const { t } = useTranslation();
  const [editorMode, setEditorMode] = useAtom(annotationEditorModeAtom);
  const isSourceMode = editorMode === "source";
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const setComment = useStore(store, (s) => s.setComment);
  const currentNode = getNodeAtPath(root, position);
  const spellCheck = useAtomValue(spellCheckAtom);
  const sourceLabel = t("RichText.Source", { defaultValue: "Toggle Markdown source" });

  const editor = useEditor(
    {
      autofocus: isSourceMode ? false : "end",
      editable: !isSourceMode,
      extensions: [
        StarterKit.configure({
          link: {
            autolink: true,
            openOnClick: false,
          },
        }),
        Markdown,
        Placeholder.configure({ placeholder: t("Board.Annotate.WriteHere") }),
      ],
      content: currentNode.comment || null,
      contentType: "markdown",
      onUpdate: ({ editor }) => {
        setComment(editor.getMarkdown());
      },
    },
    [position.join(","), editorMode],
  );

  return (
    <RichTextEditor
      editor={editor}
      spellCheck={spellCheck}
      labels={{
        boldControlLabel: t("RichText.Bold"),
        italicControlLabel: t("RichText.Italic"),
        underlineControlLabel: t("RichText.Underline"),
        strikeControlLabel: t("RichText.Strike"),
        clearFormattingControlLabel: t("RichText.ClearFormatting"),
        h1ControlLabel: t("RichText.H1"),
        h2ControlLabel: t("RichText.H2"),
        h3ControlLabel: t("RichText.H3"),
        h4ControlLabel: t("RichText.H4"),
        blockquoteControlLabel: t("RichText.Quote"),
        hrControlLabel: t("RichText.HLine"),
        bulletListControlLabel: t("RichText.BulletList"),
        orderedListControlLabel: t("RichText.NumberedList"),
        linkControlLabel: t("RichText.Link"),
        unlinkControlLabel: t("RichText.RemoveLink"),
      }}
    >
      <RichTextEditor.Toolbar>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold disabled={isSourceMode} />
          <RichTextEditor.Italic disabled={isSourceMode} />
          <RichTextEditor.Underline disabled={isSourceMode} />
          <RichTextEditor.Strikethrough disabled={isSourceMode} />
          <RichTextEditor.ClearFormatting disabled={isSourceMode} />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.H1 disabled={isSourceMode} />
          <RichTextEditor.H2 disabled={isSourceMode} />
          <RichTextEditor.H3 disabled={isSourceMode} />
          <RichTextEditor.H4 disabled={isSourceMode} />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Blockquote disabled={isSourceMode} />
          <RichTextEditor.Hr disabled={isSourceMode} />
          <RichTextEditor.BulletList disabled={isSourceMode} />
          <RichTextEditor.OrderedList disabled={isSourceMode} />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link disabled={isSourceMode} />
          <RichTextEditor.Unlink disabled={isSourceMode} />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Control
            active={isSourceMode}
            aria-pressed={isSourceMode}
            aria-label={sourceLabel}
            title={sourceLabel}
            onClick={() => setEditorMode(isSourceMode ? "rich" : "source")}
          >
            <IconMarkdown size="1rem" />
          </RichTextEditor.Control>
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>

      <Box display="grid">
        <RichTextEditor.Content
          style={{ gridArea: "1 / 1", visibility: isSourceMode ? "hidden" : undefined }}
          inert={isSourceMode}
        />
        {isSourceMode && (
          <Textarea
            value={currentNode.comment}
            onChange={(event) => setComment(event.currentTarget.value)}
            autoFocus
            autosize
            minRows={1}
            resize="none"
            size="md"
            spellCheck={spellCheck}
            aria-label={t("Board.Annotate.WriteHere")}
            placeholder={t("Board.Annotate.WriteHere")}
            styles={{
              root: {
                gridArea: "1 / 1",
                minWidth: 0,
                backgroundColor: "var(--mantine-color-body)",
                borderRadius: "0 0 var(--mantine-radius-default) var(--mantine-radius-default)",
              },
              input: {
                padding: "var(--mantine-spacing-md)",
                lineHeight: "var(--mantine-line-height)",
                fontFamily: "var(--mantine-font-family-monospace)",
                border: 0,
                borderRadius: "0 0 var(--mantine-radius-default) var(--mantine-radius-default)",
                backgroundColor: "var(--mantine-color-body)",
              },
            }}
          />
        )}
      </Box>
    </RichTextEditor>
  );
}

export default AnnotationEditor;
