export type RatingDateBounds = { start: number; end: number };

export function getRatingDateBounds(
    period: string | null,
    dates: number[],
    custom: RatingDateBounds | null,
    now = new Date(),
): RatingDateBounds {
    if (period === null && custom) return custom;
    const days = ({ "7d": 7, "30d": 30, "90d": 90, "1y": 365 } as Record<string, number>)[
        period ?? "all"
    ];
    if (!days) return { start: dates[0] ?? Infinity, end: dates.at(-1) ?? -Infinity };
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    start.setDate(start.getDate() - days);
    end.setDate(end.getDate() + 1);
    return { start: start.getTime(), end: end.getTime() - 1 };
}

export function getRatingRangeIndices(dates: number[], bounds: RatingDateBounds) {
    const start = dates.findIndex((date) => date >= bounds.start);
    const end = dates.findLastIndex((date) => date <= bounds.end);
    return start < 0 || end < start ? null : { start, end };
}
