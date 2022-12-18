import { TextInput } from "@mantine/core";
import { validateFen } from "chess.js";
import { useEffect, useState } from "react";

function FenInput({
  setBoardFen,
}: {
  setBoardFen: (fen: string) => void;
}) {
  const [fen, setFen] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const v = validateFen(fen);
    if (v.valid) {
      setError("");
    } else {
      setError("Invalid FEN: " + v.error);
    }
  }, [fen]);
  return (
    <form onSubmit={(e) => {e.preventDefault(); setBoardFen(fen)}}>
      <TextInput
        label="Insert FEN"
        value={fen}
        onChange={(event) => setFen(event.currentTarget.value)}
        error={error}
      />
      {/* <Button onClick={() => setBoardFen(fen)}>Submit</Button> */}
    </form>
  );
}

export default FenInput;
