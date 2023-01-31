import { ActionIcon, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useContext } from "react";
import {
  Annotation,
  annotationColor, VariationTree
} from "../../../utils/chess";
import TreeContext from "../../common/TreeContext";
import { AnnotationEditor } from "./AnnotationEditor";

interface AnnotationPanelProps {
  forceUpdate: () => void;
  setTree: (t: VariationTree) => void;
}

function AnnotationPanel({ setTree, forceUpdate }: AnnotationPanelProps) {
  const tree = useContext(TreeContext);

  function annotate(annotation: Annotation) {
    if (tree.annotation === annotation) {
      tree.annotation = Annotation.None;
    } else {
      tree.annotation = annotation;
    }
    setTree(tree);
    forceUpdate();
  }

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
      <AnnotationEditor forceUpdate={forceUpdate} setTree={setTree} />
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
    const isActive = tree.annotation === annotation;
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
