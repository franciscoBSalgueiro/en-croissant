import { boardImageAtom, moveMethodAtom } from "@/state/atoms";
import { Chessground as NativeChessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import { Box } from "@mantine/core";
import { useAtomValue } from "jotai";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface ChessgroundRef {
  playPremove: () => boolean;
  cancelPremove: () => void;
}

export const Chessground = forwardRef<
  ChessgroundRef,
  Config & { setBoardFen?: (fen: string) => void }
>(function Chessground(props, ref) {
  const [api, setApi] = useState<Api | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  const moveMethod = useAtomValue(moveMethodAtom);

  useImperativeHandle(
    ref,
    () => ({
      playPremove: () => api?.playPremove() ?? false,
      cancelPremove: () => api?.cancelPremove(),
    }),
    [api],
  );

  useEffect(() => {
    if (boardRef?.current == null) return;
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
      const chessgroundApi = NativeChessground(boardRef.current, {
        ...props,
        addDimensionsCssVarsTo: boardRef.current,
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
  }, [api, props, boardRef]);

  useEffect(() => {
    api?.set({
      ...props,
      events: {
        ...props.events,
        change: () => {
          if (props.setBoardFen && api) {
            props.setBoardFen(api.getFen());
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
  }, [api, props, moveMethod]);

  const boardImage = useAtomValue(boardImageAtom);

  return (
    <Box
      style={{
        aspectRatio: 1,
        width: "100%",
        "--board-image": `url('/board/${boardImage}')`,
      }}
      ref={boardRef}
    />
  );
});
