import { ANNOTATION_INFO } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { arrayEquals, skipWhile, takeWhile } from "@/utils/helperFunctions";
import { formatScore } from "@/utils/score";
import { ListNode, TreeNode, treeIteratorMainLine } from "@/utils/treeReducer";
import { AreaChart } from "@mantine/charts";
import {
  Box,
  LoadingOverlay,
  Paper,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { Stack } from "@mantine/core";
import { useContext } from "react";
import { CategoricalChartState } from "recharts/types/chart/generateCategoricalChart";
import * as classes from "./EvalChart.css";
import { TreeDispatchContext, TreeStateContext } from "./TreeStateContext";

interface EvalChartProps {
  isAnalysing: boolean;
  startAnalysis: () => void;
}

type DataPoint = {
  name: string;
  evalText: string;
  yValue: number | "none";
  movePath: number[];
  color: string;
};

const EvalChart = (props: EvalChartProps) => {
  const { root, position } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const theme = useMantineTheme();

  function getYValue(node: TreeNode): number | undefined {
    if (node.score) {
      let cp: number = node.score.value;
      if (node.score.type == "mate") {
        cp = node.score.value > 0 ? Infinity : -Infinity;
      }
      return 2 / (1 + Math.exp(-0.004 * cp)) - 1;
    } else if (node.children.length == 0) {
      const [pos, error] = positionFromFen(node.fen);
      if (pos) {
        if (pos.isCheckmate()) {
          return node.move!.color == "w" ? 1 : -1;
        } else if (pos.isStalemate()) {
          return 0;
        }
      }
    }
  }

  function getEvalText(node: TreeNode): string {
    if (node.score) {
      return `Advantage: ${formatScore(node.score)}`;
    } else if (node.children.length == 0) {
      const [pos, error] = positionFromFen(node.fen);
      if (pos) {
        if (pos.isCheckmate()) return "Checkmate";
        else if (pos.isStalemate()) return "Stalemate";
      }
    }
    return "Not analysed";
  }

  function getNodes(): ListNode[] {
    const allNodes = treeIteratorMainLine(root);
    const withoutRoot = skipWhile(
      allNodes,
      (node: ListNode) => node.position.length == 0,
    );
    const withMoves = takeWhile(
      withoutRoot,
      (node: ListNode) => node.node.move != undefined,
    );
    return [...withMoves];
  }

  function* getData(): Iterable<DataPoint> {
    const nodes = getNodes();
    for (let i = 0; i < nodes.length; i++) {
      const currentNode = nodes[i];
      const move = currentNode.node.move!;
      const yValue = getYValue(currentNode.node);

      yield {
        name: `${Math.ceil(currentNode.node.halfMoves / 2)}.${
          move.color === "w" ? "" : ".."
        } ${move.san}${currentNode.node.annotation}`,
        evalText: getEvalText(currentNode.node),
        yValue: yValue ?? "none",
        movePath: currentNode.position,
        color: ANNOTATION_INFO[currentNode.node.annotation]?.color,
      };
    }
  }

  function gradientOffset(data: DataPoint[]) {
    const dataMax = Math.max(
      ...data.map((i) => (i.yValue !== "none" ? i.yValue : 0)),
    );
    const dataMin = Math.min(
      ...data.map((i) => (i.yValue !== "none" ? i.yValue : 0)),
    );

    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;

    return dataMax / (dataMax - dataMin);
  }

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload: any;
  }) => {
    if (active && payload && payload.length && payload[0].payload) {
      const dataPoint: DataPoint = payload[0].payload;
      return (
        <Paper px="md" py="sm" withBorder shadow="md" radius="md">
          <Text
            className={classes.tooltipTitle}
            c={dataPoint.color === "gray" ? undefined : dataPoint.color}
          >
            {dataPoint.name}
          </Text>
          <Text>{dataPoint.evalText}</Text>
        </Paper>
      );
    }
    return null;
  };

  const onChartClick = (data: CategoricalChartState) => {
    if (
      data &&
      data.activePayload &&
      data.activePayload.length &&
      data.activePayload[0].payload
    ) {
      const dataPoint: DataPoint = data.activePayload[0].payload;
      dispatch({
        type: "GO_TO_MOVE",
        payload: dataPoint.movePath,
      });
    }
  };

  const data = [...getData()];
  const currentPositionName = data.find((point) =>
    arrayEquals(point.movePath, position),
  )?.name;
  const colouroffset = gradientOffset(data);

  return (
    <Stack>
      <Box pos="relative">
        <LoadingOverlay visible={props.isAnalysing == true} />
        <AreaChart
          h={150}
          curveType="monotone"
          data={data}
          dataKey={"name"}
          series={[
            { name: "yValue", color: theme.colors[theme.primaryColor][7] },
          ]}
          connectNulls={false}
          withXAxis={false}
          withYAxis={false}
          yAxisProps={{ domain: [-1, 1] }}
          type="split"
          fillOpacity={0.8}
          splitColors={["gray.1", "black"]}
          splitOffset={colouroffset}
          activeDotProps={{ r: 3, strokeWidth: 1 }}
          dotProps={{ r: 0 }}
          referenceLines={[
            {
              x: currentPositionName,
              color: theme.colors[theme.primaryColor][7],
            },
          ]}
          areaChartProps={{
            onClick: onChartClick,
            style: { cursor: "pointer" },
          }}
          gridAxis="none"
          tooltipProps={{
            content: ({ payload, active }) => (
              <CustomTooltip active={active} payload={payload} />
            ),
          }}
        />
      </Box>
    </Stack>
  );
};

export default EvalChart;
