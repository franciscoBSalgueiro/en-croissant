import { Text } from "@mantine/core";
import { useState } from "react";
import { getOpening } from "../utils/chess";

function OpeningName({ fen }: { fen: string }) {
  const [openingName, setOpeningName] = useState("");

  getOpening(fen).then((res) => {
    setOpeningName(res);
  });

  return <Text fz="sm">{openingName}</Text>;
}

export default OpeningName;
