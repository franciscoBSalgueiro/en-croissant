import { TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { validateFen } from "chess.js";

function FenInput({ setBoardFen }: { setBoardFen: (fen: string) => void }) {
  const form = useForm({
    initialValues: {
      fen: "",
      pgn: "",
    },
    validate: {
      fen: (value) => {
        const v = validateFen(value);
        if (v.valid) {
          return null;
        } else {
          return v.error;
        }
      },
      pgn: (value) => {
        return null;
      }
    },
  });
  return (
    <form onSubmit={form.onSubmit(() => setBoardFen(form.values.fen))}>
      <TextInput
        label="FEN"
        placeholder="Enter FEN"
        {...form.getInputProps("fen")}
      />
      <TextInput
        label="PGN"
        placeholder="Enter PGN"
        {...form.getInputProps("pgn")}
      />
    </form>
  );
}

export default FenInput;
