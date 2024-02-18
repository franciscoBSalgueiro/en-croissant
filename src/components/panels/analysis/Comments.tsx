import { showReportArrowsAtom } from "@/atoms/atoms";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { getComment, getTension } from "@/utils/analysis";
import { positionFromFen } from "@/utils/chessops";
import { getNodeAtPath } from "@/utils/treeReducer";
import {
  Checkbox,
  Divider,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
} from "@mantine/core";
import { Chess, NormalMove, makeUci, parseSquare } from "chessops";
import { useAtom } from "jotai";
import { useContext } from "react";

function Comments() {
  const { root, position, headers } = useContext(TreeStateContext);
  const [showArrows, setShowArrows] = useAtom(showReportArrowsAtom);
  const parentNode = getNodeAtPath(
    root,
    position.slice(0, position.length - 1),
  );
  const currentNode = getNodeAtPath(root, position);
  const [parentPos] = positionFromFen(parentNode.fen);
  const [currentPos] = positionFromFen(currentNode.fen);
  const comment =
    parentPos && currentNode.move
      ? getComment(parentPos, currentNode.move)
      : null;

  const tension = currentPos ? getTension(currentPos) : null;

  return (
    <Paper withBorder p="md">
      <Stack>
        <Checkbox
          label="Show Arrows"
          checked={showArrows}
          onChange={() => setShowArrows(!showArrows)}
        />
        <Group>
          <Text>Tension</Text>
          <Progress flex={1} value={tension || 0} size="lg" />
        </Group>
        <Divider />
        <Text>{comment?.text}</Text>
      </Stack>
    </Paper>
  );
}

export default Comments;
