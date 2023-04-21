import { ActionIcon, Flex, Stack, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { validateFen } from "chess.js";
import { useContext, useEffect, useState } from "react";
import { CompleteGame } from "../../../utils/db";
import GameContext from "../../common/GameContext";

const EMPTY_POSITION = "8/8/8/8/8/8/8/8 w - - 0 1";

function FenInput({
  setCompleteGame,
}: {
  setCompleteGame: React.Dispatch<React.SetStateAction<CompleteGame>>;
}) {
  function changeFen(fen: string) {
    setCompleteGame((game) => ({
      ...game,
      game: {
        ...game.game,
        fen,
      },
    }));
  }

  const tree = useContext(GameContext).game.tree;
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
              changeFen(fen);
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
            changeFen(EMPTY_POSITION);
          }}
        >
          <IconTrash />
        </ActionIcon>
      </Flex>
    </Stack>
  );
}

export default FenInput;
