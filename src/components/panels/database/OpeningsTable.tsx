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
  height,
  loading,
}: {
  openings: Opening[];
  height: number;
  loading: boolean;
}) {
  const { classes } = useStyles();
  const dispatch = useContext(TreeDispatchContext);
  const grandTotal = openings?.reduce(
    (acc, curr) => acc + curr.black + curr.white + curr.draw,
    0
  );

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
            if (move === "*") return <Text fs="italic">Game end</Text>;
            return <Text>{move}</Text>;
          },
        },
        {
          accessor: "total",
          width: 180,
          render: ({ white, draw, black }) => {
            const total = white + draw + black;
            const percentage = (total / grandTotal) * 100;
            return (
              <Group grow>
                <Text>{percentage.toFixed(0)}%</Text>
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
                mt="md"
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
