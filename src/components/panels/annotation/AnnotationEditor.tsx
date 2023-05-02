import { RichTextEditor } from "@mantine/tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { VariationTree } from "../../../utils/chess";

interface AnnotationEditorProps {
  tree: VariationTree;
  setTree: (tree: VariationTree) => void;
}
export function AnnotationEditor({ tree, setTree }: AnnotationEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Placeholder.configure({ placeholder: "Write here..." }),
      ],
      content: tree.commentHTML,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        if (html === "<p></p>") {
          tree.commentHTML = "";
          tree.commentText = "";
        } else {
          tree.commentHTML = html;
          tree.commentText = editor.getText();
        }
        setTree(tree);
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
