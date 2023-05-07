import { ActionIcon, Flex, Stack, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { validateFen } from "chess.js";
import { memo, useContext, useEffect, useState } from "react";
import { getNodeAtPath } from "../../../utils/treeReducer";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../../common/TreeStateContext";

const EMPTY_POSITION = "8/8/8/8/8/8/8/8 w - - 0 1";

function FenInput() {
  const { root, position } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const currentNode = getNodeAtPath(root, position);
  if (!currentNode) {
    return null;
  }
  const [fen, setFen] = useState(currentNode?.fen);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setFen(currentNode.fen);
  }, [currentNode?.fen]);

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
              dispatch({ type: "SET_FEN", payload: fen });
              setError(undefined);
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
            dispatch({ type: "SET_FEN", payload: EMPTY_POSITION });
          }}
        >
          <IconTrash />
        </ActionIcon>
      </Flex>
    </Stack>
  );
}

export default memo(FenInput);
