import { ActionIcon, Group, Stack, Text, Tooltip } from "@mantine/core";
import { memo, useContext } from "react";
import { Annotation, annotationColor } from "../../../utils/chess";
import { getNodeAtPath } from "../../../utils/treeReducer";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../../common/TreeStateContext";
import AnnotationEditor from "./AnnotationEditor";

const SymbolButton = memo(
  ({
    curAnnotation,
    annotation,
  }: {
    curAnnotation: Annotation;
    annotation: Annotation;
  }) => {
    const dispatch = useContext(TreeDispatchContext);
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
          onClick={() =>
            dispatch({
              type: "SET_ANNOTATION",
              payload: annotation,
            })
          }
          variant={isActive ? "filled" : "default"}
          color={color}
        >
          <Text>{annotation}</Text>
        </ActionIcon>
      </Tooltip>
    );
  }
);

function AnnotationPanel() {
  const { root, position } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);
  if (!currentNode) {
    return null;
  }
  return (
    <Stack>
      <Group grow>
        <SymbolButton
          curAnnotation={currentNode.annotation}
          annotation={Annotation.Brilliant}
        />
        <SymbolButton
          curAnnotation={currentNode.annotation}
          annotation={Annotation.Good}
        />
        <SymbolButton
          curAnnotation={currentNode.annotation}
          annotation={Annotation.Interesting}
        />
        <SymbolButton
          curAnnotation={currentNode.annotation}
          annotation={Annotation.Dubious}
        />
        <SymbolButton
          curAnnotation={currentNode.annotation}
          annotation={Annotation.Mistake}
        />
        <SymbolButton
          curAnnotation={currentNode.annotation}
          annotation={Annotation.Blunder}
        />
      </Group>
      <AnnotationEditor path={position} commentHTML={currentNode.commentHTML} />
    </Stack>
  );
}

export default AnnotationPanel;
