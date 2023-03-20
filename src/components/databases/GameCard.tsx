import { Divider, Paper, Stack } from "@mantine/core";
import { NormalizedGame } from "../../utils/db";
import GameInfo from "../common/GameInfo";
import GamePreview from "./GamePreview";

function GameCard({ game }: { game: NormalizedGame }) {
  return (
    <Paper shadow="sm" p="sm" withBorder>
      <Stack>
        <GameInfo game={game} />
        <Divider mb="sm" />
        <GamePreview pgn={game.moves} />
      </Stack>
    </Paper>
  );
}

export default GameCard;
