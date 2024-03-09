import { spellCheckAtom } from "@/atoms/atoms";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import { getNodeAtPath } from "@/utils/treeReducer";
import { RichTextEditor } from "@mantine/tiptap";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useAtomValue } from "jotai";
import { useContext } from "react";
import { Markdown } from "tiptap-markdown";

function AnnotationEditor() {
  const { root, position } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);
  const dispatch = useContext(TreeDispatchContext);
  const spellCheck = useAtomValue(spellCheckAtom);
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Link.configure({
          autolink: true,
          openOnClick: false,
        }),
        Markdown.configure({
          linkify: true,
        }),
        Placeholder.configure({ placeholder: "Write here..." }),
      ],
      content: currentNode.comment,
      onUpdate: ({ editor }) => {
        const comment = editor.storage.markdown.getMarkdown();
        dispatch({
          type: "SET_COMMENT",
          payload: comment,
        });
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
