import {
  Card,
  CloseButton,
  Divider,
  SimpleGrid,
  createStyles,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { useContext } from "react";
import Piece from "../common/Piece";
import { TreeDispatchContext } from "../common/TreeStateContext";
import FenInput from "../panels/info/FenInput";

const pieces = ["p", "n", "b", "r", "q", "k"] as const;
const colors = ["w", "b"] as const;

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
  const dispatch = useContext(TreeDispatchContext);
  const { classes } = useStyles();

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
      <SimpleGrid cols={6}>
        {colors.map((color) =>
          pieces.map((piece) => (
            <Piece
              key={piece + color}
              putPiece={(to, piece) => {
                invoke<string>("put_piece", {
                  fen,
                  piece: piece.type,
                  square: to,
                  color: piece.color,
                }).then((newFen) => {
                  dispatch({
                    type: "SET_FEN",
                    payload: newFen,
                  });
                });
              }}
              boardRef={boardRef}
              piece={{
                type: piece,
                color,
              }}
            />
          ))
        )}
      </SimpleGrid>
    </Card>
  );
}

export default EditingCard;
