import { Group, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { CompleteGame, NormalizedGame } from "../../utils/db";

function GameInfo({
  game,
  setCompleteGame,
}: {
  game: NormalizedGame;
  setCompleteGame?: React.Dispatch<React.SetStateAction<CompleteGame>>;
}) {
  const date = game.date
    ? dayjs(game.date, "YYYY.MM.DD").isValid()
      ? dayjs(game.date, "YYYY.MM.DD").toDate()
      : null
    : null;
  return (
    <Group align="apart" my="sm" mx="md" grow>
      <Stack align="start" spacing={0}>
        <Group noWrap>
          {/* <Avatar src={game.white.image} /> */}
          <div>
            <Text c="dimmed" tt="uppercase" fw="bold">
              White
            </Text>
            <Text weight={500}>{game.white.name || "?"}</Text>
            <Text c="dimmed">{game.white_elo || "Unknown ELO"}</Text>
          </div>
        </Group>
      </Stack>
      <Stack align="center" justify="end" spacing={0}>
        <Text>{game.result}</Text>
        {/* <Text>{outcome.replaceAll("1/2", "½")}</Text> */}
        <DateInput
          variant="unstyled"
          valueFormat="YYYY.MM.DD"
          placeholder="????.??.??"
          value={date}
          allowDeselect
          disabled={!setCompleteGame}
          onChange={(date) => {
            setCompleteGame &&
              setCompleteGame((prev) => ({
                ...prev,
                game: {
                  ...prev.game,
                  date: dayjs(date, "YYYY.MM.DD").isValid()
                    ? dayjs(date, "YYYY.MM.DD").format("YYYY.MM.DD")
                    : undefined,
                },
              }));
          }}
          sx={{
            "& input": { textAlign: "center" },
            "& input:disabled": {
              cursor: "default",
              backgroundColor: "transparent",
            },
          }}
        />
      </Stack>
      <Stack align="end" spacing={0}>
        <Group noWrap>
          <div>
            <Text c="dimmed" align="right" tt="uppercase" fw="bold">
              Black
            </Text>
            <Text weight={500} align="right">
              {game.black.name || "?"}
            </Text>
            <Text c="dimmed" align="right">
              {game.black_elo || "Unknown ELO"}
            </Text>
          </div>
          {/* <Avatar src={black.image} /> */}
        </Group>
      </Stack>
    </Group>
  );
}

export default GameInfo;
