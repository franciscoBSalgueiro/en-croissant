import { boardImageAtom, moveMethodAtom } from "@/state/atoms";
import { Chessground as NativeChessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import { Box } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";

export function Chessground(
  props: Config & { setBoardFen?: (fen: string) => void },
) {
  const [api, setApi] = useState<Api | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  const moveMethod = useAtomValue(moveMethodAtom);

  useEffect(() => {
    if (ref?.current == null) return;
    if (api) {
      api.set({
        ...props,
        events: {
          ...props.events,
          change: () => {
            if (props.setBoardFen && api) {
              props.setBoardFen(api.getFen());
            }
          },
        },
      });
    } else {
      const chessgroundApi = NativeChessground(ref.current, {
        ...props,
        addDimensionsCssVarsTo: ref.current,
        events: {
          ...props.events,
          change: () => {
            if (props.setBoardFen && chessgroundApi) {
              props.setBoardFen(chessgroundApi.getFen());
            }
          },
        },
        draggable: {
          ...props.draggable,
          enabled: moveMethod !== "select",
        },
        selectable: {
          ...props.selectable,
          enabled: moveMethod !== "drag",
        },
      });
      setApi(chessgroundApi);
    }
  }, [api, props, ref]);

  useEffect(() => {
    api?.set({
      ...props,
      events: {
        change: () => {
          if (props.setBoardFen && api) {
            props.setBoardFen(api.getFen());
          }
        },
      },
    });
  }, [api, props]);

  const boardImage = useAtomValue(boardImageAtom);

  return (
    <Box
      style={{
        aspectRatio: 1,
        width: "100%",
        "--board-image": `url('/board/${boardImage}')`,
      }}
      ref={ref}
    />
  );
}
