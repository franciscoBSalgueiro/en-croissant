import { useEffect, useState } from "react";
import { getPlayersGameInfo, Player, PlayerGameInfo } from "@/utils/db";
import PersonalPlayerCard from "../home/PersonalCard";
import { Loader } from "@mantine/core";

function fillMissingMonths(data: { name: string; games: number }[]) {
  if (data.length === 0) return data;
  const startDate = new Date(data[0].name + "-01");
  const endDate = new Date(data[data.length - 1].name + "-01");
  const months = [];
  const currDate = startDate;

  while (currDate <= endDate) {
    months.push(currDate.toISOString().slice(0, 7));
    currDate.setMonth(currDate.getMonth() + 1);
  }

  const newData = months.map((month) => {
    const foundMonth = data.find((obj) => obj.name === month);
    if (foundMonth) {
      return foundMonth;
    } else {
      return { name: month, games: 0 };
    }
  });

  if (newData.length > 36) {
    // group by year in the same format
    const grouped = newData.reduce((acc, curr) => {
      const year = curr.name.slice(0, 4);
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(curr);
      return acc;
    }, {} as { [key: string]: { name: string; games: number }[] });

    // sum up the games per year
    const summed = Object.entries(grouped).map(([year, months]) => {
      const games = months.reduce((acc, curr) => acc + curr.games, 0);
      return { name: year, games };
    });

    return summed;
  }

  return newData;
}

function PlayerCard({ player, file }: { player: Player; file: string }) {
  const [info, setInfo] = useState<PlayerGameInfo | null>(null);

  useEffect(() => {
    async function fetchGames() {
      const games = await getPlayersGameInfo(file, player.id);
      setInfo(games);
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
