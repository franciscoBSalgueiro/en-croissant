import { ActionIcon, Group, Stack, Text, Tooltip } from "@mantine/core";
import { memo, useContext } from "react";
import {
  Annotation,
  VariationTree,
  annotationColor,
} from "../../../utils/chess";
import GameContext from "../../common/GameContext";
import { AnnotationEditor } from "./AnnotationEditor";

interface AnnotationPanelProps {
  setTree: (t: VariationTree) => void;
}

function SymbolButton({
  annotation,
  setTree,
}: AnnotationPanelProps & { annotation: Annotation }) {
  const tree = useContext(GameContext).game.tree;

  function annotate(annotation: Annotation) {
    if (tree.annotation === annotation) {
      tree.annotation = Annotation.None;
    } else {
      tree.annotation = annotation;
    }
    setTree(tree);
  }

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

function AnnotationPanel({ setTree }: AnnotationPanelProps) {
  return (
    <Stack>
      <Group grow>
        <SymbolButton setTree={setTree} annotation={Annotation.Brilliant} />
        <SymbolButton setTree={setTree} annotation={Annotation.Good} />
        <SymbolButton setTree={setTree} annotation={Annotation.Interesting} />
        <SymbolButton setTree={setTree} annotation={Annotation.Dubious} />
        <SymbolButton setTree={setTree} annotation={Annotation.Mistake} />
        <SymbolButton setTree={setTree} annotation={Annotation.Blunder} />
      </Group>
      <AnnotationEditor setTree={setTree} />
    </Stack>
  );
}

export default memo(AnnotationPanel);
