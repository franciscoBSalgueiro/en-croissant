import { Chessground as NativeChessground } from "chessground";
import { Api } from "chessground/api";
import { Config } from "chessground/config";
import { useEffect, useRef, useState } from "react";

interface ChessgroundProps extends Config {
  height?: string | number;
  width?: string | number;
}

export function Chessground(props: ChessgroundProps) {
  const [api, setApi] = useState<Api | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref && ref.current && !api) {
      const chessgroundApi = NativeChessground(ref.current, props);
      setApi(chessgroundApi);
    } else if (ref && ref.current && api) {
      api.set(props);
    }
  }, [api, props, ref]);

  useEffect(() => {
    api?.set(props);
  }, [api, props]);

  return (
    <div
      style={{
        height: props.height,
        width: props.width,
      }}
      ref={ref}
    />
  );
}
