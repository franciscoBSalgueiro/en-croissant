import { useLocalStorage } from "@mantine/hooks";
import { useCallback, useContext, useEffect, useState } from "react";
import { Opening, search_opening } from "../../utils/db";
import TreeContext from "../common/TreeContext";

function DatabasePanel() {
  const tree = useContext(TreeContext);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenceDatabase, setReferenceDatabase] = useLocalStorage<
    string | null
  >({
    key: "reference-database",
    defaultValue: null,
  });

  const useOpening = useCallback(
    (referenceDatabase: string | null, fen: string) => {
      console.log("useOpening", referenceDatabase, fen);
      if (!referenceDatabase) return;
      setLoading(true);
      search_opening(referenceDatabase, fen).then((res) => {
        console.log(res);
        setLoading(false);
        setOpenings(res);
      });
    },
    [tree, referenceDatabase]
  );

  useEffect(() => {
    useOpening(referenceDatabase, tree.fen);
  }, [tree, referenceDatabase]);

  return (
    <>
      {loading || openings === null ? (
        <p>Loading...</p>
      ) : (
        openings.map((opening) => (
          <div key={opening.move}>
            <h3>{opening.move}</h3>
            <p>{opening.white}</p>
            <p>{opening.draw}</p>
            <p>{opening.black}</p>
          </div>
        ))
      )}
    </>
  );
}

export default DatabasePanel;
