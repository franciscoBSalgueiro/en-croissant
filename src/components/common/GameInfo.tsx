import { Avatar, Group, Stack, Text } from "@mantine/core";
import { Player } from "../../utils/db";

interface GameInfoProps {
  player1: Player;
  player2: Player;
  date: string;
  outcome: string;
}

function GameInfo({ player1, player2, date, outcome }: GameInfoProps) {
  return (
    <Group align="apart" my="sm" mx="md" grow>
      <Stack align="start" spacing={0}>
        <Group noWrap>
          <Avatar src={player1.image} />
          <div>
            <Text weight={500}>{player1.name}</Text>
            <Text c="dimmed">{player1.rating}</Text>
          </div>
        </Group>
      </Stack>
      <Stack align="center" justify="end" spacing={0}>
        <Text>{outcome}</Text>
        {/* <Text>{outcome.replaceAll("1/2", "½")}</Text> */}
        <Text c="dimmed">{date}</Text>
      </Stack>
      <Stack align="end" spacing={0}>
        <Group noWrap>
          <div>
            <Text weight={500} align="right">
              {player2.name}
            </Text>
            <Text c="dimmed" align="right">
              {player2.rating}
            </Text>
          </div>
          <Avatar src={player2.image} />
        </Group>
      </Stack>
    </Group>
  );
}

export default GameInfo;
