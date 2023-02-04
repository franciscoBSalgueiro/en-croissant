import { Text } from "@mantine/core";
import { useContext, useState } from "react";
import { getOpening } from "../../utils/chess";
import TreeContext from "../common/TreeContext";

function OpeningName() {
  const [openingName, setOpeningName] = useState("");
  const tree = useContext(TreeContext);

  getOpening(tree).then((v) => setOpeningName(v));

  return <Text fz="sm">{openingName}</Text>;
}

export default OpeningName;
