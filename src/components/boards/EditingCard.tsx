import { Card, CloseButton, Divider } from "@mantine/core";
import { useContext } from "react";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import FenInput from "../panels/info/FenInput";
import * as classes from "./EditingCard.css";
import PiecesGrid from "./PiecesGrid";

function EditingCard({
  fen,
  boardRef,
  setEditingMode,
}: {
  fen: string;
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  setEditingMode: (editing: boolean) => void;
}) {
  const { headers } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);

  return (
    <Card
      shadow="md"
      style={{ position: "relative", overflow: "visible" }}
      className={classes.card}
    >
      <CloseButton
        style={{ position: "absolute", top: 10, right: 15 }}
        onClick={() => setEditingMode(false)}
      />
      <FenInput currentFen={fen} />
      <Divider my="md" />
      <PiecesGrid
        fen={fen}
        boardRef={boardRef}
        onPut={(newFen) => {
          dispatch({
            type: "SET_FEN",
            payload: newFen,
          });
        }}
        orientation={headers.orientation}
      />
    </Card>
  );
}

export default EditingCard;
