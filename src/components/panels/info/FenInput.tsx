import { TreeStateContext } from "@/components/common/TreeStateContext";
import { getCastlingSquare, swapMove } from "@/utils/chessops";
import { Button, Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { type Setup, SquareSet } from "chessops";
import { EMPTY_FEN, INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { memo, useCallback, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import FenSearch from "./FenSearch";

type Castlingrights = {
  k: boolean;
  q: boolean;
};

function getCastlingRights(setup: Setup) {
  let whiteCastling: Castlingrights = { k: false, q: false };
  let blackCastling: Castlingrights = { k: false, q: false };

  if (setup) {
    const whiteKingSquare = getCastlingSquare(setup, "w", "k");
    const whiteQueenSquare = getCastlingSquare(setup, "w", "q");
    const blackKingSquare = getCastlingSquare(setup, "b", "k");
    const blackQueenSquare = getCastlingSquare(setup, "b", "q");
    whiteCastling = {
      k:
        whiteKingSquare !== undefined
          ? setup.castlingRights.has(whiteKingSquare)
          : false,
      q:
        whiteQueenSquare !== undefined
          ? setup.castlingRights.has(whiteQueenSquare)
          : false,
    };
    blackCastling = {
      k:
        blackKingSquare !== undefined
          ? setup.castlingRights.has(blackKingSquare)
          : false,
      q:
        blackQueenSquare !== undefined
          ? setup.castlingRights.has(blackQueenSquare)
          : false,
    };
  }

  return {
    whiteCastling,
    blackCastling,
  };
}

function FenInput({ currentFen }: { currentFen: string }) {
  const store = useContext(TreeStateContext)!;
  const setFen = useStore(store, (s) => s.setFen);

  const [setup, error] = useMemo(
    () =>
      parseFen(currentFen).unwrap(
        (v) => [v, null],
        (e) => [null, e],
      ),
    [currentFen],
  );

  if (!setup) {
    return <Text>{error.message}</Text>;
  }

  const { whiteCastling, blackCastling } = useMemo(
    () => getCastlingRights(setup),
    [setup],
  );

  const setCastlingRights = useCallback(
    (color: "w" | "b", side: "q" | "k", value: boolean) => {
      if (setup) {
        const castlingSquare = getCastlingSquare(setup, color, side);
        if (castlingSquare !== undefined) {
          setup.castlingRights = setup.castlingRights.set(
            castlingSquare,
            value,
          );
          setFen(makeFen(setup));
        }
      }
    },
    [setup, setFen],
  );

  useEffect(() => {
    let newCastlingRights = SquareSet.empty();
    if (whiteCastling.q) {
      newCastlingRights = newCastlingRights.set(
        getCastlingSquare(setup, "w", "q")!,
        true,
      );
    }
    if (blackCastling.q) {
      newCastlingRights = newCastlingRights.set(
        getCastlingSquare(setup, "b", "q")!,
        true,
      );
    }
    if (whiteCastling.k) {
      newCastlingRights = newCastlingRights.set(
        getCastlingSquare(setup, "w", "k")!,
        true,
      );
    }
    if (blackCastling.k) {
      newCastlingRights = newCastlingRights.set(
        getCastlingSquare(setup, "b", "k")!,
        true,
      );
    }
    setFen(makeFen({ ...setup, castlingRights: newCastlingRights }));
  }, [blackCastling, setCastlingRights, setup, whiteCastling, setFen]);

  const { t } = useTranslation();

  return (
    <Stack gap="sm">
      <Group>
        <Stack style={{ flexGrow: 1 }}>
          <Text fw="bold">FEN</Text>
          <FenSearch currentFen={currentFen} />
          <Group>
            <Button variant="default" onClick={() => setFen(INITIAL_FEN)}>
              {t("Fen.Start")}
            </Button>
            <Button variant="default" onClick={() => setFen(EMPTY_FEN)}>
              {t("Fen.Empty")}
            </Button>
            <Select
              flex={1}
              allowDeselect={false}
              data={[
                { label: t("Fen.WhiteToMove"), value: "white" },
                { label: t("Fen.BlackToMove"), value: "black" },
              ]}
              value={setup?.turn || "white"}
              onChange={(value) => {
                if (setup) {
                  const newFen = swapMove(
                    currentFen,
                    value as "white" | "black",
                  );
                  setFen(newFen);
                }
              }}
            />
          </Group>
        </Stack>
        <Group>
          <Stack>
            <Text size="sm">{t("Fen.White")}</Text>
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
            <Text size="sm">{t("Fen.Black")}</Text>
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
