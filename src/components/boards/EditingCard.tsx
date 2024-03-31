import { Card, CloseButton, Divider } from "@mantine/core";
import { useContext } from "react";
import { useStore } from "zustand";
import { TreeStateContext } from "../common/TreeStateContext";
import FenInput from "../panels/info/FenInput";
import * as classes from "./EditingCard.css";
import PiecesGrid from "./PiecesGrid";

function EditingCard({
  boardRef,
  setEditingMode,
}: {
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  setEditingMode: (editing: boolean) => void;
}) {
  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const headers = useStore(store, (s) => s.headers);
  const setFen = useStore(store, (s) => s.setFen);

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
          setFen(newFen);
        }}
        orientation={headers.orientation}
      />
    </Card>
  );
}

export default EditingCard;
