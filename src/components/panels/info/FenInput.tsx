import { Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { Chess } from "chess.js";
import { forwardRef, memo, useContext, useState } from "react";
import { swapMove } from "../../../utils/chess";
import { capitalize } from "../../../utils/format";
import { invoke } from "../../../utils/misc";
import { TreeDispatchContext } from "../../common/TreeStateContext";

type ItemProps = {
  label: string;
  value: string;
  group?: string;
};

const POSITIONS: ItemProps[] = [
  {
    label: "Empty position",
    value: "8/8/8/8/8/8/8/8 w - - 0 1",
  },
  {
    label: "Starting position",
    value: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  },
  {
    label: "Ruy Lopez",
    value: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
  },
];

const SelectItem = forwardRef<HTMLDivElement, ItemProps>(
  ({ label, value: fen, ...others }: ItemProps, ref) => (
    <div ref={ref} {...others} key={label}>
      <Group noWrap>
        <div>
          <Text size="sm">{label}</Text>
          <Text size="xs" opacity={0.65}>
            {fen}
          </Text>
        </div>
      </Group>
    </div>
  )
);

type Castlingrights = {
  k: boolean;
  q: boolean;
};

function FenInput({ currentFen }: { currentFen: string }) {
  const dispatch = useContext(TreeDispatchContext);
  const [error, setError] = useState<string | undefined>(undefined);

  let positions = POSITIONS;
  if (!positions.find((p) => p.value === currentFen)) {
    positions = [...positions, { label: currentFen, value: currentFen }];
  }
  let chess: Chess | null;
  let whiteCastling: Castlingrights;
  let blackCastling: Castlingrights;
  try {
    chess = new Chess(currentFen);
    whiteCastling = chess.getCastlingRights("w");
    blackCastling = chess.getCastlingRights("b");
  } catch (e) {
    console.log(e);
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

  function addFen(fen: string) {
    if (fen) {
      invoke<{ valid: boolean; error?: string }>("validate_fen", {
        fen,
      }).then((v) => {
        if (v.valid) {
          dispatch({ type: "SET_FEN", payload: fen });
          setError(undefined);
        } else {
          setError(capitalize(v.error!));
        }
      });
    }
    return fen;
  }

  return (
    <Stack spacing="sm">
      <Group>
        <Stack sx={{ flexGrow: 1 }}>
          <Text fw="bold">FEN</Text>
          <Select
            placeholder="Enter FEN"
            value={currentFen}
            data={positions}
            error={error}
            itemComponent={SelectItem}
            dropdownPosition="bottom"
            onChange={addFen}
            onCreate={addFen}
            getCreateLabel={(fen) => fen}
            searchable
            creatable
          />
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
