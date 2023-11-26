import { Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { Chess } from "chess.js";
import { memo, useContext } from "react";
import { swapMove } from "@/utils/chess";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { warn } from "tauri-plugin-log-api";
import FenSearch from "./FenSearch";

type Castlingrights = {
  k: boolean;
  q: boolean;
};

function FenInput({ currentFen }: { currentFen: string }) {
  const dispatch = useContext(TreeDispatchContext);

  let chess: Chess | null;
  let whiteCastling: Castlingrights;
  let blackCastling: Castlingrights;
  try {
    chess = new Chess(currentFen);
    whiteCastling = chess.getCastlingRights("w");
    blackCastling = chess.getCastlingRights("b");
  } catch (e) {
    warn(e as string);
    chess = null;
    whiteCastling = { k: false, q: false };
    blackCastling = { k: false, q: false };
  }

  function setCastlingRights(
    color: "w" | "b",
    side: "q" | "k",
    value: boolean
  ) {
    if (chess) {
      chess.setCastlingRights(color, {
        ...chess.getCastlingRights(color),
        [side]: value,
      });
      dispatch({
        type: "SET_FEN",
        payload: chess.fen(),
      });
    }
  }

  return (
    <Stack spacing="sm">
      <Group>
        <Stack sx={{ flexGrow: 1 }}>
          <Text fw="bold">FEN</Text>
          <FenSearch currentFen={currentFen} />
          <Select
            data={[
              { label: "White to move", value: "w" },
              { label: "Black to move", value: "b" },
            ]}
            value={chess?.turn() || "w"}
            onChange={(value) => {
              if (chess) {
                const newFen = swapMove(currentFen, value as "w" | "b");
                dispatch({
                  type: "SET_FEN",
                  payload: newFen,
                });
              }
            }}
          />
        </Stack>
        <Group>
          <Stack>
            <Text size="sm">White</Text>
            <Checkbox
              label="O-O"
              checked={whiteCastling.k}
              onChange={(e) =>
                setCastlingRights("w", "k", e.currentTarget.checked)
              }
              disabled={!chess}
            />
            <Checkbox
              label="O-O-O"
              checked={whiteCastling.q}
              onChange={(e) =>
                setCastlingRights("w", "q", e.currentTarget.checked)
              }
              disabled={!chess}
            />
          </Stack>
          <Stack>
            <Text size="sm">Black</Text>
            <Checkbox
              label="O-O"
              checked={blackCastling.k}
              onChange={(e) =>
                setCastlingRights("b", "k", e.currentTarget.checked)
              }
              disabled={!chess}
            />
            <Checkbox
              label="O-O-O"
              checked={blackCastling.q}
              onChange={(e) =>
                setCastlingRights("b", "q", e.currentTarget.checked)
              }
              disabled={!chess}
            />
          </Stack>
        </Group>
      </Group>
    </Stack>
  );
}

export default memo(FenInput);
