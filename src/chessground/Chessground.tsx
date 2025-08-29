import { moveMethodAtom, gboardThemeAtom } from "@/state/atoms";
import { Box } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import "gchessboard";

/**
 * Lightweight adapter that exposes a Chessground-like API surface backed by the
 * gchessboard web component. We only implement the props used by our
 * Board.tsx, ignoring the rest.
 */
export function Chessground(
  props: {
    setBoardFen?: (fen: string) => void;
    fen?: string;
    orientation?: "white" | "black";
    coordinates?: boolean;
    viewOnly?: boolean;
    turnColor?: "white" | "black";
    check?: boolean;
    lastMove?: any[];
    highlight?: { lastMove?: boolean; check?: boolean };
    animation?: { enabled?: boolean };
    // explicit pixel size for width/height. If provided, overrides 100% sizing
    pixelSize?: number;
    movable?: {
      free?: boolean;
      color?: "white" | "black" | "both" | undefined;
      dests?: Map<string, string[]> | undefined;
      showDests?: boolean;
      events?: {
        after?: (orig: string, dest: string, metadata: { ctrlKey?: boolean }) => void;
      };
    };
    draggable?: { enabled?: boolean; deleteOnDropOff?: boolean };
    premovable?: { enabled?: boolean };
    drawable?: {
      enabled?: boolean;
      visible?: boolean;
      autoShapes?: Array<{ orig: any; dest?: any; brush?: string; modifiers?: { lineWidth?: number } }>;
      onChange?: (shapes: Array<{ orig: any; dest?: any; brush?: string }>) => void;
      defaultSnapToValidMove?: boolean;
    };
    selectable?: { enabled?: boolean };
    // Optional: force arrow opacity (0..1). If omitted, falls back to CSS var --arrow-opacity or default 0.6
    arrowOpacity?: number;
    children?: React.ReactNode;
  },
) {
  const ref = useRef<any>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const [elementId] = useState(() => `gcb-${Math.random().toString(36).slice(2)}`);
  const moveMethod = useAtomValue(moveMethodAtom);
  const themeKey = useAtomValue(gboardThemeAtom);

  // Compute whether the board should be interactive
  const interactive = useMemo(() => {
    if (props.viewOnly) return false;
    const dragAllowed = moveMethod !== "select";
    const selectAllowed = moveMethod !== "drag";
    const movable = props.movable;
    if (!movable) return dragAllowed || selectAllowed;
    return Boolean(movable.free || movable.color) || dragAllowed || selectAllowed;
  }, [props.movable, moveMethod]);

  // Bind gchessboard event listeners and keep them in sync with dests
  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;

    // movestart: restrict targets based on provided dests
    const onMoveStart = (e: CustomEvent) => {
      try {
        const from = (e as any).detail?.from as string | undefined;
        const setTargets = (e as any).detail?.setTargets as ((s: string[]) => void) | undefined;
        if (!from || !setTargets) return;
        const dests = props.movable?.dests;
        if (!dests) return; // allow free movement when no dests provided (e.g., editing mode)
        const targets = dests.get(from) ?? [];
        setTargets(Array.isArray(targets) ? targets : []);
      } catch {}
    };

    // moveend: bubble up to after() callback. We do not prevent completion here.
    const onMoveEnd = (e: CustomEvent) => {
      const from = (e as any).detail?.from as string | undefined;
      const to = (e as any).detail?.to as string | undefined;
      if (from && to) {
        props.movable?.events?.after?.(from, to, { ctrlKey: false });
      }
    };

    // movefinished: update fen back to caller if requested
    const onMoveFinished = () => {
      try {
        const fen: string | undefined = (ref.current as any)?.fen;
        props.setBoardFen?.(fen || "");
      } catch {}
    };

    el.addEventListener("movestart", onMoveStart as any);
    el.addEventListener("moveend", onMoveEnd as any);
    el.addEventListener("movefinished", onMoveFinished as any);
    return () => {
      el.removeEventListener("movestart", onMoveStart as any);
      el.removeEventListener("moveend", onMoveEnd as any);
      el.removeEventListener("movefinished", onMoveFinished as any);
    };
  }, [props.movable?.dests, props.movable?.events, props.setBoardFen]);

  // Keep element properties synced with React props
  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    // orientation
    if (props.orientation) el.orientation = props.orientation;
    // coordinates mapping
    el.coordinates = props.coordinates ? "inside" : "hidden";
    // fen: gchessboard expects piece placement or "start"; pass through first token
    const fen = props.fen || "";
    const firstToken = fen.includes(" ") ? fen.split(" ")[0] : fen;
    el.fen = firstToken || "";
    // interactive
    el.interactive = interactive;
    // turn: hint to keyboard users which side moves; not critical
    if (props.turnColor) el.turn = props.turnColor;
    // highlight controls
    el.highlight = {
      lastMove: props.highlight?.lastMove ?? true,
      check: props.highlight?.check ?? true,
    } as any;
  }, [props.orientation, props.coordinates, props.fen, props.turnColor, interactive]);

  // Map arrows and inject brush styles (color + opacity). Weight maps to size.
  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    const shapes = props.drawable?.autoShapes || [];
    // compute global opacity from prop or CSS var if present
    let globalOpacity = 0.6;
    if (typeof props.arrowOpacity === "number" && Number.isFinite(props.arrowOpacity)) {
      globalOpacity = Math.max(0, Math.min(1, props.arrowOpacity));
    } else {
      try {
        const cs = getComputedStyle((el as HTMLElement));
        const v = cs.getPropertyValue("--arrow-opacity").trim();
        if (v) {
          const num = Number.parseFloat(v);
          if (Number.isFinite(num)) globalOpacity = Math.max(0, Math.min(1, num));
        }
      } catch {}
    }

    const colorMap: Record<string, string> = {
      green: "hsl(140deg 70% 45%)",
      paleGreen: "hsl(140deg 70% 65%)",
      yellow: "hsl(50deg 95% 55%)",
      red: "hsl(0deg 85% 55%)",
      paleRed: "hsl(0deg 85% 70%)",
      blue: "hsl(210deg 85% 55%)",
      paleBlue: "hsl(210deg 85% 70%)",
      gray: "hsl(0deg 0% 60%)",
    };

    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "-");
    const normalizeSq = (sq: any) => {
      if (typeof sq === "string") return sq;
      if (typeof sq?.key === "string") return sq.key;
      if (typeof sq?.name === "string") return sq.name;
      return undefined as unknown as string;
    };

    type Arrow = { from: string; to: string; brush?: string; weight?: "light" | "normal" | "bold" };
    const arrows: Arrow[] = [];
    const uniqueBrushes = new Map<string, string>(); // brush -> color

    for (const s of shapes) {
      const from = normalizeSq((s as any).orig);
      const to = normalizeSq((s as any).dest);
      if (!from || !to) continue;
      const rawBrush = ((s as any).brush as string | undefined) ?? "gray";
      const brush = sanitize(rawBrush);
      const color = colorMap[rawBrush] || colorMap[brush] || rawBrush;
      if (!uniqueBrushes.has(brush)) uniqueBrushes.set(brush, color);
      const lw: number = Number((s as any)?.modifiers?.lineWidth) || 6;
      const weight = lw >= 10 ? "bold" : lw >= 7 ? "normal" : "light";
      arrows.push({ from, to, brush, weight });
    }

    try {
      (el as any).arrows = arrows as any;
    } catch {}

    // Inject/update per-brush style rules for this element
    const styleHost = styleRef.current ?? document.createElement("style");
    styleHost.id = `${elementId}-styles`;
    const rules: string[] = [];
    uniqueBrushes.forEach((color, brush) => {
      rules.push(`#${elementId}::part(arrow-${brush}){ color: ${color}; opacity: ${globalOpacity}; }`);
    });
    styleHost.textContent = rules.join("\n");
    if (!styleRef.current) {
      (el.parentElement || el).appendChild(styleHost);
      styleRef.current = styleHost;
    }
  }, [props.drawable?.autoShapes, props.arrowOpacity]);

  return (
    <Box
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <g-chess-board
        ref={ref}
        style={{
          width: (typeof props.pixelSize === "number" && Number.isFinite(props.pixelSize)) ? `${props.pixelSize}px` : "100%",
          height: (typeof props.pixelSize === "number" && Number.isFinite(props.pixelSize)) ? `${props.pixelSize}px` : "100%",
          aspectRatio: (typeof props.pixelSize === "number" && Number.isFinite(props.pixelSize)) ? undefined : 1,
          // Square theme from Settings (gboardThemeAtom)
          ...(themeKey === "chess24" ? {
            ["--square-color-dark" as any]: "#633526",
            ["--square-color-light" as any]: "#9E7863",
          } : themeKey === "metro" ? {
            ["--square-color-dark" as any]: "#FFFFFF",
            ["--square-color-light" as any]: "#EFEFEF",
          } : themeKey === "leipzig" ? {
            ["--square-color-dark" as any]: "#E1E1E1",
            ["--square-color-light" as any]: "#FFFFFF",
          } : themeKey === "wikipedia" ? {
            ["--square-color-dark" as any]: "#D18B47",
            ["--square-color-light" as any]: "#FFCE9E",
          } : themeKey === "dilena" ? {
            ["--square-color-dark" as any]: "#B16228",
            ["--square-color-light" as any]: "#FFE5B6",
          } : themeKey === "uscf" ? {
            ["--square-color-dark" as any]: "#727FA2",
            ["--square-color-light" as any]: "#C3C6BE",
          } : themeKey === "symbol" ? {
            ["--square-color-dark" as any]: "#58AC8A",
            ["--square-color-light" as any]: "#FFFFFF",
          } : {
            ["--square-color-dark" as any]: "color-mix(in srgb, var(--mantine-primary-color-9, #4dabf7) 12%, var(--mantine-color-dark-7, #1A1B1E))",
            ["--square-color-light" as any]: "color-mix(in srgb, var(--mantine-primary-color-6, #339af0) 10%, var(--mantine-color-dark-5, #2C2E33))",
          }),
          ["--square-color-dark-hover" as any]: "color-mix(in srgb, var(--mantine-primary-color-9, #4dabf7) 18%, var(--mantine-color-dark-6, #25262b))",
          ["--square-color-light-hover" as any]: "color-mix(in srgb, var(--mantine-primary-color-6, #339af0) 16%, var(--mantine-color-dark-4, #373A40))",
          ["--square-color-dark-active" as any]: "color-mix(in srgb, var(--mantine-primary-color-9, #4dabf7) 24%, var(--mantine-color-dark-6, #25262b))",
          ["--square-color-light-active" as any]: "color-mix(in srgb, var(--mantine-primary-color-6, #339af0) 22%, var(--mantine-color-dark-4, #373A40))",
          ["--inner-border-width" as any]: "1px",
          ["--inner-border-color" as any]: "var(--mantine-color-dark-8, #141517)",
          ["--outline-color-dark-active" as any]: "color-mix(in srgb, var(--mantine-primary-color-filled, #228be6) 80%, transparent)",
          ["--outline-color-light-active" as any]: "color-mix(in srgb, var(--mantine-primary-color-filled, #228be6) 65%, transparent)",
          ["--coords-font-size" as any]: "0.8rem",
          ["--coords-font-family" as any]: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          ["--move-target-marker-color-dark-square" as any]: "color-mix(in srgb, var(--mantine-primary-color-6, #339af0) 85%, transparent)",
          ["--move-target-marker-color-light-square" as any]: "color-mix(in srgb, var(--mantine-primary-color-6, #339af0) 85%, transparent)",
          ["--move-target-marker-radius" as any]: "22%",
          ["--move-target-marker-radius-occupied" as any]: "78%",
          ["--ghost-piece-opacity" as any]: 0.28,
          ["--piece-padding" as any]: "3%",
          ["--arrow-color-primary" as any]: "color-mix(in srgb, var(--mantine-primary-color-filled, #228be6) 80%, transparent)",
          ["--arrow-color-secondary" as any]: "color-mix(in srgb, var(--mantine-primary-color-6, #339af0) 70%, transparent)",
        } as any}
        id={elementId as any}
      >
        {props.children}
      </g-chess-board>
    </Box>
  );
}
