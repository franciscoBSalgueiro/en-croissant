import { Card, CloseButton, Divider, ScrollArea } from "@mantine/core";
import type { Piece } from "chessops";
import { useContext } from "react";
import { useStore } from "zustand";
import { TreeStateContext } from "../common/TreeStateContext";
import FenInput from "../panels/info/FenInput";
import classes from "./EditingCard.module.css";
import PiecesGrid from "./PiecesGrid";

function EditingCard({
  boardRef,
  setEditingMode,
  selectedPiece,
  setSelectedPiece,
}: {
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  setEditingMode: (editing: boolean) => void;
  selectedPiece: Piece | null;
  setSelectedPiece: (piece: Piece | null) => void;
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
      withBorder
    >
      <CloseButton
        style={{ position: "absolute", top: 10, right: 15, zIndex: 1 }}
        onClick={() => setEditingMode(false)}
      />
      <ScrollArea flex={1} offsetScrollbars>
        <FenInput currentFen={fen} />
        <Divider my="md" />
        <PiecesGrid
          fen={fen}
          boardRef={boardRef}
          onPut={(newFen) => {
            setFen(newFen);
          }}
          selectedPiece={selectedPiece}
          onSelectPiece={setSelectedPiece}
          orientation={headers.orientation}
        />
      </ScrollArea>
    </Card>
  );
}

export default EditingCard;
