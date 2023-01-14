import { Divider, Paper, Stack } from "@mantine/core";
import { Game, Player } from "../../utils/db";
import GameInfo from "../common/GameInfo";
import GamePreview from "./GamePreview";

function GameCard({ game }: { game: [Game, Player, Player] }) {
  return (
    <Paper shadow="sm" p="sm" my="md" withBorder>
      <Stack>
        <GameInfo
          white={game[1]}
          white_rating={game[0].white_rating}
          black={game[2]}
          black_rating={game[0].black_rating}
          date={game[0].date}
          outcome={game[0].outcome}
        />
        <Divider mb="sm" />
        <GamePreview pgn={game[0].moves} />
      </Stack>
    </Paper>
  );
}

export default GameCard;
