import { SegmentedControl, Stack, Textarea } from "@mantine/core";
import { RichTextEditor } from "@mantine/tiptap";
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

function RichAnnotationEditor({
  comment,
  spellCheck,
  setComment,
  position,
}: {
  comment: string;
  spellCheck: boolean;
  setComment: (value: string) => void;
  position: number[];
}) {
  const { t } = useTranslation();
  const editor = useEditor(
    {
      autofocus: "end",
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
      content: comment || null,
      contentType: "markdown",
      onUpdate: ({ editor }) => {
        setComment(editor.getMarkdown());
      },
    },
    [position.join(",")],
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
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.ClearFormatting />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.H1 />
          <RichTextEditor.H2 />
          <RichTextEditor.H3 />
          <RichTextEditor.H4 />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Blockquote />
          <RichTextEditor.Hr />
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>

      <RichTextEditor.Content />
    </RichTextEditor>
  );
}

function SourceAnnotationEditor({
  comment,
  spellCheck,
  setComment,
}: {
  comment: string;
  spellCheck: boolean;
  setComment: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Textarea
      value={comment}
      onChange={(event) => setComment(event.currentTarget.value)}
      autosize
      minRows={12}
      spellCheck={spellCheck}
      placeholder={t("Board.Annotate.WriteHere")}
      styles={{
        input: {
          fontFamily: "monospace",
        },
      }}
    />
  );
}

function AnnotationEditor() {
  const [editorMode, setEditorMode] = useAtom(annotationEditorModeAtom);

  // these variables are used across both rich and source editors
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const setComment = useStore(store, (s) => s.setComment);

  const currentNode = getNodeAtPath(root, position);
  const spellCheck = useAtomValue(spellCheckAtom);

  return (
    <Stack gap="xs">
      <SegmentedControl
        size="xs"
        value={editorMode}
        onChange={(mode) => setEditorMode(mode as EditorMode)}
        data={[
          { value: "rich", label: "Rich text" },
          { value: "source", label: "Source" },
        ]}
      />
      {editorMode === "source" ? (
        <SourceAnnotationEditor
          comment={currentNode.comment}
          spellCheck={spellCheck}
          setComment={setComment}
        />
      ) : (
        <RichAnnotationEditor
          comment={currentNode.comment}
          spellCheck={spellCheck}
          setComment={setComment}
          position={position}
        />
      )}
    </Stack>
  );
}

export default AnnotationEditor;
