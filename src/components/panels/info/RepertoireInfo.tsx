import { referenceDbAtom } from "@/atoms/atoms";
import MoveCell from "@/components/boards/MoveCell";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import { Annotation } from "@/utils/chess";
import { MissingMove, openingReport } from "@/utils/repertoire";
import { Progress, Text } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useContext, useEffect, useState } from "react";

function RepertoireInfo() {
  const { headers, root } = useContext(TreeStateContext);
  const referenceDb = useAtomValue(referenceDbAtom);

  const [missingMoves, setMissingMoves] = useState<MissingMove[]>([]);
  const [loading, setLoading] = useState(false);
  const dispatch = useContext(TreeDispatchContext);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
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
    }).then((missingMoves) => {
      setMissingMoves(missingMoves);
      setLoading(false);
    });
  }, [headers.orientation, headers.start, referenceDb, root]);

  return (
    <>
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
                  annotation={Annotation.None}
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
