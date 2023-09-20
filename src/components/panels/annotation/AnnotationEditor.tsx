import { RichTextEditor } from "@mantine/tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { memo, useContext } from "react";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";

function AnnotationEditor({
  commentHTML,
}: {
  path: number[];
  commentHTML: string;
}) {
  const dispatch = useContext(TreeDispatchContext);
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Placeholder.configure({ placeholder: "Write here..." }),
      ],
      content: commentHTML,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        let commentHTML: string;
        let commentText: string;
        if (html === "<p></p>") {
          commentHTML = "";
          commentText = "";
        } else {
          commentHTML = html;
          commentText = editor.getText();
        }
        dispatch({
          type: "SET_COMMENT",
          payload: {
            html: commentHTML,
            text: commentText,
          },
        });
      },
    },
    [commentHTML]
  );

  return (
    <RichTextEditor editor={editor}>
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
      </RichTextEditor.Toolbar>

      <RichTextEditor.Content />
    </RichTextEditor>
  );
}

export default memo(
  AnnotationEditor,
  (prevProps, nextProps) =>
    prevProps.path === nextProps.path ||
    prevProps.commentHTML === nextProps.commentHTML
);
