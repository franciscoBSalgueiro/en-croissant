import { useLocalStorage } from "@mantine/hooks";
import { useCallback, useContext, useEffect, useState } from "react";
import { NormalizedGame } from "../../utils/db";
import TreeContext from "../common/TreeContext";
import GameSubTable from "../databases/GameSubTable";

function DatabasePanel() {
  const tree = useContext(TreeContext);
  const [games, setGames] = useState<NormalizedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenceDatabase, setReferenceDatabase] = useLocalStorage<
    string | null
  >({
    key: "reference-database",
    defaultValue: null,
  });

  const useOpening = useCallback(
    (referenceDatabase: string | null, pgn: string) => {
      console.log("useOpening", referenceDatabase, pgn);
      if (!referenceDatabase) return;
      setLoading(true);
      // searchOpening(referenceDatabase, pgn).then((res) => {
      //   console.log("settings Games", res);
      //   setLoading(false);
      //   setGames(res);
      // });
    },
    [tree, referenceDatabase]
  );

  useEffect(() => {
    useOpening(referenceDatabase, tree.getTopVariation().getPGN());
  }, [tree, referenceDatabase]);

  return (
    <>
      <GameSubTable
        height={300}
        games={games}
        loading={loading}
        selectedGame={null}
        setSelectedGame={() => {}}
      />
    </>
  );
}

export default DatabasePanel;
