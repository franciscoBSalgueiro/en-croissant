import { RichTextEditor } from "@mantine/tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useAtomValue } from "jotai";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { spellCheckAtom } from "@/state/atoms";
import { getNodeAtPath } from "@/utils/treeReducer";

function AnnotationEditor() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const setComment = useStore(store, (s) => s.setComment);

  const currentNode = getNodeAtPath(root, position);
  const spellCheck = useAtomValue(spellCheckAtom);
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
      content: currentNode.comment || null,
      contentType: "markdown",
      onUpdate: ({ editor }) => {
        setComment(editor.getMarkdown());
      },
    },
    [position.join(",")],
  );

  return (
    <RichTextEditor editor={editor} spellCheck={spellCheck}>
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

export default AnnotationEditor;
