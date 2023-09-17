import { ActionIcon, Group, Stack, Text, Tooltip } from "@mantine/core";
import { memo, useContext } from "react";
import { ANNOTATION_INFO, Annotation } from "@/utils/chess";
import { getNodeAtPath } from "@/utils/treeReducer";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import AnnotationEditor from "./AnnotationEditor";

const SymbolButton = memo(function SymbolButton({
  curAnnotation,
  annotation,
}: {
  curAnnotation: Annotation;
  annotation: Annotation;
}) {
  const dispatch = useContext(TreeDispatchContext);
  const { name, color } = ANNOTATION_INFO[annotation];
  const isActive = curAnnotation === annotation;
  return (
    <Tooltip label={name}>
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
});

function AnnotationPanel() {
  const { root, position } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);
  return (
    <Stack>
      <Group grow>
        {Object.keys(ANNOTATION_INFO)
          .filter((a) => a !== "")
          .map((annotation) => {
            return (
              <SymbolButton
                key={annotation}
                curAnnotation={currentNode.annotation}
                annotation={annotation as Annotation}
              />
            );
          })}
      </Group>
      <AnnotationEditor path={position} commentHTML={currentNode.commentHTML} />
    </Stack>
  );
}

export default AnnotationPanel;
