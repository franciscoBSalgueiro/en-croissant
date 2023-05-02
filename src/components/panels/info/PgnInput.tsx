import { Checkbox, Group, Stack, Text, Textarea } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { NormalizedGame } from "../../../utils/db";

function PgnInput({ game }: { game: NormalizedGame }) {
  const tree = game.tree;
  const [comments, toggleComments] = useToggle([true, false]);
  const [annotations, toggleAnnotations] = useToggle([true, false]);
  const [variations, toggleVariations] = useToggle([true, false]);
  const [symbols, toggleSymbols] = useToggle();
  const root = tree.getTopVariation();
  return (
    <>
      <Stack spacing={0}>
        <Text fw="bold">PGN</Text>
        <Group my="sm">
          <Checkbox
            label="Comments"
            size="xs"
            checked={comments}
            onChange={() => toggleComments()}
          />
          <Checkbox
            label="Symbols"
            size="xs"
            checked={annotations}
            onChange={() => toggleAnnotations()}
          />
          <Checkbox
            label="Variations"
            size="xs"
            checked={variations}
            onChange={() => toggleVariations()}
          />
          <Checkbox
            label="Special Symbols"
            size="xs"
            checked={symbols}
            onChange={() => toggleSymbols()}
          />
        </Group>
        <Textarea
          readOnly
          autosize
          value={root.getPGN({
            headers: game,
            symbols: annotations,
            comments,
            variations,
            specialSymbols: symbols,
          })}
        />
      </Stack>
    </>
  );
}

export default PgnInput;
