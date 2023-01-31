import { DEFAULT_POSITION } from "chess.js";
import { createContext } from "react";
import { VariationTree } from "../../utils/chess";

const TreeContext = createContext(
    new VariationTree(null, DEFAULT_POSITION, null)
);

export default TreeContext;
