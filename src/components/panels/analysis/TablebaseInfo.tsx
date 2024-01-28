import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { getTablebaseInfo } from "@/utils/lichess";
import {
  Accordion,
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useContext } from "react";
import useSWRImmutable from "swr/immutable";
import { match } from "ts-pattern";
import * as classes from "./TablebaseInfo.css";

function TablebaseInfo({
  fen,
  turn,
}: { fen: string; turn: "white" | "black" }) {
  const dispatch = useContext(TreeDispatchContext);
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
              {isLoading && <Text ta="center">Loading...</Text>}
              {error && <Text ta="center">Error: {error.message}</Text>}
              {data && (
                <OutcomeBadge outcome={data.category} turn={turn} wins />
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
                        dispatch({
                          type: "MAKE_MOVE",
                          payload: m.san,
                        });
                      }}
                      className={classes.info}
                    >
                      <Group gap="xs" justify="space-between" wrap="nowrap">
                        <Text c="white" fz="0.9rem" fw={600} ta="center">
                          {m.san}
                        </Text>
                        <OutcomeBadge
                          outcome={m.category}
                          turn={turn === "white" ? "black" : "white"}
                          wins={false}
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
  outcome,
  turn,
  wins,
}: {
  outcome: "win" | "loss" | "draw" | "unknown";
  turn: "white" | "black";
  wins: boolean;
}) {
  const color = match(outcome)
    .with("win", () => (turn === "white" ? "white" : "black"))
    .with("loss", () => (turn === "white" ? "black" : "white"))
    .with("draw", () => "gray")
    .with("unknown", () => "gray")
    .exhaustive();
  const label = match(outcome)
    .with(
      "win",
      () => (turn === "white" ? "White" : "Black") + (wins ? " wins" : ""),
    )
    .with(
      "loss",
      () => (turn === "white" ? "Black" : "White") + (wins ? " wins" : ""),
    )
    .with("draw", () => "Draw")
    .with("unknown", () => "Unknown")
    .exhaustive();
  return (
    <Stack px="xs" py="xs" align="center" justify="center">
      <Badge autoContrast color={color}>
        {label}
      </Badge>
    </Stack>
  );
}

export default TablebaseInfo;
