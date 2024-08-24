import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  currentTabAtom,
  minimumGamesAtom,
  missingMovesAtom,
  percentageCoverageAtom,
  referenceDbAtom,
} from "@/state/atoms";
import {
  type MissingMove,
  getTreeStats,
  openingReport,
} from "@/utils/repertoire";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Progress,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconInfoCircle, IconReload } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useContext, useMemo, useState } from "react";
import { useStore } from "zustand";

function RepertoireInfo() {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const referenceDb = useAtomValue(referenceDbAtom);
  const currentTab = useAtomValue(currentTabAtom);

  const [allMissingMoves, setMissingMoves] = useAtom(missingMovesAtom);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const percentageCoverage = useAtomValue(percentageCoverageAtom);
  const minimumGames = useAtomValue(minimumGamesAtom);

  if (!currentTab) {
    return null;
  }
  const missingMoves = allMissingMoves[currentTab.value];

  function searchForMissingMoves() {
    if (!referenceDb) {
      throw Error("No reference database selected");
    }
    if (!currentTab) {
      throw Error("No current tab");
    }
    setLoading(true);
    openingReport({
      color: headers.orientation || "white",
      start: headers.start || [],
      referenceDb,
      root,
      setProgress,
      percentageCoverage,
      minimumGames,
    }).then((missingMoves) => {
      setMissingMoves((prev) => ({
        ...prev,
        [currentTab.value]: missingMoves,
      }));
      setLoading(false);
    });
  }

  const stats = useMemo(() => getTreeStats(root), [root]);

  return (
    <Stack style={{ overflow: "hidden" }} h="100%">
      <Group>
        <Text>Variations: {stats.leafs}</Text>
        <Text>Max Depth: {stats.depth}</Text>
        <Text>Total moves: {stats.total}</Text>
      </Group>

      <Group>
        {!loading && !missingMoves && (
          <Button variant="default" onClick={() => searchForMissingMoves()}>
            Look for missing moves
          </Button>
        )}
      </Group>

      {!headers.start ||
        (headers.start.length === 0 && (
          <Alert icon={<IconInfoCircle />}>
            Mark a move as <b>Start</b> in order to exclude unwanted moves from
            the results
          </Alert>
        ))}

      {loading ? (
        <>
          <Text>Analyzing Repertoire</Text>
          <Progress value={progress} />
        </>
      ) : (
        missingMoves && (
          <MissingMoves
            missingMoves={missingMoves}
            search={searchForMissingMoves}
          />
        )
      )}
    </Stack>
  );
}

type SortStatus = DataTableSortStatus<MissingMove>;
const sortStatusStorageId = `${MissingMoves.name}-sort-status` as const;
const sortStatusAtom = atomWithStorage<SortStatus>(
  sortStatusStorageId,
  {
    columnAccessor: "move",
    direction: "asc",
  },
  undefined,
  { getOnInit: true },
);

function MissingMoves({
  missingMoves,
  search,
}: {
  missingMoves: MissingMove[];
  search: () => void;
}) {
  const store = useContext(TreeStateContext)!;
  const goToMove = useStore(store, (s) => s.goToMove);

  const [sort, setSort] = useAtom<SortStatus>(sortStatusAtom);
  const sortedMissingMoves = useMemo(
    () =>
      missingMoves.sort((a, b) => {
        if (sort.direction === "desc") {
          if (sort.columnAccessor === "move") {
            return b.position.length - a.position.length;
          }
          if (sort.columnAccessor === "games") {
            return b.games - a.games;
          }
          if (sort.columnAccessor === "percentage") {
            return b.percentage - a.percentage;
          }
        }
        if (sort.columnAccessor === "move") {
          return a.position.length - b.position.length;
        }
        if (sort.columnAccessor === "games") {
          return a.games - b.games;
        }
        return a.percentage - b.percentage;
      }),
    [missingMoves, sort],
  );

  return (
    <DataTable
      withTableBorder
      emptyState={<Text py={200}>No missing moves found</Text>}
      highlightOnHover
      records={sortedMissingMoves}
      onRowClick={({ record }) => goToMove(record.position)}
      sortStatus={sort}
      onSortStatusChange={setSort}
      groups={[
        {
          id: "Missing Moves",
          title: (
            <Group gap="xs">
              <Text>Missing Moves</Text>
              <Tooltip label="Refresh moves">
                <ActionIcon variant="subtle" onClick={search}>
                  <IconReload size="1rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          ),
          columns: [
            {
              accessor: "move",
              sortable: true,
              render: ({ move, position }) => {
                const total_moves = position.length + 1;
                const is_white = total_moves % 2 === 1;
                const move_number = Math.ceil(total_moves / 2);
                return (
                  <div>
                    <Text>
                      {move_number.toString()}
                      {is_white ? ". " : "... "}
                      <Text span fw="bold">
                        {move}
                      </Text>
                    </Text>
                  </div>
                );
              },
            },
            {
              accessor: "games",
              sortable: true,
            },
            {
              accessor: "percentage",
              sortable: true,
              render: ({ percentage }) => (
                <Text>{(percentage * 100).toFixed(1)}%</Text>
              ),
            },
          ],
        },
      ]}
      noRecordsText="No games found"
    />
  );
}

export default RepertoireInfo;
