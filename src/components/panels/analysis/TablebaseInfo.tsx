import { TreeStateContext } from "@/components/common/TreeStateContext";
import { type TablebaseCategory, getTablebaseInfo } from "@/utils/lichess/api";
import {
  Accordion,
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { parseUci } from "chessops";
import { useContext } from "react";
import useSWRImmutable from "swr/immutable";
import { P, match } from "ts-pattern";
import { useStore } from "zustand";
import * as classes from "./TablebaseInfo.css";

function TablebaseInfo({
  fen,
  turn,
}: { fen: string; turn: "white" | "black" }) {
  const store = useContext(TreeStateContext)!;
  const makeMove = useStore(store, (s) => s.makeMove);
  const { data, error, isLoading } = useSWRImmutable(
    ["tablebase", fen],
    async ([_, fen]) => await getTablebaseInfo(fen),
  );

  const sortedMoves = data?.moves.sort((a, b) => {
    if (a.category === "win" && b.category !== "win") {
      return 1;
    }
    if (a.category !== "win" && b.category === "win") {
      return -1;
    }
    if (a.category === "loss" && b.category !== "loss") {
      return -1;
    }
    if (a.category !== "loss" && b.category === "loss") {
      return 1;
    }
    return 0;
  });

  return (
    <Paper withBorder>
      <Accordion
        styles={{
          label: {
            padding: "0.5rem",
          },
        }}
      >
        <Accordion.Item value="tablebase">
          <Accordion.Control>
            <Group>
              <Text fw="bold">Tablebase</Text>
              {isLoading && (
                <Group p="xs">
                  <Badge variant="transparent">Loading...</Badge>
                </Group>
              )}
              {error && <Text ta="center">Error: {error.message}</Text>}
              {data && (
                <OutcomeBadge category={data.category} turn={turn} wins />
              )}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            {data && (
              <Stack gap="xs">
                <SimpleGrid cols={3}>
                  {sortedMoves!.map((m) => (
                    <Paper
                      withBorder
                      key={m.san}
                      px="xs"
                      onClick={() => {
                        makeMove({ payload: parseUci(m.uci)! });
                      }}
                      className={classes.info}
                    >
                      <Group gap="xs" justify="space-between" wrap="nowrap">
                        <Text fz="0.9rem" fw={600} ta="center">
                          {m.san}
                        </Text>
                        <OutcomeBadge
                          category={m.category}
                          dtz={Math.abs(m.dtz)}
                          dtm={m.dtm}
                          turn={turn === "white" ? "black" : "white"}
                        />
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
}

function OutcomeBadge({
  category,
  turn,
  wins,
  dtz,
  dtm,
}: {
  category: TablebaseCategory;
  turn: "white" | "black";
  wins?: boolean;
  dtz?: number;
  dtm?: number;
}) {
  const normalizedCategory = match(category)
    .with("win", () => (turn === "white" ? "White wins" : "Black wins"))
    .with("loss", () => (turn === "white" ? "Black wins" : "White wins"))
    .with(P.union("draw", "blessed-loss", "cursed-win"), () => "Draw")
    .with(P.union("unknown", "maybe-win", "maybe-loss"), () => "Unknown")
    .exhaustive();

  const color = match(category)
    .with("win", () => (turn === "white" ? "white" : "black"))
    .with("loss", () => (turn === "white" ? "black" : "white"))
    .otherwise(() => "gray");

  const label = wins
    ? normalizedCategory
    : match(category)
        .with("draw", () => "Draw")
        .with("unknown", () => "Unknown")
        .otherwise(() => (dtm ? `DTM ${Math.abs(dtm)}` : `DTZ ${dtz}`));

  return (
    <Group p="xs">
      <Badge autoContrast color={color}>
        {label}
      </Badge>
      {["blessed-loss", "cursed-win", "maybe-win", "maybe-loss"].includes(
        category,
      ) &&
        wins && (
          <Text c="dimmed" fz="xs">
            *due to the 50-move rule
          </Text>
        )}
    </Group>
  );
}

export default TablebaseInfo;
