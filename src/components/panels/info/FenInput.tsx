import { Box, Button, Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { IconRefresh, IconTrash } from "@tabler/icons-react";
import { type Setup, SquareSet } from "chessops";
import { EMPTY_FEN, INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { memo, useCallback, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { getCastlingSquare, swapMove } from "@/utils/chessops";
import FenSearch from "./FenSearch";
import FromImageButton from "./FromImageButton";
import SameWidthLabel from "./SameWidthLabel";

// The three buttons that set the whole position share the row's width equally
const positionButtonStyle = { flex: "1 1 0", minWidth: "max-content" };

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
      k: whiteKingSquare !== undefined ? setup.castlingRights.has(whiteKingSquare) : false,
      q: whiteQueenSquare !== undefined ? setup.castlingRights.has(whiteQueenSquare) : false,
    };
    blackCastling = {
      k: blackKingSquare !== undefined ? setup.castlingRights.has(blackKingSquare) : false,
      q: blackQueenSquare !== undefined ? setup.castlingRights.has(blackQueenSquare) : false,
    };
  }

  return {
    whiteCastling,
    blackCastling,
  };
}

function FenInput({ currentFen }: { currentFen: string }) {
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

  return <FenInputInner currentFen={currentFen} setup={setup} />;
}

function FenInputInner({ currentFen, setup }: { currentFen: string; setup: Setup }) {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const setFen = useStore(store, (s) => s.setFen);

  const { whiteCastling, blackCastling } = useMemo(() => getCastlingRights(setup), [setup]);

  const setCastlingRights = useCallback(
    (color: "w" | "b", side: "q" | "k", value: boolean) => {
      if (setup) {
        const castlingSquare = getCastlingSquare(setup, color, side);
        if (castlingSquare !== undefined) {
          setup.castlingRights = setup.castlingRights.set(castlingSquare, value);
          setFen(makeFen(setup));
        }
      }
    },
    [setup, setFen],
  );

  useEffect(() => {
    let newCastlingRights = SquareSet.empty();
    if (whiteCastling.q) {
      newCastlingRights = newCastlingRights.set(getCastlingSquare(setup, "w", "q")!, true);
    }
    if (blackCastling.q) {
      newCastlingRights = newCastlingRights.set(getCastlingSquare(setup, "b", "q")!, true);
    }
    if (whiteCastling.k) {
      newCastlingRights = newCastlingRights.set(getCastlingSquare(setup, "w", "k")!, true);
    }
    if (blackCastling.k) {
      newCastlingRights = newCastlingRights.set(getCastlingSquare(setup, "b", "k")!, true);
    }
    const newFen = makeFen({ ...setup, castlingRights: newCastlingRights });
    if (newFen !== currentFen) {
      setFen(newFen);
    }
  }, [blackCastling, setCastlingRights, setup, whiteCastling, setFen, currentFen]);

  const turnLabelLength = Math.max(t("Fen.WhiteToMove").length, t("Fen.BlackToMove").length);
  // Every label the position buttons can show, which each of them keeps room for
  const positionLabels = [
    t("Fen.Start"),
    t("Fen.Empty"),
    t("Fen.FromImage"),
    t("Fen.FromImage.Processing"),
  ];

  return (
    <Stack gap="sm">
      {/* Keeps clear of the editor's close button in the top-right corner */}
      <Group wrap="nowrap" pr="2rem">
        <Text fw="bold">FEN</Text>
        <Box flex={1} miw={0}>
          <FenSearch currentFen={currentFen} />
        </Box>
      </Group>
      {/* Fills the panel's width with buttons of one width, which wrap rather than get narrower
          than their longest label */}
      <Box style={{ display: "flex", flexWrap: "wrap", gap: "var(--mantine-spacing-md)" }}>
        <Button
          variant="default"
          style={positionButtonStyle}
          leftSection={<IconRefresh size={16} />}
          onClick={() => setFen(INITIAL_FEN)}
        >
          <SameWidthLabel label={t("Fen.Start")} all={positionLabels} />
        </Button>
        <Button
          variant="default"
          style={positionButtonStyle}
          leftSection={<IconTrash size={16} />}
          onClick={() => setFen(EMPTY_FEN)}
        >
          <SameWidthLabel label={t("Fen.Empty")} all={positionLabels} />
        </Button>
        <FromImageButton setFen={setFen} sameWidthAs={positionLabels} style={positionButtonStyle} />
      </Box>
      <Group>
        <Select
          // Only as wide as the longer of its two labels
          styles={{ input: { width: `calc(${turnLabelLength}ch + 3.5rem)` } }}
          allowDeselect={false}
          data={[
            { label: t("Fen.WhiteToMove"), value: "white" },
            { label: t("Fen.BlackToMove"), value: "black" },
          ]}
          value={setup?.turn || "white"}
          onChange={(value) => {
            if (setup) {
              const newFen = swapMove(currentFen, value as "white" | "black");
              setFen(newFen);
            }
          }}
        />
        <Group gap="xs" wrap="nowrap">
          <Text size="sm">{t("Fen.White")}</Text>
          <Checkbox
            label="O-O"
            checked={whiteCastling.k}
            onChange={(e) => setCastlingRights("w", "k", e.currentTarget.checked)}
            disabled={!setup}
          />
          <Checkbox
            label="O-O-O"
            checked={whiteCastling.q}
            onChange={(e) => setCastlingRights("w", "q", e.currentTarget.checked)}
            disabled={!setup}
          />
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Text size="sm">{t("Fen.Black")}</Text>
          <Checkbox
            label="O-O"
            checked={blackCastling.k}
            onChange={(e) => setCastlingRights("b", "k", e.currentTarget.checked)}
            disabled={!setup}
          />
          <Checkbox
            label="O-O-O"
            checked={blackCastling.q}
            onChange={(e) => setCastlingRights("b", "q", e.currentTarget.checked)}
            disabled={!setup}
          />
        </Group>
      </Group>
    </Stack>
  );
}

export default memo(FenInput);
