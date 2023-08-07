import {
  currentTabAtom,
  minimumGamesAtom,
  percentageCoverageAtom,
  referenceDbAtom,
} from "@/atoms/atoms";
import MoveCell from "@/components/boards/MoveCell";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import { Annotation } from "@/utils/chess";
import { MissingMove, getTreeStats, openingReport } from "@/utils/repertoire";
import { Button, Divider, Group, Progress, Select, Text } from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { useContext, useMemo, useState } from "react";

function RepertoireInfo() {
  const { headers, root } = useContext(TreeStateContext);
  const referenceDb = useAtomValue(referenceDbAtom);

  const currentTab = useAtomValue(currentTabAtom);

  const [missingMoves, setMissingMoves] = useSessionStorage<MissingMove[]>({
    key: currentTab!.value + "-missing-moves",
    defaultValue: [],
  });
  const [loading, setLoading] = useState(false);
  const dispatch = useContext(TreeDispatchContext);
  const [progress, setProgress] = useState(0);
  const percentageCoverage = useAtomValue(percentageCoverageAtom);
  const minimumGames = useAtomValue(minimumGamesAtom);

  const stats = useMemo(() => getTreeStats(root), [root]);

  function searchForMissingMoves() {
    if (!referenceDb) {
      return;
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
      setMissingMoves(missingMoves);
      setLoading(false);
    });
  }

  return (
    <>
      <Group mx="auto" spacing={4}>
        <Text>An opening for</Text>

        <Select
          value={headers.orientation || "white"}
          variant="unstyled"
          rightSection={<></>}
          rightSectionWidth={0}
          sx={{
            width: 80,
            "& input": { paddingRight: 0, fontWeight: 500, fontSize: "1rem" },
          }}
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

      <Text>Variations: {stats.leafs}</Text>
      <Text>Max Depth: {stats.depth}</Text>
      <Text>Total moves: {stats.total}</Text>
      <Divider />
      {!loading && !missingMoves.length && (
        <Button onClick={() => searchForMissingMoves()}>
          Look for missing moves
        </Button>
      )}
      {loading ? (
        <>
          <Text>Analyzing Repertoire</Text>
          <Progress value={progress} />
        </>
      ) : (
        <div>
          <Text>Missing moves</Text>
          {missingMoves.map((missingMove) => {
            const total_moves = missingMove.position.length + 1;
            const is_white = total_moves % 2 === 1;
            const move_number = Math.ceil(total_moves / 2);
            return (
              <div key={missingMove.move}>
                <>{`${move_number.toString()}${is_white ? "." : "..."}`}</>

                <MoveCell
                  annotation={""}
                  isCurrentVariation={false}
                  move={missingMove.move}
                  onClick={() =>
                    dispatch({
                      type: "GO_TO_MOVE",
                      payload: missingMove.position,
                    })
                  }
                  onContextMenu={() => undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default RepertoireInfo;
