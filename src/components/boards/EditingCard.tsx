import { Card, CloseButton, Divider, createStyles } from "@mantine/core";
import FenInput from "../panels/info/FenInput";
import PiecesGrid from "./PiecesGrid";
import { TreeDispatchContext } from "../common/TreeStateContext";
import { useContext } from "react";

const useStyles = createStyles((theme) => ({
  card: {
    position: "sticky",
    top: 0,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    zIndex: 10,
  },
}));

function EditingCard({
  fen,
  boardRef,
  setEditingMode,
}: {
  fen: string;
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  setEditingMode: (editing: boolean) => void;
}) {
  const { classes } = useStyles();
  const dispatch = useContext(TreeDispatchContext);

  return (
    <Card
      shadow="md"
      style={{ overflow: "visible", position: "relative" }}
      className={classes.card}
    >
      <CloseButton
        sx={{ position: "absolute", top: 10, right: 15 }}
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
      />
    </Card>
  );
}

export default EditingCard;
