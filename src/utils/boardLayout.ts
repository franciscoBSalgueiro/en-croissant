export interface PanelHeights {
    topRight: number;
    bottomRight: number;
}

export function compactBoardLayout(boardHeight: number, panels: PanelHeights) {
    const panelsHeight = panels.topRight + panels.bottomRight;
    const height = boardHeight + panelsHeight;
    return {
        height,
        boardPercentage: (boardHeight / height) * 100,
        panelPercentage: (panels.topRight / panelsHeight) * 100,
        panelsHeight,
    };
}

export function resizeCompactPanels(total: number, percentage: number): PanelHeights {
    const topRight = Math.max(100, Math.min(total - 100, (total * percentage) / 100));
    return { topRight, bottomRight: total - topRight };
}
