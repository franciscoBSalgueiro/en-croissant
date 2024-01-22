import { commands } from "@/bindings";
import { Player, PlayerGameInfo } from "@/utils/db";
import { unwrap } from "@/utils/invoke";
import { Loader } from "@mantine/core";
import { useEffect, useState } from "react";
import PersonalPlayerCard from "../home/PersonalCard";

function PlayerCard({ player, file }: { player: Player; file: string }) {
  const [info, setInfo] = useState<PlayerGameInfo | null>(null);

  useEffect(() => {
    async function fetchGames() {
      const games = await commands.getPlayersGameInfo(file, player.id);
      setInfo(unwrap(games));
    }
    fetchGames();
  }, [file, player]);

  return (
    <>
      {info ? (
        <PersonalPlayerCard name={player.name} info={info} />
      ) : (
        <Loader />
      )}
    </>
  );
}

export default PlayerCard;
