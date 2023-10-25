import { useContext } from "react";
import { TreeStateContext } from "./TreeStateContext";
import { ResponsiveContainer, AreaChart, Tooltip, Area, XAxis, YAxis } from "recharts";
import { ListNode, TreeNode, treeIteratorMainLine } from "@/utils/treeReducer";
import { ANNOTATION_INFO } from "@/utils/chess";
import { formatScore } from "@/utils/score";
import { Score } from "@/bindings";
import { Stack, useMantineColorScheme } from "@mantine/core";
import { skipWhile, takeWhile } from "@/utils/helperFunctions";

type DataPoint = {
    name: string;
    evalText: string;
    yValue: number | undefined;
    altValue: number | undefined;
    movePath: number[];
}

const EvalChart = () => {
    const { root, position } = useContext(TreeStateContext);
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

    const data = [...getData()];

    const gradientOffset = () => {
        const dataMax = Math.max(...data.map((i) => i.yValue ?? 0));
        const dataMin = Math.min(...data.map((i) => i.yValue ?? 0));
        
        if (dataMax <= 0) return 0;
        if (dataMin >= 0) return 1;
        
        return dataMax / (dataMax - dataMin);
    };
    
    const offset = gradientOffset();

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
    
    return (
        <Stack>
            <ResponsiveContainer width="99%" height={220}>
                <AreaChart data={data}>
                    <Tooltip content={<CustomTooltip />} />
                    <XAxis hide dataKey="name" />
                    <YAxis hide dataKey="yValue" domain={[-1, 1]} />
                    <defs>
                        <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset={offset} stopColor={colorScheme == 'light' ? '#e6e6e6' : '#ccc'} stopOpacity={1} />
                            <stop offset={offset} stopColor={colorScheme == 'light' ? '#333333' : '#000'} stopOpacity={1} />
                        </linearGradient>
                    </defs>
                    <Area type="linear" dataKey="yValue" stroke={'#ff9933'} fill="url(#splitColor)" />
                    <Area type="linear" dataKey="altValue" stroke="#999999" strokeDasharray="3 3" activeDot={false} />
                </AreaChart>
            </ResponsiveContainer>
        </Stack>
    )
}

export default EvalChart;