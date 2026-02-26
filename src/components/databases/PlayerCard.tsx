import { Center, Loader, Paper, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import { commands, type Player } from "@/bindings";
import { unwrap } from "@/utils/unwrap";
import PersonalPlayerCard from "../home/PersonalCard";

function PlayerCard({ player, file }: { player: Player; file: string }) {
  const { t } = useTranslation();
  const { data: info, isLoading } = useSWRImmutable(
    ["player-game-info", file, player.id],
    async ([key, file, id]) => {
      const games = await commands.getPlayersGameInfo(file, id);
      return unwrap(games);
    },
  );

  return (
    <>
      {isLoading && (
        <Paper withBorder h="100%">
          <Center h="100%">
            <Stack align="center">
              <Text fw="bold">{t("Databases.Player.ProcessingData")}</Text>
              <Loader />
            </Stack>
          </Center>
        </Paper>
      )}
      {info && (
        <PersonalPlayerCard name={player.name!} info={info} isDatabase />
      )}
    </>
  );
}

export default PlayerCard;
