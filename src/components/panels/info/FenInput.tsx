import { TextInput } from "@mantine/core";
import { UseFormReturnType } from "@mantine/form";

function FenInput({
  form,
  onSubmit,
}: {
  form: UseFormReturnType<{ fen: string }>;
  onSubmit: (fen: string) => void;
}) {
  return (
    <form onSubmit={form.onSubmit(() => onSubmit(form.values.fen))}>
      <TextInput
        label="FEN"
        placeholder="Enter FEN"
        {...form.getInputProps("fen")}
      />
    </form>
  );
}

export default FenInput;
