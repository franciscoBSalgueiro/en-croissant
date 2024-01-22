import { currentPgnOptionsAtom } from "@/atoms/atoms";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import { getPGN, parsePGN } from "@/utils/chess";
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  CopyButton,
  Group,
  Stack,
  Text,
  Textarea,
  Tooltip,
  rem,
} from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import deepEqual from "fast-deep-equal";
import { useAtom } from "jotai";
import { useContext, useEffect, useMemo, useState } from "react";

function PgnInput() {
  const { root, headers, position } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const [options, setOptions] = useAtom(currentPgnOptionsAtom);

  const realPGN = useMemo(
    () =>
      getPGN(root, {
        headers: headers,
        glyphs: true,
        comments: true,
        variations: true,
        extraMarkups: true,
      }),
    [root, headers],
  );

  const pgn = useMemo(
    () =>
      getPGN(root, {
        headers: headers,
        glyphs: options.glyphs,
        comments: options.comments,
        variations: options.variations,
        extraMarkups: options.extraMarkups,
      }),
    [root, headers, options],
  );

  const [tmp, setTmp] = useState(pgn);

  useEffect(() => {
    setTmp(pgn);
  }, [pgn]);

  const controls = (
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
          label="Glyphs"
          size="xs"
          checked={options.glyphs}
          onChange={() => setOptions({ ...options, glyphs: !options.glyphs })}
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
          label="Extra Markups"
          size="xs"
          checked={options.extraMarkups}
          onChange={() =>
            setOptions({ ...options, extraMarkups: !options.extraMarkups })
          }
        />
      </Group>
    </>
  );

  async function updatePgn() {
    const tree = await parsePGN(tmp);
    tree.dirty = true;
    tree.position = position;

    if (deepEqual(tree.root, root) && deepEqual(tree.headers, headers)) {
      setTmp(pgn);
    } else {
      dispatch({
        type: "SET_STATE",
        payload: tree,
      });
    }
  }

  const pgnArea = (
    <Box style={{ position: "relative" }}>
      <Textarea
        autosize
        value={tmp}
        onChange={(e) => setTmp(e.currentTarget.value)}
      />
      <CopyButton value={tmp} timeout={2000}>
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
              style={{ position: "absolute", top: 15, right: 15 }}
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
      {realPGN !== tmp && (
        <Button
          style={{ position: "absolute", bottom: 15, right: 15 }}
          onClick={() => updatePgn()}
        >
          Update
        </Button>
      )}
    </Box>
  );

  return (
    <Stack gap={0}>
      {controls}
      {pgnArea}
    </Stack>
  );
}

export default PgnInput;
