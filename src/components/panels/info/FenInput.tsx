import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { swapMove } from "@/utils/chessops";
import { Button, Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { Setup, SquareSet } from "chessops";
import { EMPTY_FEN, INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { squareFile, squareFromCoords, squareRank } from "chessops/util";
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

  function getCastlingSquare(setup: Setup, color: "w" | "b", side: "q" | "k") {
    const kingSquare = (color === "w" ? setup.board.white : setup.board.black)
      .intersect(setup.board.king)
      .singleSquare();
    if (kingSquare === undefined) {
      return;
    }

    let possibleRookSquares = SquareSet.empty();
    for (let file = 0; file < 8; file++) {
      const newSquare = squareFromCoords(file, squareRank(kingSquare));
      if (!newSquare) {
        continue;
      }
      if (side === "q" && file < squareFile(kingSquare)) {
        possibleRookSquares = possibleRookSquares.set(newSquare, true);
      } else if (side === "k" && file > squareFile(kingSquare)) {
        possibleRookSquares = possibleRookSquares.set(newSquare, true);
      }
    }

    const rookSquares = (color === "w" ? setup.board.white : setup.board.black)
      .intersect(setup.board.rook)
      .intersect(possibleRookSquares);

    return rookSquares.first();
  }

  if (setup) {
    const whiteKingSquare = getCastlingSquare(setup, "w", "k");
    const whiteQueenSquare = getCastlingSquare(setup, "w", "q");
    const blackKingSquare = getCastlingSquare(setup, "b", "k");
    const blackQueenSquare = getCastlingSquare(setup, "b", "q");
    whiteCastling = {
      k: whiteKingSquare ? setup.castlingRights.has(whiteKingSquare) : false,
      q: whiteQueenSquare ? setup.castlingRights.has(whiteQueenSquare) : false,
    };
    blackCastling = {
      k: blackKingSquare ? setup.castlingRights.has(blackKingSquare) : false,
      q: blackQueenSquare ? setup.castlingRights.has(blackQueenSquare) : false,
    };
  }

  function setCastlingRights(
    color: "w" | "b",
    side: "q" | "k",
    value: boolean,
  ) {
    if (setup) {
      const castlingSquare = getCastlingSquare(setup, color, side);
      if (castlingSquare !== undefined) {
        setup.castlingRights = setup.castlingRights.set(castlingSquare, value);
        dispatch({
          type: "SET_FEN",
          payload: makeFen(setup),
        });
      }
    }
  }

  return (
    <Stack gap="sm">
      <Group>
        <Stack style={{ flexGrow: 1 }}>
          <Text fw="bold">FEN</Text>
          <FenSearch currentFen={currentFen} />
          <Group>
            <Button
              variant="default"
              onClick={() => {
                dispatch({
                  type: "SET_FEN",
                  payload: INITIAL_FEN,
                });
              }}
            >
              Start
            </Button>
            <Button
              variant="default"
              onClick={() => {
                dispatch({
                  type: "SET_FEN",
                  payload: EMPTY_FEN,
                });
              }}
            >
              Empty
            </Button>
            <Select
              flex={1}
              allowDeselect={false}
              data={[
                { label: "White to move", value: "white" },
                { label: "Black to move", value: "black" },
              ]}
              value={setup?.turn || "white"}
              onChange={(value) => {
                if (setup) {
                  const newFen = swapMove(
                    currentFen,
                    value as "white" | "black",
                  );
                  dispatch({
                    type: "SET_FEN",
                    payload: newFen,
                  });
                }
              }}
            />
          </Group>
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
