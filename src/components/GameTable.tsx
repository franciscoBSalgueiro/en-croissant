import { Table } from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { useEffect, useState } from "react";

interface Player {
  name: string;
  rating: number;
}

interface Game {
  id: string;
  white: Player;
  black: Player;
  date: string;
  speed: string;
  winner: string;
  moves: string;
  fen: string;
}

function GameTable({ file }: { file: string }) {
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    invoke("get_games", {
      file,
      query: {
        limit: 20,
        offset: 0,
      },
    }).then((res) => setGames(res as Game[]));
  }, []);

  return (
    <Table>
      <thead>
        <tr>
          <th>White</th>
          <th>Black</th>
          <th>Winner</th>
          <th>Date</th>
          <th>Speed</th>
        </tr>
      </thead>
      <tbody>
        {games.map((game) => (
          <tr key={game.id}>
            <td>{game.white.name}</td>
            <td>{game.black.name}</td>
            <td>{game.winner}</td>
            <td>{game.date}</td>
            <td>{game.speed}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default GameTable;
