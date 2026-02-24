import {
  Box,
  Button,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { type Piece, parseSquare } from "chessops";
import { EMPTY_BOARD_FEN, makeFen, parseFen } from "chessops/fen";
import dayjs from "dayjs";
import { useAtom } from "jotai";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chessground } from "@/chessground/Chessground";
import PiecesGrid from "@/components/boards/PiecesGrid";
import { PlayerSearchInput } from "@/components/databases/PlayerSearchInput";
import { currentLocalOptionsAtom } from "@/state/atoms";

function LocalOptionsPanel({ boardFen }: { boardFen: string }) {
  const { t } = useTranslation();
  const boardRef = useRef(null);
  const [options, setOptions] = useAtom(currentLocalOptionsAtom);

  const setSimilarStructure = async (fen: string) => {
    const setup = parseFen(fen).unwrap();
    for (const square of setup.board.pawn.complement()) {
      setup.board.take(square);
    }
    const fenResult = makeFen(setup);
    setOptions((q) => ({ ...q, type: "partial", fen: fenResult }));
  };

  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

  return (
    <Stack>
      <SimpleGrid cols={2}>
        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Board.Database.Local.Player")}
          </Text>
          {options.path && (
            <PlayerSearchInput
              label={t("Common.Search")}
              value={options.player ?? undefined}
              file={options.path}
              setValue={(v) => setOptions((q) => ({ ...q, player: v || null }))}
            />
          )}
        </Stack>
        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Board.Database.Local.Color")}
          </Text>
          <SegmentedControl
            data={[
              { value: "white", label: t("Fen.White") },
              { value: "black", label: t("Fen.Black") },
            ]}
            value={options.color}
            onChange={(v) =>
              setOptions({ ...options, color: v as "white" | "black" })
            }
          />
        </Stack>

        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Common.From")}
          </Text>
          <DateInput
            placeholder={t("Common.StartDate")}
            valueFormat="YYYY-MM-DD"
            clearable
            value={
              options.start_date
                ? dayjs(options.start_date, "YYYY.MM.DD").toDate()
                : undefined
            }
            onChange={(value) =>
              setOptions({
                ...options,
                start_date: value
                  ? dayjs(value).format("YYYY.MM.DD")
                  : undefined,
              })
            }
          />
        </Stack>
        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Common.To")}
          </Text>
          <DateInput
            placeholder={t("Common.EndDate")}
            valueFormat="YYYY-MM-DD"
            clearable
            value={
              options.end_date
                ? dayjs(options.end_date, "YYYY.MM.DD").toDate()
                : null
            }
            onChange={(value) =>
              setOptions({
                ...options,
                end_date: value ? dayjs(value).format("YYYY.MM.DD") : undefined,
              })
            }
          />
        </Stack>

        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Board.Database.Local.Result")}
          </Text>
          <Select
            data={[
              { value: "any", label: t("Board.Database.Local.Result.Any") },
              {
                value: "whitewon",
                label: t("Board.Database.Local.Result.WhiteWon"),
              },
              { value: "draw", label: t("Board.Analysis.Tablebase.Draw") },
              {
                value: "blackwon",
                label: t("Board.Database.Local.Result.BlackWon"),
              },
            ]}
            value={options.result}
            onChange={(v) =>
              setOptions({
                ...options,
                result: v as "any" | "whitewon" | "draw" | "blackwon",
              })
            }
          />
        </Stack>
      </SimpleGrid>

      <Stack gap={4}>
        <Text fw="bold" fz="sm">
          {t("Board.Database.Local.Position")}
        </Text>
        <SegmentedControl
          data={[
            { value: "exact", label: t("Board.Database.Local.Exact") },
            { value: "partial", label: t("Board.Database.Local.Partial") },
          ]}
          value={options.type}
          onChange={(v) =>
            setOptions({ ...options, type: v as "exact" | "partial" })
          }
        />
      </Stack>

      <Group>
        <Stack>
          <Box ref={boardRef}>
            <Chessground
              fen={options.fen}
              coordinates={false}
              lastMove={[]}
              movable={{
                free: true,
                color: "both",
                events: {
                  after: (orig, dest) => {
                    const setup = parseFen(options.fen).unwrap();
                    const p = setup.board.take(parseSquare(orig)!)!;
                    setup.board.set(parseSquare(dest)!, p);
                    setOptions((q) => ({ ...q, fen: makeFen(setup) }));
                  },
                },
              }}
              events={{
                select: (key) => {
                  const square = parseSquare(key);
                  if (square && selectedPiece) {
                    const setup = parseFen(options.fen).unwrap();
                    setup.board.set(square, selectedPiece);
                    setOptions((q) => ({ ...q, fen: makeFen(setup) }));
                  }
                },
              }}
            />
          </Box>

          <Group>
            <Button
              variant="default"
              onClick={() => {
                setOptions((q) => ({ ...q, type: "exact", fen: boardFen }));
              }}
            >
              {t("Board.Database.Local.CurrentPosition")}
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setSimilarStructure(boardFen);
              }}
            >
              {t("Board.Database.Local.SimilarStructure")}
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setOptions((q) => ({
                  ...q,
                  type: "partial",
                  fen: EMPTY_BOARD_FEN,
                }));
              }}
            >
              {t("Fen.Empty")}
            </Button>
          </Group>
        </Stack>

        <Box
          flex={1}
          style={{ display: "flex", flexDirection: "column" }}
          h="30rem"
        >
          <PiecesGrid
            boardRef={boardRef}
            fen={options.fen}
            vertical
            onPut={(newFen) => {
              setOptions((q) => ({ ...q, fen: newFen }));
            }}
            onSelectPiece={setSelectedPiece}
            selectedPiece={selectedPiece}
          />
        </Box>
      </Group>
    </Stack>
  );
}

export default LocalOptionsPanel;
