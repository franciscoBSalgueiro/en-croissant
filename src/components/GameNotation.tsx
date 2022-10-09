import { Button, Paper, SimpleGrid } from "@mantine/core";
import { Chess } from "chess.ts";

function GameNotation({
  moves,
  setChess,
}: {
  moves: Chess[];
  setChess: (move: Chess) => void;
}) {
  return (
    <Paper withBorder p="md">
      <SimpleGrid cols={2}>
        {moves.map((chess) => (
          <MoveCell move={chess} />
        ))}
      </SimpleGrid>
    </Paper>
  );

  function MoveCell({ move }: { move: Chess }) {
    return (
      <Button
        variant="subtle"
        onClick={() => {
          setChess(move);
        }}
      >
        {move.history().pop()}
      </Button>
    );
  }
}

export default GameNotation;
