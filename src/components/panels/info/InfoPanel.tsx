import { ScrollArea, Stack, TextInput } from "@mantine/core";
import { useContext } from "react";
import { getNodeAtPath } from "../../../utils/treeReducer";
import GameInfo from "../../common/GameInfo";
import { TreeStateContext } from "../../common/TreeStateContext";
import PgnInput from "./PgnInput";

function InfoPanel({ boardSize }: { boardSize: number }) {
  const tree = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(tree.root, tree.position);
  return (
    <ScrollArea sx={{ height: boardSize / 2 }} offsetScrollbars>
      <Stack>
        <GameInfo headers={tree.headers} />
        {currentNode && (
          <TextInput
            readOnly
            value={currentNode.fen}
            label="FEN"
            labelProps={{
              sx: {
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: "0.5rem",
              },
            }}
          />
        )}
        <PgnInput headers={tree.headers} root={tree.root} />
      </Stack>
    </ScrollArea>
  );
}

export default InfoPanel;
