declare module "gchessboard";

declare namespace JSX {
  interface IntrinsicElements {
    "g-chess-board": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      fen?: string;
      orientation?: "white" | "black";
      coordinates?: "inside" | "outside" | "hidden";
      interactive?: boolean;
      turn?: "white" | "black";
      style?: React.CSSProperties;
    };
  }
}


