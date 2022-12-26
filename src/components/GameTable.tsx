import { LoadingOverlay, Select, Table, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { Game, Outcome, query_games, Speed } from "../utils/db";
import { SearchInput } from "./SearchInput";

function GameTable({ file }: { file: string }) {
  const [games, setGames] = useState<Game[]>([]);
  const [white, setWhite] = useState("");
  const [black, setBlack] = useState("");
  const [speed, setSpeed] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    query_games(file, {
      white: white === "" ? undefined : white,
      black: black === "" ? undefined : black,
      speed: speed === null ? undefined : (speed as Speed),
      outcome: outcome === null ? undefined : (outcome as Outcome),
      limit: 10,
      offset: 0,
    }).then((res) => {
      setLoading(false);
      setGames(res);
    });
  }, [white, black, speed, outcome]);

  const rows =
    games.length === 0 ? (
      <tr>
        <td colSpan={5}>
          <Text weight={500} align="center" p={20}>
            No games found
          </Text>
        </td>
      </tr>
    ) : (
      games.map((game) => (
        <tr key={game.id}>
          <td>{game.white.name}</td>
          <td>{game.outcome}</td>
          <td>{game.black.name}</td>
          <td>{game.date}</td>
          <td>{game.speed}</td>
        </tr>
      ))
    );

  return (
    <>
      <SearchInput
        value={white}
        setValue={setWhite}
        label="White"
        file={file}
      />
      <SearchInput
        value={black}
        setValue={setBlack}
        label="Black"
        file={file}
      />
      <Select
        label="Speed"
        value={speed}
        onChange={setSpeed}
        placeholder="Select speed"
        data={[
          { label: Speed.UltraBullet, value: Speed.UltraBullet },
          { label: Speed.Bullet, value: Speed.Bullet },
          { label: Speed.Blitz, value: Speed.Blitz },
          { label: Speed.Rapid, value: Speed.Rapid },
          { label: Speed.Classical, value: Speed.Classical },
          { label: Speed.Correspondence, value: Speed.Correspondence },
        ]}
      />
      <Select
        label="Result"
        value={outcome}
        onChange={setOutcome}
        placeholder="Select result"
        data={[
          { label: "White wins", value: Outcome.WhiteWin },
          { label: "Black wins", value: Outcome.BlackWin },
          { label: "Draw", value: Outcome.Draw },
        ]}
      />
      <Table highlightOnHover>
        <thead>
          <tr>
            <th>White</th>
            <th>Result</th>
            <th>Black</th>
            <th>Date</th>
            <th>Speed</th>
          </tr>
        </thead>
        <tbody style={{ position: "relative" }}>
          <>
            {rows}
            <LoadingOverlay visible={loading} />
          </>
        </tbody>
      </Table>
    </>
  );
}

export default GameTable;
