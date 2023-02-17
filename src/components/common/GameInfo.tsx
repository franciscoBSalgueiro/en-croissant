import { Group, Stack, Text } from "@mantine/core";
import { NormalizedGame } from "../../utils/db";

function GameInfo({ game }: { game: NormalizedGame }) {
  return (
    <Group align="apart" my="sm" mx="md" grow>
      <Stack align="start" spacing={0}>
        <Group noWrap>
          {/* <Avatar src={game.white.image} /> */}
          <div>
            <Text weight={500}>{game.white.name}</Text>
            <Text c="dimmed">{game.white_elo}</Text>
          </div>
        </Group>
      </Stack>
      <Stack align="center" justify="end" spacing={0}>
        <Text>{game.result}</Text>
        {/* <Text>{outcome.replaceAll("1/2", "½")}</Text> */}
        <Text c="dimmed">{game.date}</Text>
      </Stack>
      <Stack align="end" spacing={0}>
        <Group noWrap>
          <div>
            <Text weight={500} align="right">
              {game.black.name}
            </Text>
            <Text c="dimmed" align="right">
              {game.black_elo}
            </Text>
          </div>
          {/* <Avatar src={black.image} /> */}
        </Group>
      </Stack>
    </Group>
  );
}

export default GameInfo;
