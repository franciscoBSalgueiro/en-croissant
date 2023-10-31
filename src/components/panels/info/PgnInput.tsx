import {
  ActionIcon,
  Box,
  Checkbox,
  CopyButton,
  Group,
  Stack,
  Text,
  Textarea,
  Tooltip,
  rem,
} from "@mantine/core";
import { memo, useMemo } from "react";
import { getPGN } from "@/utils/chess";
import { GameHeaders, TreeNode } from "@/utils/treeReducer";
import { useAtom } from "jotai";
import { currentPgnOptionsAtom } from "@/atoms/atoms";
import { IconCheck, IconCopy } from "@tabler/icons-react";

function PgnInput({ root, headers }: { root: TreeNode; headers: GameHeaders }) {
  const [options, setOptions] = useAtom(currentPgnOptionsAtom);

  const pgn = getPGN(root, {
    headers: headers,
    symbols: options.annotations,
    comments: options.comments,
    variations: options.variations,
    specialSymbols: options.symbols,
  });

  const controls = useMemo(
    () => (
      <>
        <Text fw="bold">PGN</Text>
        <Group my="sm">
          <Checkbox
            label="Comments"
            size="xs"
            checked={options.comments}
            onChange={() =>
              setOptions({ ...options, comments: !options.comments })
            }
          />
          <Checkbox
            label="Symbols"
            size="xs"
            checked={options.annotations}
            onChange={() =>
              setOptions({ ...options, annotations: !options.annotations })
            }
          />
          <Checkbox
            label="Variations"
            size="xs"
            checked={options.variations}
            onChange={() =>
              setOptions({ ...options, variations: !options.variations })
            }
          />
          <Checkbox
            label="Special Symbols"
            size="xs"
            checked={options.symbols}
            onChange={() =>
              setOptions({ ...options, symbols: !options.symbols })
            }
          />
        </Group>
      </>
    ),
    [options, setOptions]
  );

  const pgnArea = useMemo(
    () => (
      <Box sx={{ position: "relative" }}>
        <Textarea readOnly autosize value={pgn} />
        <CopyButton value={pgn} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? "Copied" : "Copy"}
              withArrow
              position="right"
            >
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                onClick={copy}
                sx={{ position: "absolute", top: 15, right: 15 }}
              >
                {copied ? (
                  <IconCheck style={{ width: rem(16) }} />
                ) : (
                  <IconCopy style={{ width: rem(16) }} />
                )}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Box>
    ),
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
