import { createStyles, Progress, ScrollArea, Table, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { Square } from "chess.js";
import { useCallback, useContext, useEffect, useState } from "react";
import { uciToMove } from "../../../utils/chess";
import { Opening, search_opening } from "../../../utils/db";
import { formatNumber } from "../../../utils/format";
import TreeContext from "../../common/TreeContext";

const useStyles = createStyles((theme) => ({
  clickable: {
    cursor: "pointer",
  },
  whiteLabel: {
    "& .mantine-Progress-label": {
      color: "black",
    },
  },
}));

function DatabasePanel({
  makeMove,
  height,
}: {
  makeMove: (move: { from: Square; to: Square; promotion?: string }) => void;
  height: number;
}) {
  const tree = useContext(TreeContext);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenceDatabase, setReferenceDatabase] = useLocalStorage<
    string | null
  >({
    key: "reference-database",
    defaultValue: null,
  });
  const { classes } = useStyles();

  const useOpening = useCallback(
    (referenceDatabase: string | null, fen: string) => {
      if (!referenceDatabase) return;
      setLoading(true);
      search_opening(referenceDatabase, fen).then((res) => {
        setLoading(false);
        setOpenings(
          res.sort(
            (a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white)
          )
        );
      });
    },
    [tree, referenceDatabase]
  );

  useEffect(() => {
    useOpening(referenceDatabase, tree.fen);
  }, [tree, referenceDatabase]);

  const rows = openings.map((opening) => {
    const { move, white, draw, black } = opening;
    const total = white + draw + black;
    const whitePercent = (white / total) * 100;
    const drawPercent = (draw / total) * 100;
    const blackPercent = (black / total) * 100;
    const chessMove = uciToMove(move, tree.fen);
    if (!chessMove) return null;

    return (
      <tr
        key={move}
        className={classes.clickable}
        onClick={() =>
          makeMove({
            from: chessMove.from as Square,
            to: chessMove.to as Square,
            promotion: chessMove.promotion,
          })
        }
      >
        <td width={50}>
          <Text>{chessMove.san}</Text>
        </td>
        <td width={150}>
          <Text align="right">{formatNumber(total)}</Text>
        </td>
        <td>
          <Progress
            mt="md"
            size="xl"
            radius="xl"
            sections={[
              {
                className: classes.whiteLabel,
                value: whitePercent,
                color: "white",
                label: whitePercent.toFixed(1) + "%",
              },
              {
                value: drawPercent,
                color: "gray",
                label: drawPercent.toFixed(1) + "%",
              },
              {
                value: blackPercent,
                color: "black",
                label: blackPercent.toFixed(1) + "%",
              },
            ]}
          />
        </td>
      </tr>
    );
  });

  return (
    <>
      {loading || openings === null ? (
        <p>Loading...</p>
      ) : (
        <ScrollArea h={height}>
          <Table striped highlightOnHover>
            <thead>
              <tr>
                <th>
                  <Text align="center">Move</Text>
                </th>
                <th>
                  <Text align="center">Total Games</Text>
                </th>
                <th>
                  <Text align="center">White / Draw / Black</Text>
                </th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </Table>
        </ScrollArea>
      )}
    </>
  );
}

export default DatabasePanel;
