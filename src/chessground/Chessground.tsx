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
