import { getOpening } from "@/utils/chess";
import { Text } from "@mantine/core";
import { useContext, useEffect, useState } from "react";
import { TreeStateContext } from "../common/TreeStateContext";

function OpeningName() {
  const [openingName, setOpeningName] = useState("");
  const { root, position } = useContext(TreeStateContext);

  useEffect(() => {
    getOpening(root, position).then((v) => setOpeningName(v));
  }, [root, position]);

  return (
    <Text style={{ userSelect: "text" }} fz="sm">
      {openingName}
    </Text>
  );
}

export default OpeningName;
