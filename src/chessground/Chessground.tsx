import { Chessground as NativeChessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import { Box } from "@mantine/core";
import { useAtomValue } from "jotai";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { boardImageAtom, moveMethodAtom } from "@/state/atoms";

const BOARD_COORDINATE_COLORS: Record<
  string,
  { white: string; black: string }
> = {
  blue: { white: "#dee3e6", black: "#788a94" },
  blue2: { white: "#97b2c7", black: "#546f82" },
  blue3: { white: "#d9e0e6", black: "#315991" },
  "blue-marble": { white: "#eae6dd", black: "#7c7f87" },
  canvas2: { white: "#d7daeb", black: "#547388" },
  wood: { white: "#d8a45b", black: "#9b4d0f" },
  wood2: { white: "#a38b5d", black: "#6c5017" },
  wood3: { white: "#d0ceca", black: "#755839" },
  wood4: { white: "#caaf7d", black: "#7b5330" },
  maple: { white: "#e8ceab", black: "#bc7944" },
  maple2: { white: "#e2c89f", black: "#963" },
  leather: { white: "#d1d1c9", black: "#c28e16" },
  green: { white: "#ffd", black: "#6d8753" },
  brown: { white: "#f0d9b5", black: "#946f51" },
  "pink-pyramid": { white: "#e8e9b7", black: "#ed7272" },
  marble: { white: "#93ab91", black: "#4f644e" },
  "green-plastic": { white: "#f2f9bb", black: "#59935d" },
  grey: { white: "#b8b8b8", black: "#7d7d7d" },
  metal: { white: "#c9c9c9", black: "#727272" },
  olive: { white: "#b8b19f", black: "#6d6655" },
  newspaper: { white: "#fff", black: "#8d8d8d" },
  purple: { white: "#9f90b0", black: "#7d4a8d" },
  "purple-diag": { white: "#e5daf0", black: "#957ab0" },
  ic: { white: "#ececec", black: "#c1c18e" },
  horsey: { white: "#f0d9b5", black: "#946f51" },
  gray: { white: "#e9ecef", black: "#868e96" },
};

function getBoardCoordinateColors(boardImage: string): {
  white: string;
  black: string;
} {
  const boardKey = boardImage.replace(/\.[^/.]+$/, "");
  return (
    BOARD_COORDINATE_COLORS[boardKey] ?? {
      white: "rgba(255, 255, 255, 0.8)",
      black: "rgba(72, 72, 72, 0.8)",
    }
  );
}

export interface ChessgroundRef {
  playPremove: () => boolean;
  cancelPremove: () => void;
}

interface ChessgroundProps extends Config {
  setBoardFen?: (fen: string) => void;
  ref?: Ref<ChessgroundRef>;
}

export function Chessground({ ref, ...props }: ChessgroundProps) {
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
  const boardCoordColors = getBoardCoordinateColors(boardImage);

  return (
    <Box
      style={{
        aspectRatio: 1,
        width: "100%",
        "--board-image": `url('/board/${boardImage}')`,
        "--board-coord-color-white": boardCoordColors.white,
        "--board-coord-color-black": boardCoordColors.black,
      }}
      ref={boardRef}
    />
  );
}
