import { Text } from "@mantine/core";
import { useContext } from "react";
import useSWRImmutable from "swr/immutable";
import { useStore } from "zustand";
import { getOpening, getVariationLine } from "@/utils/chess";
import { TreeStateContext } from "./TreeStateContext";

function OpeningName() {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);

  // Looked up once for each line and kept, so a tab shown again has its name at once; while a new
  // line's name is looked up, the last one stays
  const { data: openingName = "" } = useSWRImmutable(
    ["opening", root.fen, ...getVariationLine(root, position)],
    () => getOpening(root, position),
    { keepPreviousData: true },
  );

  return (
    <Text style={{ userSelect: "text" }} fz="sm">
      {openingName}
    </Text>
  );
}

export default OpeningName;
