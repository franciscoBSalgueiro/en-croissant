import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { swapMove } from "@/utils/chessops";
import { Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { makeFen, parseFen } from "chessops/fen";
import { squareFromCoords } from "chessops/util";
import { memo, useContext } from "react";
import FenSearch from "./FenSearch";

type Castlingrights = {
  k: boolean;
  q: boolean;
};

function FenInput({ currentFen }: { currentFen: string }) {
  const dispatch = useContext(TreeDispatchContext);

  const [setup, error] = parseFen(currentFen).unwrap(
    (v) => [v, null],
    (e) => [null, e],
  );
  let whiteCastling: Castlingrights = { k: false, q: false };
  let blackCastling: Castlingrights = { k: false, q: false };

  if (setup) {
    whiteCastling = {
      k: setup.castlingRights.has(squareFromCoords(7, 0)!),
      q: setup.castlingRights.has(squareFromCoords(0, 0)!),
    };
    blackCastling = {
      k: setup.castlingRights.has(squareFromCoords(7, 7)!),
      q: setup.castlingRights.has(squareFromCoords(0, 7)!),
    };
  }

  function setCastlingRights(
    color: "w" | "b",
    side: "q" | "k",
    value: boolean,
  ) {
    if (setup) {
      setup.castlingRights = setup.castlingRights.set(
        squareFromCoords(side === "q" ? 0 : 7, color === "w" ? 0 : 7)!,
        value,
      );
      dispatch({
        type: "SET_FEN",
        payload: makeFen(setup),
      });
    }
  }

  return (
    <Stack gap="sm">
      <Group>
        <Stack style={{ flexGrow: 1 }}>
          <Text fw="bold">FEN</Text>
          <FenSearch currentFen={currentFen} />
          <Select
            allowDeselect={false}
            data={[
              { label: "White to move", value: "white" },
              { label: "Black to move", value: "black" },
            ]}
            value={setup?.turn || "white"}
            onChange={(value) => {
              if (setup) {
                const newFen = swapMove(currentFen, value as "white" | "black");
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
              disabled={!setup}
            />
            <Checkbox
              label="O-O-O"
              checked={whiteCastling.q}
              onChange={(e) =>
                setCastlingRights("w", "q", e.currentTarget.checked)
              }
              disabled={!setup}
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
              disabled={!setup}
            />
            <Checkbox
              label="O-O-O"
              checked={blackCastling.q}
              onChange={(e) =>
                setCastlingRights("b", "q", e.currentTarget.checked)
              }
              disabled={!setup}
            />
          </Stack>
        </Group>
      </Group>
    </Stack>
  );
}

export default memo(FenInput);
