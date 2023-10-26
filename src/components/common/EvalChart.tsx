import { useContext } from "react";
import { TreeDispatchContext, TreeStateContext } from "./TreeStateContext";
import { Box, LoadingOverlay, useMantineColorScheme } from "@mantine/core";
import { ActionIcon, Divider, Group, Stack, Tooltip as MantineTooltip, Text } from "@mantine/core"
import { ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, ReferenceLine } from "recharts";
import { ListNode, treeIteratorMainLine } from "@/utils/treeReducer";
import { ANNOTATION_INFO } from "@/utils/chess";
import { formatScore } from "@/utils/score";
import { Score } from "@/bindings";
import { arrayEquals, skipWhile, takeWhile } from "@/utils/helperFunctions";
import { IconRefresh } from "@tabler/icons-react"

interface EvalChartProps {
    isAnalysing?: boolean;
    startAnalysis?(): void;
}

type DataPoint = {
    name: string;
    evalText: string;
    yValue: number | undefined;
    altValue: number | undefined;
    movePath: number[];
}

const EvalChart = (props: EvalChartProps) => {
    const { root, position } = useContext(TreeStateContext);
    const dispatch = useContext(TreeDispatchContext);
    const { colorScheme } = useMantineColorScheme();

    function getYValue(score: Score | null): number | undefined {
        if (score) {
            let cp: number = score.value;
            if (score.type == "mate") {
                cp = score.value > 0 ? Infinity : -Infinity;
            }
            return 2 / (1 + Math.exp(-0.004 * cp)) - 1;
        }
    }

    function getNodes(): ListNode[] {
        const allNodes = treeIteratorMainLine(root);
        const withoutRoot = skipWhile(allNodes, (node: ListNode) => node.position.length == 0);
        const withMoves = takeWhile(withoutRoot, (node: ListNode) => node.node.move != undefined);
        return [...withMoves];
    }

    function* getData(): Iterable<DataPoint> {
        const nodes = getNodes();
        for (let i = 0; i < nodes.length; i++) {
            const prevNode = nodes[i-1]?.node;
            const currentNode = nodes[i];
            const nextNode = nodes[i+1]?.node;
            const node = currentNode.node;

            const move = node.move!;
            const annotation = node.annotation ? ANNOTATION_INFO[node.annotation].name.toLowerCase() : undefined;
            const yValue = getYValue(node.score);
            const isAnalysed = yValue != undefined;
            //hiding gaps in chart areas between analysed and unanalysed positions
            const needsAltValue = !isAnalysed ||
                (prevNode && !prevNode.score) ||
                (nextNode && !nextNode.score);
            yield {
                name: `${Math.floor(node.halfMoves / 2) + 1}.${move.color === 'w' ? '' : '..'} ${move.san}${annotation ? ` (${annotation})` : ''}`,
                evalText: isAnalysed ? `Advantage: ${formatScore(node.score!)}` : "Not analysed",
                yValue: yValue,
                altValue: needsAltValue ? 0 : undefined,
                movePath: currentNode.position
            }
        }
    }

    function gradientOffset(data: DataPoint[]) {
        const dataMax = Math.max(...data.map((i) => i.yValue ?? 0));
        const dataMin = Math.min(...data.map((i) => i.yValue ?? 0));
        
        if (dataMax <= 0) return 0;
        if (dataMin >= 0) return 1;
        
        return dataMax / (dataMax - dataMin);
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length && payload[0].payload) {
            const dataPoint: DataPoint = payload[0].payload;
            const containerStyle: React.CSSProperties = {
                margin: 0,
                padding: 5,
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                whiteSpace: 'nowrap'
            };
            return (
                <div style={containerStyle}>
                    <div style={{"fontWeight": "bold"}}>{dataPoint.name}</div>
                    <div>{dataPoint.evalText}</div>
                </div>
            );
        }
        return null;
    };

    const onChartClick = (data: any) => {
        if (data && data.activePayload && data.activePayload.length && data.activePayload[0].payload) {
            const dataPoint: DataPoint = data.activePayload[0].payload;
            dispatch({
                type: "GO_TO_MOVE",
                payload: dataPoint.movePath,
            });
        }
    }

    const data = [...getData()];
    const currentPositionName = data.find(point => arrayEquals(point.movePath, position))?.name;
    const colouroffset = gradientOffset(data);
    const areaChartPropsHack = { cursor: "pointer" } as any;
    
    return (
        <Stack>
            <Stack>
                <Group position="apart">
                    <Text fz="sm">Engine analysis</Text>
                    <Group spacing="sm">
                        {props.startAnalysis != undefined &&
                            <MantineTooltip label="Analyse game">
                                <ActionIcon onClick={props.startAnalysis} disabled={props.isAnalysing}>
                                    <IconRefresh size={15} /> 
                                </ActionIcon>
                            </MantineTooltip>
                        }
                    </Group>
                </Group>
                <Divider />
            </Stack>
            <Box pos="relative">
                <LoadingOverlay visible={props.isAnalysing == true} />
                <ResponsiveContainer width="99%" height={220}>
                    <AreaChart data={data} onClick={onChartClick} {...areaChartPropsHack}>
                        <RechartsTooltip content={<CustomTooltip />} />
                        <XAxis hide dataKey="name" type="category" />
                        <YAxis hide dataKey="yValue" domain={[-1, 1]} />
                        <defs>
                            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={colouroffset} stopColor={colorScheme == 'light' ? '#e6e6e6' : '#ccc'} stopOpacity={1} />
                                <stop offset={colouroffset} stopColor={colorScheme == 'light' ? '#333333' : '#000'} stopOpacity={1} />
                            </linearGradient>
                        </defs>
                        {currentPositionName &&
                            <ReferenceLine x={currentPositionName} stroke="#ff9933" />
                        }
                        <Area type="linear" dataKey="yValue" stroke="#ff9933" fill="url(#splitColor)" />
                        <Area type="linear" dataKey="altValue" stroke="#999999" strokeDasharray="3 3" activeDot={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>
        </Stack>
    )
}

export default EvalChart;