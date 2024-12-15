import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAtom, useAtomValue } from "jotai";
import {
    Box,
    Divider,
    Group,
    ScrollArea,
    Stack,
    Text,
} from "@mantine/core";
import type { Color } from "chessops";
import { activeTabAtom, fontSizeAtom, tabsAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import type { PlayerGameInfo } from "@/bindings";
import { createTab } from "@/utils/tabs";
import { countMainPly, defaultTree } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import * as classes from "./OpeningsPanel.css";
import ResultsChart from "./ResultsChart";
import { commands, GameOutcome } from "@/bindings";
import WebsiteAccountSelector from "./WebsiteAccountSelector";
import TimeControlSelector from "./TimeControlSelector";
import { getTimeControl } from "@/utils/timeControl";

type OpeningStats = {
    name: string;
    games: number;
    won: number;
    draw: number;
    lost: number;
}

function aggregateOpenings(
    data: { opening: string; result: GameOutcome; is_player_white: boolean }[],
    color: Color,
): OpeningStats[] {
    return Array.from(
        data
            .filter((d) => d.is_player_white === (color === "white"))
            .reduce((acc, d) => {
                const prev = acc.get(d.opening) ?? { won: 0, draw: 0, lost: 0, total: 0 };
                acc.set(d.opening, {
                    won: prev.won + (d.result === 'Won' ? 1 : 0),
                    draw: prev.draw + (d.result === 'Drawn' ? 1 : 0),
                    lost: prev.lost + (d.result === 'Lost' ? 1 : 0),
                    total: prev.total + 1,
                });
                return acc;
            }, new Map())
    )
        .map(([name, { won, draw, lost, total }]) => ({ name, games: total, won, draw, lost }))
        .sort((a, b) => b.games - a.games);
}

function OpeningsPanel({ playerName, info }: { playerName: string; info: PlayerGameInfo }) {
    const [website, setWebsite] = useState<string | null>("All websites");
    const [account, setAccount] = useState<string | null>("All accounts");
    const [timeControl, setTimeControl] = useState<string | null>(null);

    const openingData = info?.site_stats_data
        .filter((d) => website === "All websites" || d.site === website)
        .filter((d) => account === "All accounts" || d.player === account)
        .flatMap((d) => d.data)
        .filter((g) => !timeControl
            || timeControl === "any"
            || getTimeControl(website!, g.time_control) === timeControl)
        .map((g) => ({
            opening: g.opening,
            result: g.result,
            is_player_white: g.is_player_white,
        })) ?? [];

    const whiteGames = openingData.filter((g) => g.is_player_white).length;
    const blackGames = openingData.filter((g) => !g.is_player_white).length;

    const whiteOpenings = aggregateOpenings(openingData, "white");
    const blackOpenings = aggregateOpenings(openingData, "black");

    const fontSize = useAtomValue(fontSizeAtom);

    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: Math.max(whiteOpenings.length, blackOpenings.length),
        estimateSize: () => 120 * (fontSize / 100),
        getScrollElement: () => parentRef.current,
    });

    return (
        <Stack gap={0} h="100%">
            <WebsiteAccountSelector
                playerName={playerName}
                onWebsiteChange={(website) => {
                    setWebsite(website);
                    if (website === "All websites") {
                        setTimeControl(null);
                    } else if (timeControl === null) {
                        setTimeControl("any");
                    }
                }}
                onAccountChange={setAccount}
                allowAll={true}
            />
            {website !== "All websites" && (
                <TimeControlSelector
                    website={website}
                    onTimeControlChange={setTimeControl}
                    allowAll={true}
                />
            )}
            <Group grow pt="xl">
                <Text ta="center" fw="bold">
                    White
                </Text>
                <Text ta="center" fw="bold">
                    Black
                </Text>
            </Group>
            <Divider mt="md" />
            <ScrollArea viewportRef={parentRef} flex={1}>
                <Box
                    style={{
                        height: rowVirtualizer.getTotalSize(),
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const white = whiteOpenings[virtualRow.index];
                        const black = blackOpenings[virtualRow.index];
                        return (
                            <Box
                                key={virtualRow.index}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: virtualRow.size,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <Group grow>
                                    {white ? (
                                        <OpeningDetail
                                            opening={white}
                                            totalGames={whiteGames}
                                            color="white"
                                        />
                                    ) : (
                                        <div />
                                    )}
                                    {black ? (
                                        <OpeningDetail
                                            opening={black}
                                            totalGames={blackGames}
                                            color="black"
                                        />
                                    ) : (
                                        <div />
                                    )}
                                </Group>
                                <Divider />
                            </Box>
                        );
                    })}
                </Box>
            </ScrollArea>
        </Stack>
    );
}

function OpeningDetail({ opening, totalGames, color }: {
    opening: OpeningStats;
    totalGames: number;
    color: Color
}) {
    const [, setTabs] = useAtom(tabsAtom);
    const [, setActiveTab] = useAtom(activeTabAtom);
    const navigate = useNavigate();

    const openingRate = opening.games / totalGames;
    return (
        <Stack py="sm" justify="space-between">
            <Group justify="space-between" wrap="nowrap">
                <Text
                    lineClamp={2}
                    className={classes.link}
                    onClick={async () => {
                        const pgn = unwrap(await commands.getOpeningFromName(opening.name));
                        const headers = defaultTree().headers;
                        const tree = await parsePGN(pgn);
                        headers.orientation = color;
                        createTab({
                            tab: { name: opening.name, type: "analysis" },
                            pgn,
                            headers,
                            setTabs,
                            setActiveTab,
                            position: Array(countMainPly(tree.root)).fill(0),
                        });
                        navigate({ to: "/" });
                    }}
                >
                    {opening.name}
                </Text>
                <Text>
                    {(openingRate * 100).toFixed(2)}%
                </Text>
            </Group>
            <ResultsChart
                won={opening.won}
                draw={opening.draw}
                lost={opening.lost}
                size="1.5rem"
            />
        </Stack>
    );
}

export default OpeningsPanel;
