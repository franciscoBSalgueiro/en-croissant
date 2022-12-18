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
    <>
      <TextInput
        label="Insert FEN"
        value={fen}
        onChange={(event) => setFen(event.currentTarget.value)}
        error={error}
      />
    </>
  );
}

export default FenInput;
