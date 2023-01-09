import { Avatar, Group, Stack, Text } from "@mantine/core";
import { Player } from "../../utils/db";

interface GameInfoProps {
  white: Player;
  white_rating: number;
  black: Player;
  black_rating: number;
  date: string;
  outcome: string;
}

function GameInfo({
  white,
  white_rating,
  black,
  black_rating,
  date,
  outcome,
}: GameInfoProps) {
  return (
    <Group align="apart" my="sm" mx="md" grow>
      <Stack align="start" spacing={0}>
        <Group noWrap>
          <Avatar src={white.image} />
          <div>
            <Text weight={500}>{white.name}</Text>
            <Text c="dimmed">{white_rating}</Text>
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
              {black.name}
            </Text>
            <Text c="dimmed" align="right">
              {black_rating}
            </Text>
          </div>
          <Avatar src={black.image} />
        </Group>
      </Stack>
    </Group>
  );
}

export default GameInfo;
