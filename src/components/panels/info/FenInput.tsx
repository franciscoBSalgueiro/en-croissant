import { ActionIcon, Flex, Stack, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { validateFen } from "chess.js";
import { useContext, useEffect, useState } from "react";
import TreeContext from "../../common/TreeContext";

const EMPTY_POSITION = "8/8/8/8/8/8/8/8 w - - 0 1";

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
      <Flex align="center" gap={10}>
        <form
          style={{ flexGrow: 1 }}
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
        <ActionIcon
          onClick={() => {
            onSubmit(EMPTY_POSITION);
          }}
        >
          <IconTrash />
        </ActionIcon>
      </Flex>
    </Stack>
  );
}

export default FenInput;
