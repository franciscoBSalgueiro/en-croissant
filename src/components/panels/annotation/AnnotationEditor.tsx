import { RichTextEditor } from "@mantine/tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useContext } from "react";
import TreeContext from "../../common/TreeContext";

interface AnnotationEditorProps {
  forceUpdate: () => void;
  setTree: any;
}
export function AnnotationEditor({
  setTree,
  forceUpdate,
}: AnnotationEditorProps) {
  const tree = useContext(TreeContext);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Placeholder.configure({ placeholder: "Write here..." }),
      ],
      content: tree.commentHTML,
      onUpdate: ({ editor }) => {
        setTree((prev: any) => {
          const html = editor.getHTML();
          if (html === "<p></p>") {
            prev.commentHTML = "";
            prev.commentText = "";
          } else {
            prev.commentHTML = html;
            prev.commentText = editor.getText();
          }
          return prev;
        });
        forceUpdate();
      },
    },
    [tree]
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
