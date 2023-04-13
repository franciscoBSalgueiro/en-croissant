import { Checkbox, Group, Stack, Text, Textarea } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { useContext } from "react";
import { NormalizedGame } from "../../../utils/db";
import TreeContext from "../../common/TreeContext";

function PgnInput({ game }: { game: NormalizedGame }) {
  const tree = useContext(TreeContext);
  const [comments, toggleComments] = useToggle([true, false]);
  const [symbols, toggleSymbols] = useToggle([true, false]);
  const [variations, toggleVariations] = useToggle([true, false]);
  const [specialSymbols, toggleSpecialSymbols] = useToggle();
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
            checked={symbols}
            onChange={() => toggleSymbols()}
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
            checked={specialSymbols}
            onChange={() => toggleSpecialSymbols()}
          />
        </Group>
        <Textarea
          readOnly
          value={root.getPGN({
            headers: game,
            symbols,
            comments,
            variations,
            specialSymbols,
          })}
        />
      </Stack>
    </>
  );
}

export default PgnInput;
