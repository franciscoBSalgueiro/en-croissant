import {
  ActionIcon,
  Button,
  CopyButton,
  createStyles,
  Divider,
  Group,
  Menu,
  Overlay,
  Paper,
  ScrollArea,
  Stack,
  Tooltip,
  TypographyStylesProvider,
  useMantineTheme
} from "@mantine/core";
import { useClickOutside, useForceUpdate, useToggle } from "@mantine/hooks";
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconTrash
} from "@tabler/icons";
import { useContext } from "react";
import { Annotation, annotationColor, VariationTree } from "../../utils/chess";
import TreeContext from "../common/TreeContext";
import OpeningName from "./OpeningName";

const useStyles = createStyles((theme) => ({
  scroller: {
    position: "sticky",
    top: 0,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    zIndex: 10,
  },
}));

function GameNotation({ setTree }: { setTree: (tree: VariationTree) => void }) {
  const forceUpdate = useForceUpdate();
  const tree = useContext(TreeContext);
  const theme = useMantineTheme();
  const topVariation = tree.getTopVariation();
  const [invisible, toggleVisible] = useToggle();
  const { classes } = useStyles();

  return (
    <Paper withBorder p="md" sx={{ position: "relative" }}>
      {invisible && (
        <Overlay
          opacity={0.6}
          color={theme.colorScheme === "dark" ? "#222" : undefined}
          blur={3}
          zIndex={2}
        />
      )}
      <ScrollArea style={{ maxHeight: "200px" }} offsetScrollbars>
        <Stack>
          <Stack className={classes.scroller}>
            <Group style={{ justifyContent: "space-between" }}>
              <OpeningName />
              <Group spacing="sm">
                <Tooltip label={invisible ? "Hide moves" : "Show moves"}>
                  <ActionIcon onClick={() => toggleVisible()}>
                    {invisible ? (
                      <IconEyeOff size={15} />
                    ) : (
                      <IconEye size={15} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={topVariation.getPGN()} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow>
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        onClick={copy}
                      >
                        {copied ? (
                          <IconCheck size={15} />
                        ) : (
                          <IconCopy size={15} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <Divider />
          </Stack>
          <RenderVariationTree
            tree={topVariation}
            depth={0}
            first
            setTree={setTree}
            forceUpdate={forceUpdate}
          />
        </Stack>
      </ScrollArea>
    </Paper>
  );
}

function RenderVariationTree({
  tree,
  depth,
  first,
  setTree,
  forceUpdate,
}: {
  tree: VariationTree;
  depth: number;
  first?: boolean;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
}) {
  const lastMove = tree.move;
  const variations = tree.children;
  const move_number = Math.ceil(tree.half_moves / 2);
  const is_white = tree.half_moves % 2 === 1;
  return (
    <>
      <span>
        <span style={{ display: "inline-block" }}>
          {tree.half_moves > 0 && (first || is_white) && (
            <span>
              {move_number}
              {is_white ? "." : "..."}
            </span>
          )}
          <span
            style={{
              paddingRight:
                tree.half_moves !== 0 && tree.half_moves % 2 == 0 ? 12 : 0,
            }}
          >
            {lastMove && (
              <MoveCell
                move={lastMove.san}
                variation={tree}
                setTree={setTree}
                annotation={tree.annotation}
                comment={tree.commentHTML}
                forceUpdate={forceUpdate}
              />
            )}
          </span>
        </span>

        {tree.children.length > 0 && (
          <RenderVariationTree
            tree={tree.children[0]}
            depth={depth + 1}
            setTree={setTree}
            forceUpdate={forceUpdate}
          />
        )}
      </span>

      {variations.slice(1).map((variation) => (
        <>
          {depth == 1 ? (
            <div>
              {"("}
              <RenderVariationTree
                tree={variation}
                depth={depth + 2}
                setTree={setTree}
                first
                forceUpdate={forceUpdate}
              />
              {")"}
            </div>
          ) : (
            <>
              {"("}
              <RenderVariationTree
                tree={variation}
                depth={depth + 2}
                setTree={setTree}
                first
                forceUpdate={forceUpdate}
              />
              {")"}
            </>
          )}
        </>
      ))}
    </>
  );
}

function MoveCell({
  move,
  variation,
  annotation,
  comment,
  setTree,
  forceUpdate,
}: {
  move: string;
  variation: VariationTree;
  annotation: Annotation;
  comment: string;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
}) {
  const tree = useContext(TreeContext);
  const theme = useMantineTheme();
  const isCurrentVariation = variation.equals(tree);
  const [open, toggleOpen] = useToggle();
  const ref = useClickOutside(() => toggleOpen(false));
  const color = annotationColor(annotation);
  const multipleLine =
    comment.split("</p>").length - 1 > 1 ||
    comment.includes("<blockquote>") ||
    comment.includes("<ul>") ||
    comment.includes("<h");

  function promoteVariation(variation: VariationTree) {
    const isCurrent = variation === tree;
    const parent = variation.parent;
    if (parent) {
      parent.children = [
        variation,
        ...parent.children.filter((child) => child !== variation),
      ];
      if (isCurrent) {
        forceUpdate();
      } else {
        setTree(variation);
      }
    }
  }

  function demoteVariation(variation: VariationTree) {
    const isCurrent = variation === tree;
    const parent = variation.parent;
    if (parent) {
      parent.children = [
        ...parent.children.filter((child) => child !== variation),
        variation,
      ];
      if (isCurrent) {
        forceUpdate();
      } else {
        setTree(variation);
      }
    }
  }

  function deleteVariation(variation: VariationTree) {
    const isInCurrentBranch = tree.isInBranch(variation);
    const parent = variation.parent;
    if (parent) {
      parent.children = parent.children.filter((child) => child !== variation);
      if (isInCurrentBranch) {
        setTree(parent);
      } else {
        forceUpdate();
      }
    }
  }

  return (
    <>
      <Menu opened={open} width={200}>
        <Menu.Target ref={ref}>
          <Button
            p={4}
            variant={isCurrentVariation ? "light" : "subtle"}
            color={
              isCurrentVariation && tree.annotation === Annotation.None
                ? theme.colors[theme.primaryColor][0]
                : color
            }
            onContextMenu={(e: any) => {
              toggleOpen();
              e.preventDefault();
            }}
            onClick={() => {
              setTree(variation);
              toggleOpen(false);
            }}
          >
            {move + annotation}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Actions</Menu.Label>
          <Menu.Item
            icon={<IconChevronUp size={14} />}
            onClick={() => promoteVariation(variation)}
            disabled={
              tree.parent === null ||
              tree.parent.children.length === 1 ||
              variation === tree.parent.children[0]
            }
          >
            Promote Variation
          </Menu.Item>
          <Menu.Item
            icon={<IconChevronDown size={14} />}
            onClick={() => demoteVariation(variation)}
            disabled={
              tree.parent === null ||
              tree.parent.children.length === 1 ||
              variation ===
                tree.parent.children[tree.parent.children.length - 1]
            }
          >
            Demote Variation
          </Menu.Item>
          <Menu.Item
            color="red"
            icon={<IconTrash size={14} />}
            onClick={() => deleteVariation(variation)}
          >
            Delete Move
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {comment && (
        <TypographyStylesProvider
          style={{
            display: multipleLine ? "block" : "inline-block",
            marginLeft: 4,
            marginRight: 4,
          }}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: comment,
            }}
          />
        </TypographyStylesProvider>
      )}
    </>
  );
}

export default GameNotation;
