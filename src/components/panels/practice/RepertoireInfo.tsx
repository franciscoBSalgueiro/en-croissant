import {
  currentTabAtom,
  minimumGamesAtom,
  missingMovesAtom,
  percentageCoverageAtom,
  referenceDbAtom,
} from "@/atoms/atoms";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import { MissingMove, getTreeStats, openingReport } from "@/utils/repertoire";
import {
  ActionIcon,
  Button,
  Group,
  Progress,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconReload } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { DataTable } from "mantine-datatable";
import { useContext, useMemo, useState } from "react";

function RepertoireInfo() {
  const { headers, root } = useContext(TreeStateContext);
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
      throw Error("No refernce database selected");
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

function MissingMoves({
  missingMoves,
  search,
}: {
  missingMoves: MissingMove[];
  search: () => void;
}) {
  const dispatch = useContext(TreeDispatchContext);

  return (
    <DataTable
      withTableBorder
      emptyState={<Text py={200}>No missing moves found</Text>}
      highlightOnHover
      records={missingMoves}
      onRowClick={({ record }) =>
        dispatch({
          type: "GO_TO_MOVE",
          payload: record.position,
        })
      }
      groups={[
        {
          id: "Missing Moves",
          title: (
            <Group gap="xs">
              <Text>Missing Moves</Text>
              <Tooltip label="Refresh moves">
                <ActionIcon onClick={search}>
                  <IconReload size="1rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          ),
          columns: [
            {
              accessor: "move",
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
            },
            {
              accessor: "percentage",
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
