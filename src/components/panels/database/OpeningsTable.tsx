import { TreeStateContext } from "@/components/common/TreeStateContext";
import { moveNotationTypeAtom } from "@/state/atoms";
import { addPieceSymbol } from "@/utils/annotation";
import type { Opening } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import { Group, Progress, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo, useContext } from "react";
import { useStore } from "zustand";

function OpeningsTable({
  openings,
  loading,
}: {
  openings: Opening[];
  loading: boolean;
}) {
  const store = useContext(TreeStateContext)!;
  const makeMove = useStore(store, (s) => s.makeMove);
  const [moveNotationType] = useAtom(moveNotationTypeAtom);

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
      withTableBorder
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
            if (move === "*")
              return (
                <Text fz="sm" fs="italic">
                  Game end
                </Text>
              );
            return (
              <Text fz="sm">
                {moveNotationType === "symbols" ? addPieceSymbol(move) : move}
              </Text>
            );
          },
        },
        {
          accessor: "total",
          width: 180,
          render: ({ move, white, draw, black }) => {
            const total = white + draw + black;
            const percentage = (total / grandTotal) * 100;
            return (
              <Group>
                {move !== "Total" && (
                  <Text fz="sm">{percentage.toFixed(0)}%</Text>
                )}
                <Text fz="sm" flex={1} ta="right">
                  {formatNumber(total)}
                </Text>
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
              <Progress.Root size="xl">
                <Progress.Section value={whitePercent} color="white">
                  <Progress.Label c="black">
                    {whitePercent > 10 ? `${whitePercent.toFixed(1)}%` : ""}
                  </Progress.Label>
                </Progress.Section>
                <Progress.Section value={drawPercent} color="gray">
                  <Progress.Label>
                    {drawPercent > 10 ? `${drawPercent.toFixed(1)}%` : ""}
                  </Progress.Label>
                </Progress.Section>
                <Progress.Section value={blackPercent} color="black">
                  <Progress.Label>
                    {blackPercent > 10 ? `${blackPercent.toFixed(1)}%` : ""}
                  </Progress.Label>
                </Progress.Section>
              </Progress.Root>
            );
          },
        },
      ]}
      idAccessor="move"
      emptyState={"No games found"}
      onRowClick={({ record }) => makeMove({ payload: record.move })}
    />
  );
}

export default memo(OpeningsTable);
