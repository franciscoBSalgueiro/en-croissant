import {
  Accordion,
  ActionIcon,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useForceUpdate, useHotkeys, useLocalStorage } from "@mantine/hooks";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconInfoCircle,
  IconNotes,
  IconZoomCheck
} from "@tabler/icons";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Chess, DEFAULT_POSITION, Square, validateFen } from "chess.js";
import { createContext, useEffect, useState } from "react";
import { Annotation, VariationTree } from "../utils/chess";
import { Engine } from "../utils/engines";
import AnnotationPanel from "./AnnotationPanel";
import BestMoves from "./BestMoves";
import Chessboard from "./Chessboard";
import EngineSettingsBoard from "./EngineSettingsBoard";
import FenInput from "./FenInput";
import GameNotation from "./GameNotation";

export const TreeContext = createContext(
  new VariationTree(null, DEFAULT_POSITION, null)
);

function BoardAnalysis() {
  const forceUpdate = useForceUpdate();
  const [selectedEngines, setSelectedEngines] = useLocalStorage<Engine[]>({
    key: "selected-engines",
    defaultValue: [],
  });
  const form = useForm({
    initialValues: {
      fen: DEFAULT_POSITION,
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
    },
  });

  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(
    new VariationTree(null, form.values.fen, null)
  );
  const chess = new Chess(tree.fen);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Placeholder.configure({ placeholder: "Write here..." }),
      ],
      content: tree.comment,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        if (html === "<p></p>") {
          tree.comment = "";
        } else {
          tree.comment = html;
        }
        setTree(tree);
      },
    },
    [tree]
  );

  function annotate(annotation: Annotation) {
    if (tree.annotation === annotation) {
      tree.annotation = Annotation.None;
    } else {
      tree.annotation = annotation;
    }
    setTree(tree);
    forceUpdate();
  }

  function makeMove(move: { from: Square; to: Square; promotion?: string }) {
    const newMove = chess.move(move);
    const newTree = new VariationTree(tree, chess.fen(), newMove);
    if (tree.children.length === 0) {
      tree.children = [newTree];
    } else if (tree.children.every((child) => child.fen !== chess.fen())) {
      tree.children.push(newTree);
    }
    setTree(newTree);
  }

  function makeMoves(moves: string[]) {
    let parentTree = tree;
    let newTree = tree;
    moves.forEach((move) => {
      const newMove = chess.move(move, { sloppy: true });
      newTree = new VariationTree(parentTree, chess.fen(), newMove);
      if (parentTree.children.length === 0) {
        parentTree.children = [newTree];
      } else if (parentTree.children[0].fen !== chess.fen()) {
        parentTree.children.push(newTree);
      }
      parentTree = newTree;
    });
    setTree(newTree);
  }

  function undoMove() {
    if (tree.parent) {
      setTree(tree.parent);
    }
  }

  function redoMove() {
    if (tree.children.length > 0) {
      setTree(tree.children[0]);
    }
  }

  function goToStart() {
    setTree(tree.getTopVariation());
  }

  function goToEnd() {
    setTree(tree.getBottomVariation());
  }

  function resetToFen(fen: string) {
    setTree(new VariationTree(null, fen, null));
  }

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
  ]);

  useEffect(() => {
    form.setValues({ fen: tree.fen });
  }, [tree]);

  return (
    <TreeContext.Provider value={tree}>
      <SimpleGrid cols={2} breakpoints={[{ maxWidth: 800, cols: 1 }]}>
        <Chessboard makeMove={makeMove} />

        <Stack>
          <Tabs defaultValue="analysis">
            <Tabs.List grow>
              <Tabs.Tab value="analysis" icon={<IconZoomCheck size={16} />}>
                Analysis
              </Tabs.Tab>
              <Tabs.Tab value="annotate" icon={<IconNotes size={16} />}>
                Annotate
              </Tabs.Tab>
              <Tabs.Tab value="info" icon={<IconInfoCircle size={16} />}>
                Info
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="info" pt="xs">
              <FenInput form={form} onSubmit={resetToFen} />
            </Tabs.Panel>
            <Tabs.Panel value="annotate" pt="xs">
              <AnnotationPanel
                editor={editor}
                curAnnotation={tree.annotation}
                annotate={annotate}
              />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" pt="xs">
              <ScrollArea
                style={{ height: "40vh" }}
                offsetScrollbars
                type="always"
              >
                <Stack>
                  <Accordion variant="separated" multiple chevronSize={0}>
                    {selectedEngines.map((engine) => {
                      return (
                        <BestMoves
                          key={engine.name}
                          engine={engine}
                          makeMoves={makeMoves}
                        />
                      );
                    })}
                  </Accordion>
                  <EngineSettingsBoard
                    selectedEngines={selectedEngines}
                    setSelectedEngines={setSelectedEngines}
                  />
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
          <GameNotation setTree={setTree} />
          <MoveControls />
        </Stack>
      </SimpleGrid>
    </TreeContext.Provider>
  );

  function MoveControls() {
    return (
      <Group grow>
        <ActionIcon variant="light" size="xl" onClick={() => goToStart()}>
          <IconChevronsLeft />
        </ActionIcon>
        <ActionIcon variant="light" size="xl" onClick={() => undoMove()}>
          <IconChevronLeft />
        </ActionIcon>
        <ActionIcon variant="light" size="xl" onClick={() => redoMove()}>
          <IconChevronRight />
        </ActionIcon>
        <ActionIcon variant="light" size="xl" onClick={() => goToEnd()}>
          <IconChevronsRight />
        </ActionIcon>
      </Group>
    );
  }
}

export default BoardAnalysis;
