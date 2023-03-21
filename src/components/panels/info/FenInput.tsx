import { Stack, Text, TextInput } from "@mantine/core";
import { validateFen } from "chess.js";
import { useContext, useEffect, useState } from "react";
import TreeContext from "../../common/TreeContext";

function FenInput({ onSubmit }: { onSubmit: (fen: string) => void }) {
  const tree = useContext(TreeContext);
  const [fen, setFen] = useState(tree.fen);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setFen(tree.fen);
  }, [tree.fen]);
  return (
    <Stack spacing="sm">
      <Text fw="bold">FEN</Text>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = validateFen(fen);
          if (v.ok) {
            onSubmit(fen);
          } else {
            setError(v.error);
          }
        }}
      >
        <TextInput
          placeholder="Enter FEN"
          value={fen}
          error={error}
          onChange={(e) => {
            setFen(e.currentTarget.value);
          }}
        />
      </form>
    </Stack>
  );
}

export default FenInput;
