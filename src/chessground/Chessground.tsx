import { Chessground as NativeChessground } from "chessground";
import { Api } from "chessground/api";
import { Config } from "chessground/config";
import { makeFen, parseFen } from "chessops/fen";
import { useEffect, useRef, useState } from "react";

export function Chessground(
  props: Config & { setBoardFen?: (fen: string) => void },
) {
  const [api, setApi] = useState<Api | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref?.current && !api) {
      const chessgroundApi = NativeChessground(ref.current, {
        ...props,
        drawable: {
          ...props.drawable,
          brushes: {
            green: { key: "g", color: "#15781B", opacity: 1, lineWidth: 10 },
            red: { key: "r", color: "#882020", opacity: 1, lineWidth: 10 },
            blue: { key: "b", color: "#003088", opacity: 1, lineWidth: 10 },
            yellow: { key: "y", color: "#e68f00", opacity: 1, lineWidth: 10 },
            paleBlue: {
              key: "pb",
              color: "#003088",
              opacity: 0.4,
              lineWidth: 15,
            },
            paleGreen: {
              key: "pg",
              color: "#15781B",
              opacity: 0.4,
              lineWidth: 15,
            },
            paleRed: {
              key: "pr",
              color: "#882020",
              opacity: 0.4,
              lineWidth: 15,
            },
            paleGrey: {
              key: "pgr",
              color: "#4a4a4a",
              opacity: 0.35,
              lineWidth: 15,
            },
            purple: {
              key: "purple",
              color: "#68217a",
              opacity: 0.65,
              lineWidth: 10,
            },
            pink: {
              key: "pink",
              color: "#ee2080",
              opacity: 0.5,
              lineWidth: 10,
            },
            white: { key: "white", color: "white", opacity: 1, lineWidth: 10 },
            primary: {
              key: "primary",
              color: "var(--mantine-primary-color-filled)",
              opacity: 1,
              lineWidth: 10,
            },
          },
        },
        events: {
          change: () => {
            if (props.setBoardFen && chessgroundApi) {
              const fen = parseFen(chessgroundApi.getFen());
              if (fen.isOk) {
                props.setBoardFen(makeFen(fen.value));
              }
            }
          },
        },
      });
      setApi(chessgroundApi);
    } else if (ref?.current && api) {
      api.set(props);
    }
  }, [api, props, ref]);

  useEffect(() => {
    api?.set(props);
  }, [api, props]);

  return (
    <div
      style={{
        aspectRatio: 1,
        width: "100%",
      }}
      ref={ref}
    />
  );
}
