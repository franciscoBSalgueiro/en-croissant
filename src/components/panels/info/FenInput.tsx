import { Stack, Text, TextInput } from "@mantine/core";
import { UseFormReturnType } from "@mantine/form";

function FenInput({
  form,
  onSubmit,
}: {
  form: UseFormReturnType<{ fen: string }>;
  onSubmit: (fen: string) => void;
}) {
  return (
    <Stack spacing="sm">
      <Text fw="bold">FEN</Text>
      <form onSubmit={form.onSubmit(() => onSubmit(form.values.fen))}>
        <TextInput placeholder="Enter FEN" {...form.getInputProps("fen")} />
      </form>
    </Stack>
  );
}

export default FenInput;
