import { ActionIcon, Group, Stack, Text, Tooltip } from "@mantine/core";
import { Editor } from "@tiptap/react";
import { Annotation, annotationColor } from "../utils/chess";
import { AnnotationEditor } from "./AnnotationEditor";

interface AnnotationPanelProps {
  editor: Editor | null;
  curAnnotation: Annotation;
  annotate: (a: Annotation) => void; 
}

function AnnotationPanel({
  editor,
  curAnnotation,
  annotate
}: AnnotationPanelProps) {
  return (
    <Stack>
      <Group grow>
        <SymbolButton annotation={Annotation.Brilliant} />
        <SymbolButton annotation={Annotation.Good} />
        <SymbolButton annotation={Annotation.Interesting} />
        <SymbolButton annotation={Annotation.Dubious} />
        <SymbolButton annotation={Annotation.Mistake} />
        <SymbolButton annotation={Annotation.Blunder} />
      </Group>
      <AnnotationEditor editor={editor} />
    </Stack>
  );

  function SymbolButton({ annotation }: { annotation: Annotation }) {
    let label: string;
    switch (annotation) {
      case Annotation.Good:
        label = "Good";
        break;
      case Annotation.Brilliant:
        label = "Brilliant";
        break;
      case Annotation.Mistake:
        label = "Mistake";
        break;
      case Annotation.Blunder:
        label = "Blunder";
        break;
      case Annotation.Dubious:
        label = "Dubious";
        break;
      case Annotation.Interesting:
        label = "Interesting";
        break;
      default:
        label = "Unknown";
    }
    const color = annotationColor(annotation);
    const isActive = curAnnotation === annotation;
    return (
      <Tooltip label={label}>
        <ActionIcon
          onClick={() => annotate(annotation)}
          variant={isActive ? "filled" : "default"}
          color={color}
        >
          <Text>{annotation}</Text>
        </ActionIcon>
      </Tooltip>
    );
  }
}

export default AnnotationPanel;
