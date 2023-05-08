import { ScrollArea } from "@mantine/core";
import { useContext } from "react";
import { getNodeAtPath } from "../../../utils/treeReducer";
import GameInfo from "../../common/GameInfo";
import { TreeStateContext } from "../../common/TreeStateContext";
import FenInput from "./FenInput";
import PgnInput from "./PgnInput";

function InfoPanel({ boardSize }: { boardSize: number }) {
  const tree = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(tree.root, tree.position);
  return (
    <ScrollArea sx={{ height: boardSize / 2 }} offsetScrollbars>
      <GameInfo headers={tree.headers} />
      {currentNode && <FenInput currentFen={currentNode.fen} />}
      <PgnInput headers={tree.headers} root={tree.root} />
    </ScrollArea>
  );
}

export default InfoPanel;
