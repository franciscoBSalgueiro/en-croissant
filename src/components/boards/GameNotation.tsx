import {
  ActionIcon,
  Box,
  Button,
  Menu,
  Overlay,
  Paper,
  TypographyStylesProvider,
  useMantineTheme
} from "@mantine/core";
import { useClickOutside, useForceUpdate, useToggle } from "@mantine/hooks";
import {
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconEyeOff,
  IconTrash
} from "@tabler/icons";
import { useContext } from "react";
import { Annotation, annotationColor, VariationTree } from "../../utils/chess";
import { TreeContext } from "./BoardAnalysis";

function GameNotation({ setTree }: { setTree: (tree: VariationTree) => void }) {
  const tree = useContext(TreeContext);
  const theme = useMantineTheme();
  const topVariation = tree.getTopVariation();
  const [visible, toggleVisible] = useToggle();

  return (
    <Paper withBorder p="md" sx={{ minHeight: "250px", position: "relative" }}>
      <Box
        sx={{
          position: "absolute",
          top: "10px",
          right: "10px",
          display: "flex",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <ActionIcon onClick={() => toggleVisible()}>
          {visible ? <IconEyeOff size={15} /> : <IconEye size={15} />}
        </ActionIcon>
      </Box>
      {visible && (
        <Overlay
          opacity={0.6}
          color={theme.colorScheme === "dark" ? "#222" : undefined}
          blur={3}
          zIndex={2}
        />
      )}

      <RenderVariationTree
        tree={topVariation}
        depth={0}
        first
        setTree={setTree}
      />
    </Paper>
  );
}

function RenderVariationTree({
  tree,
  depth,
  first,
  setTree,
}: {
  tree: VariationTree;
  depth: number;
  first?: boolean;
  setTree: (tree: VariationTree) => void;
}) {
  const lastMove = tree.move;
  const variations = tree.children;
  const move_number = Math.ceil(tree.half_moves / 2);
  const is_white = tree.half_moves % 2 === 1;
  return (
    <>
      <span>
        {tree.half_moves > 0 && (first || is_white) && (
          <span style={{ paddingLeft: tree.half_moves == 1 || first ? 0 : 12 }}>
            {move_number}
            {is_white ? "." : "..."}
          </span>
        )}

        {lastMove && (
          <MoveCell
            move={lastMove.san}
            variation={tree}
            setTree={setTree}
            annotation={tree.annotation}
            comment={tree.commentHTML}
          />
        )}
        {tree.children.length > 0 && (
          <RenderVariationTree
            tree={tree.children[0]}
            depth={depth + 1}
            setTree={setTree}
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
}: {
  move: string;
  variation: VariationTree;
  annotation: Annotation;
  comment: string;
  setTree: (tree: VariationTree) => void;
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
  const forceUpdate = useForceUpdate();

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
