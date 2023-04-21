import { Text } from "@mantine/core";
import { useContext, useState } from "react";
import { getOpening } from "../../utils/chess";
import GameContext from "../common/GameContext";

function OpeningName() {
  const [openingName, setOpeningName] = useState("");
  const tree = useContext(GameContext).game.tree;

  getOpening(tree).then((v) => setOpeningName(v));

  return <Text fz="sm">{openingName}</Text>;
}

export default OpeningName;
