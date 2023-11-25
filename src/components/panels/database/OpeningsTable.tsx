import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { Opening } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import { Group, Progress, Text, createStyles } from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { useContext, memo } from "react";

const useStyles = createStyles(() => ({
  clickable: {
    cursor: "pointer",
  },
  whiteLabel: {
    "& .mantine-Progress-label": {
      color: "black",
    },
  },
}));

function OpeningsTable({
  openings,
  loading,
}: {
  openings: Opening[];
  loading: boolean;
}) {
  const { classes } = useStyles();
  const dispatch = useContext(TreeDispatchContext);

  const whiteTotal = openings?.reduce((acc, curr) => acc + curr.white, 0);
  const blackTotal = openings?.reduce((acc, curr) => acc + curr.black, 0);
  const drawTotal = openings?.reduce((acc, curr) => acc + curr.draw, 0);
  const grandTotal = whiteTotal + blackTotal + drawTotal;

  if (openings.length > 0) {
    openings = [
      ...openings,
      {
        move: "Total",
        white: whiteTotal,
        black: blackTotal,
        draw: drawTotal,
      },
    ];
  }

  return (
    <DataTable
      withBorder
      highlightOnHover
      records={openings}
      fetching={loading || openings === null}
      rowStyle={(game, i) => {
        if (i === openings.length - 1)
          return {
            fontWeight: 700,
            position: "sticky",
            bottom: 0,
            zIndex: 10,
          };
        return {};
      }}
      columns={[
        {
          accessor: "move",
          width: 100,
          render: ({ move }) => {
            if (move === "*") return <Text fs="italic">Game end</Text>;
            return <Text>{move}</Text>;
          },
        },
        {
          accessor: "total",
          width: 180,
          render: ({ move, white, draw, black }) => {
            const total = white + draw + black;
            const percentage = (total / grandTotal) * 100;
            return (
              <Group grow>
                {move !== "Total" && <Text>{percentage.toFixed(0)}%</Text>}
                <Text align="right">{formatNumber(total)}</Text>
              </Group>
            );
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
                size="xl"
                radius="xl"
                animate={false}
                sections={[
                  {
                    className: classes.whiteLabel,
                    value: whitePercent,
                    color: "white",
                    label:
                      whitePercent > 5 ? whitePercent.toFixed(1) + "%" : "",
                  },
                  {
                    value: drawPercent,
                    color: "gray",
                    label: drawPercent > 5 ? drawPercent.toFixed(1) + "%" : "",
                  },
                  {
                    value: blackPercent,
                    color: "black",
                    label:
                      blackPercent > 5 ? blackPercent.toFixed(1) + "%" : "",
                  },
                ]}
              />
            );
          },
        },
      ]}
      idAccessor="move"
      emptyState={"No games found"}
      onRowClick={({ move }) => {
        dispatch({
          type: "MAKE_MOVE",
          payload: move,
        });
      }}
    />
  );
}

export default memo(OpeningsTable);
