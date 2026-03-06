export const tooltipContentStyle = {
    backgroundColor: "var(--mantine-color-body)",
    boxShadow: "var(--mantine-shadow-md)",
    borderRadius: "var(--mantine-radius-default)",
    border: "calc(0.0625rem * var(--mantine-scale)) solid var(--mantine-color-default-border)",
};

export const tooltipCursorStyle = {
    stroke: "rgba(105, 105, 105, 0.6)",
    strokeWidth: 1,
    strokeDasharray: "5 5",
};

export const linearGradientProps = {
    id: "colorRating",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
};

export const gradientStops = [
    { offset: "5%", stopColor: "#1971c2", stopOpacity: 1 },
    { offset: "95%", stopColor: "#1971c2", stopOpacity: 0.1 },
];
