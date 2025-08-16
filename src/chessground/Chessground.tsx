import { boardImageAtom, moveMethodAtom } from "@/state/atoms";
import { Box } from "@mantine/core";
import { Chessground as NativeChessground } from "chessground";
import type { Api } from "chessground/api";
import type { Config } from "chessground/config";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";

export function Chessground(
  props: Config & { setBoardFen?: (fen: string) => void },
) {
  const [api, setApi] = useState<Api | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  const moveMethod = useAtomValue(moveMethodAtom);

  // Initialize once with events; do not rebind on every render
  useEffect(() => {
    if (!ref.current || api) return;
    const chessgroundApi = NativeChessground(ref.current, {
      ...props,
      addDimensionsCssVarsTo: ref.current,
      events: {
        change: () => {
          if (props.setBoardFen) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ref, moveMethod]);

  // Update dynamic config WITHOUT rebinding events to avoid triggering change loops
  useEffect(() => {
    if (!api) return;
    const { setBoardFen, events: _ignored, ...rest } = props as any;
    api.set({
      ...rest,
      // do not include events here; keep the original event handlers
    } as Config);
  }, [api, props.fen, props.orientation, props.turnColor, props.check, props.lastMove, props.movable, props.premovable, props.draggable, props.drawable, props.coordinates, props.animation]);

  // Keep drag/select toggles in sync with move method
  useEffect(() => {
    if (!api) return;
    api.set({
      draggable: {
        ...props.draggable,
        enabled: moveMethod !== "select",
      },
      selectable: {
        ...props.selectable,
        enabled: moveMethod !== "drag",
      },
    } as Config);
  }, [api, moveMethod, props.draggable, props.selectable]);

  const boardImage = useAtomValue(boardImageAtom);

  return (
    <Box
      style={{
        aspectRatio: 1,
        width: "100%",
        "--board-image": `url('/board/${boardImage}')`,
        "--cg-last-move": "rgba(255, 215, 0, 0.45)",
        "--cg-check": "rgba(255, 0, 0, 0.45)",
      }}
      ref={ref}
    />
  );
}
