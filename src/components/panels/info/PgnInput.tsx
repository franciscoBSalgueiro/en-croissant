import { Checkbox, Group, Stack, Text, Textarea } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { memo, useMemo } from "react";
import { getPGN } from "../../../utils/chess";
import { GameHeaders, TreeNode } from "../../../utils/treeReducer";

function PgnInput({ root, headers }: { root: TreeNode; headers: GameHeaders }) {
  const [comments, toggleComments] = useToggle([true, false]);
  const [annotations, toggleAnnotations] = useToggle([true, false]);
  const [variations, toggleVariations] = useToggle([true, false]);
  const [symbols, toggleSymbols] = useToggle();

  const pgn = getPGN(root, {
    headers: headers,
    symbols: annotations,
    comments,
    variations,
    specialSymbols: symbols,
  });

  const controls = useMemo(
    () => (
      <>
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
      </>
    ),
    [comments, annotations, variations, symbols]
  );

  const pgnArea = useMemo(
    () => <Textarea readOnly autosize value={pgn} />,
    [pgn]
  );

  return (
    <Stack spacing={0}>
      {controls}
      {pgnArea}
    </Stack>
  );
}

export default memo(PgnInput);
