import { useContext } from "react";
import { TreeStateContext } from "./TreeStateContext";
import { ResponsiveContainer, AreaChart, Tooltip, Area, XAxis, YAxis } from "recharts";
import { TreeNode } from "@/utils/treeReducer";
import { ANNOTATION_INFO } from "@/utils/chess";
import { formatScore } from "@/utils/score";
import { Score } from "@/bindings";
import { Stack, useMantineColorScheme } from "@mantine/core";

const EvalChart = () => {
    const { root, position } = useContext(TreeStateContext);
    const { colorScheme } = useMantineColorScheme();

    function* flatPath(node: TreeNode): Iterable<TreeNode> {
        if (node.children.length > 0 && node.children[0].move) {
            yield node.children[0];
            yield* flatPath(node.children[0]);
        }
    }

    function getYValue(score: Score | null): number | undefined {
        if (score) {
            let cp: number = score.value;
            if (score.type == "mate") {
                cp = score.value > 0 ? Infinity : -Infinity;
            }
            return 2 / (1 + Math.exp(-0.004 * cp)) - 1;
        }
    }

    const data = [...flatPath(root)].map((node, i) => {
        const move = node.move!;
        const annotation = node.annotation ? ANNOTATION_INFO[node.annotation].name.toLowerCase() : undefined;
        return {
            name: `${Math.floor(i / 2) + 1}.${move.color === 'w' ? '' : '..'} ${move.san}${annotation ? ` (${annotation})` : ''}`,
            evalText: node.score ? `Advantage: ${formatScore(node.score)}` : undefined,
            yValue: getYValue(node.score)
        }
    });

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
            const containerStyle: React.CSSProperties = {
                margin: 0,
                padding: 5,
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                whiteSpace: 'nowrap'
            };
            return (
                <div style={containerStyle}>
                    <div style={{"fontWeight": "bold"}}>{payload[0].payload.name}</div>
                    <div>{payload[0].payload.evalText ?? "Not analysed"}</div>
                </div>
            );
        }
        console.log('none');
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
                </AreaChart>
            </ResponsiveContainer>
        </Stack>
    )
}

export default EvalChart;