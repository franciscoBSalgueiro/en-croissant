import { ScrollArea } from "@mantine/core";
import { useContext } from "react";
import GameInfo from "../../common/GameInfo";
import { TreeStateContext } from "../../common/TreeStateContext";
import FenInput from "./FenInput";
import PgnInput from "./PgnInput";

function InfoPanel({ boardSize }: { boardSize: number }) {
  const tree = useContext(TreeStateContext);
  return (
    <ScrollArea sx={{ height: boardSize / 2 }} offsetScrollbars>
      <GameInfo headers={tree.headers} />
      <FenInput />
      <PgnInput headers={tree.headers} root={tree.root} />
    </ScrollArea>
  );
}

export default InfoPanel;
