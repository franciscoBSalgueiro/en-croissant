import { useContext } from "react";
import { TreeContext } from "./BoardAnalysis";

function PgnInput() {
  const tree = useContext(TreeContext);
  return <p>{tree.getTopVariation().getPGN()}</p>;
}

export default PgnInput;
