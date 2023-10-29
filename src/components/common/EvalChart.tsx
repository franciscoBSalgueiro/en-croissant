import { useContext } from "react";
import { TreeDispatchContext, TreeStateContext } from "./TreeStateContext";
import { Box, LoadingOverlay, createStyles } from "@mantine/core";
import { ActionIcon, Divider, Group, Stack, Tooltip as MantineTooltip, Text } from "@mantine/core"
import { ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, ReferenceLine } from "recharts";
import { ListNode, TreeNode, treeIteratorMainLine } from "@/utils/treeReducer";
import { ANNOTATION_INFO } from "@/utils/chess";
import { formatScore } from "@/utils/score";
import { arrayEquals, skipWhile, takeWhile } from "@/utils/helperFunctions";
import { IconRefresh } from "@tabler/icons-react"
import { Chess } from "chess.js";

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

const useStyles = createStyles(theme => ({
    tooltip: {
        margin: 0,
        padding: 5,
        backgroundColor: theme.colorScheme === 'light' ? 'white' : theme.colors.dark[3],
        color: theme.colorScheme === 'light' ? 'black': 'white',
        opacity: 0.8,
        border: '1px solid #ccc',
        whiteSpace: 'nowrap',
    },
    tooltipTitle: {
        fontWeight: 'bold'
    }
}));

const EvalChart = (props: EvalChartProps) => {
    const { root, position } = useContext(TreeStateContext);
    const dispatch = useContext(TreeDispatchContext);
    const { classes, theme } = useStyles();
    const isLightTheme = theme.colorScheme == 'light';

    function getYValue(node: TreeNode): number | undefined {
        if (node.score) {
            let cp: number = node.score.value;
            if (node.score.type == "mate") {
                cp = node.score.value > 0 ? Infinity : -Infinity;
            }
            return 2 / (1 + Math.exp(-0.004 * cp)) - 1;
        } else if (node.children.length == 0) {
            try {
                const chess = new Chess(node.fen);
                if (chess.isCheckmate()) {
                    return node.move!.color == 'w' ? 1 : -1;
                } else if (chess.isDraw() || chess.isStalemate()) {
                    return 0;
                }
            } catch (error) {}
        }
    }

    function getEvalText(node: TreeNode): string {
        if (node.score) {
            return `Advantage: ${formatScore(node.score)}`;
        } else if (node.children.length == 0) {
            try {
                const chess = new Chess(node.fen);
                if (chess.isCheckmate()) return "Checkmate";
                else if (chess.isStalemate()) return "Stalemate";
                else if (chess.isDraw()) return "Draw";
            } catch (error) {}
        }
        return 'Not analysed';
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

            const move = currentNode.node.move!;
            const annotation = currentNode.node.annotation ? ANNOTATION_INFO[currentNode.node.annotation].name.toLowerCase() : undefined;
            const yValue = getYValue(currentNode.node);
            //hiding gaps in chart areas between analysed and unanalysed positions
            const needsAltValue = yValue == undefined ||
                (prevNode && !prevNode.score) ||
                (nextNode && !nextNode.score);
            yield {
                name: `${Math.ceil(currentNode.node.halfMoves / 2)}.${move.color === 'w' ? '' : '..'} ${move.san}${annotation ? ` (${annotation})` : ''}`,
                evalText: getEvalText(currentNode.node),
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
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length && payload[0].payload) {
            const dataPoint: DataPoint = payload[0].payload;
            return (
                <div className={classes.tooltip}>
                    <div className={classes.tooltipTitle}>{dataPoint.name}</div>
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
                                <stop offset={colouroffset} stopColor={isLightTheme ? '#e6e6e6' : '#ccc'} stopOpacity={1} />
                                <stop offset={colouroffset} stopColor={isLightTheme ? '#333333' : '#000'} stopOpacity={1} />
                            </linearGradient>
                        </defs>
                        {currentPositionName &&
                            <ReferenceLine x={currentPositionName} stroke={theme.colors[theme.primaryColor][7]} />
                        }
                        <Area type="linear" dataKey="yValue" stroke={theme.colors[theme.primaryColor][7]} fill="url(#splitColor)" />
                        <Area type="linear" dataKey="altValue" stroke="#999999" strokeDasharray="3 3" activeDot={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>
        </Stack>
    )
}

export default EvalChart;