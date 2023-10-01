import { Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { Chess } from "chess.js";
import { forwardRef, memo, useContext, useState } from "react";
import { swapMove } from "@/utils/chess";
import { capitalize } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { warn } from "tauri-plugin-log-api";

type ItemProps = {
  label: string;
  value: string;
  group?: string;
};

const SelectItem = forwardRef<HTMLDivElement, ItemProps>(function SelectItem(
  { label, value: fen, ...others }: ItemProps,
  ref
) {
  return (
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
  );
});

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

function FenSearch({ currentFen }: { currentFen: string }) {
  const [data, setData] = useState<ItemProps[]>([
    { label: currentFen, value: currentFen },
  ]);
  const [error, setError] = useState<string | undefined>(undefined);
  const dispatch = useContext(TreeDispatchContext);

  function addFen(fen: string) {
    if (fen) {
      invoke<{ valid: boolean; error?: string }>("validate_fen", {
        fen,
      }).then((v) => {
        if (v.valid) {
          dispatch({ type: "SET_FEN", payload: fen });
          setError(undefined);
        } else if (v.error) {
          setError(capitalize(v.error));
        }
      });
    }
    return fen;
  }

  async function searchOpening(name: string) {
    const results = await invoke<
      {
        eco: string;
        name: string;
        fen: string;
      }[]
    >("search_opening_name", {
      query: name,
    });
    setData([
      {
        label: name,
        value: name,
      },
      ...results.map((p) => ({
        label: p.name,
        value: p.fen,
      })),
    ]);
  }

  return (
    <Select
      placeholder="Enter FEN"
      value={currentFen}
      data={data}
      error={error}
      itemComponent={SelectItem}
      dropdownPosition="bottom"
      onChange={addFen}
      onCreate={addFen}
      filter={() => true}
      getCreateLabel={(fen) => {
        searchOpening(fen);
        return null;
      }}
      searchable
      creatable
    />
  );
}

export default memo(FenInput);
