import { createStyles, Progress, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { Square } from "chess.js";
import { DataTable } from "mantine-datatable";
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
      if (tree.half_moves >= 10) {
        setOpenings([]);
        return;
      }
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

  return (
    <DataTable
      withBorder
      highlightOnHover
      height={height}
      records={openings}
      fetching={loading || openings === null}
      columns={[
        {
          accessor: "move",
          width: 100,
          render: ({ move }) => {
            const chessMove = uciToMove(move, tree.fen);
            if (!chessMove) return null;
            return <Text>{chessMove.san}</Text>;
          },
        },
        {
          accessor: "total",
          width: 100,
          textAlignment: "right",
          render: ({ white, draw, black }) => {
            const total = white + draw + black;
            return formatNumber(total);
          },
        },
        {
          accessor: "results",
          render: ({ black, white, draw }) => {
            const total = white + draw + black;
            const whitePercent = (white / total) * 100;
            const drawPercent = (draw / total) * 100;
            const blackPercent = (black / total) * 100;
            return (
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
            );
          },
        },
      ]}
      noRecordsText="No openings found"
      onRowClick={({ move }) => {
        const chessMove = uciToMove(move, tree.fen);
        if (!chessMove) return;
        makeMove({
          from: chessMove.from as Square,
          to: chessMove.to as Square,
          promotion: chessMove.promotion,
        });
      }}
    />
  );
}

export default DatabasePanel;
