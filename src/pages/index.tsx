import { DEFAULT_POSITION } from "chess.js";
import { useState } from "react";
import BoardAnalysis from "../components/BoardAnalysis";
import FenInput from "../components/FenInput";

export default function Page() {
  const [boardFen, setBoardFen] = useState(DEFAULT_POSITION)
  console.log(boardFen)
  return (
    <>
      <BoardAnalysis initialFen={boardFen} />
      <FenInput setBoardFen={setBoardFen} />
    </>
  );
}
