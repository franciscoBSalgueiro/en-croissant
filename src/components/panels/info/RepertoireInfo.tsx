import {
  currentPracticingAtom,
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
import { MissingMove, openingReport } from "@/utils/repertoire";
import { Button, Group, Progress, Select, Stack, Text } from "@mantine/core";
import { IconReload, IconTargetArrow } from "@tabler/icons-react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { useContext, useState } from "react";

function RepertoireInfo() {
  const { headers, root } = useContext(TreeStateContext);
  const referenceDb = useAtomValue(referenceDbAtom);
  const currentTab = useAtomValue(currentTabAtom);

  const [allMissingMoves, setMissingMoves] = useAtom(missingMovesAtom);
  const missingMoves = allMissingMoves[currentTab!.value];
  const [loading, setLoading] = useState(false);
  const dispatch = useContext(TreeDispatchContext);
  const [progress, setProgress] = useState(0);
  const percentageCoverage = useAtomValue(percentageCoverageAtom);
  const minimumGames = useAtomValue(minimumGamesAtom);
  const setPracticing = useSetAtom(currentPracticingAtom);

  function searchForMissingMoves() {
    if (!referenceDb) {
      throw Error("No refernce database selected");
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
        [currentTab!.value]: missingMoves,
      }));
      setLoading(false);
    });
  }

  return (
    <Stack>
      <Group mx="md" gap={4}>
        <Text>opening for</Text>

        <Select
          value={headers.orientation || "white"}
          variant="unstyled"
          rightSection={<></>}
          rightSectionWidth={0}
          onChange={(value) =>
            dispatch({
              type: "SET_ORIENTATION",
              payload: value === "white" ? "white" : "black",
            })
          }
          data={[
            {
              value: "white",
              label: "White",
            },
            {
              value: "black",
              label: "Black",
            },
          ]}
        />
      </Group>

      <Group>
        <Button
          variant="default"
          onClick={() => setPracticing(true)}
          leftSection={<IconTargetArrow />}
        >
          Practice
        </Button>

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
    <div>
      <DataTable
        withTableBorder
        h={200}
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

      <Button
        variant="default"
        mt={20}
        rightSection={<IconReload />}
        onClick={search}
      >
        Reload missing moves
      </Button>
    </div>
  );
}

export default RepertoireInfo;
