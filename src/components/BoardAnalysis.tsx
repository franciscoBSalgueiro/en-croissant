import {
  Accordion,
  ActionIcon,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Tooltip
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
  IconSwitchVertical,
  IconZoomCheck
} from "@tabler/icons";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Chess, DEFAULT_POSITION, KING, Square, validateFen } from "chess.js";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Chessground from "react-chessground";
import {
  Annotation,
  annotationColor,
  formatMove,
  moveToKey,
  toDests,
  VariationTree
} from "../utils/chess";
import { Engine } from "../utils/engines";
import { AnnotationEditor } from "./AnnotationEditor";
import FenInput from "./FenInput";
import GameNotation from "./GameNotation";

const EngineSettingsBoard = dynamic(
  () => import("../components/EngineSettingsBoard"),
  {
    ssr: false,
  }
);

const OpeningName = dynamic(() => import("../components/OpeningName"), {
  ssr: false,
});

const BestMoves = dynamic(() => import("../components/BestMoves"), {
  ssr: false,
});

function BoardAnalysis() {
  const forceUpdate = useForceUpdate();
  const [showDests, setShowDests] = useLocalStorage<boolean>({
    key: "show-dests",
    defaultValue: true,
  });
  const [showArrows, setShowArrows] = useLocalStorage<boolean>({
    key: "show-arrows",
    defaultValue: true,
  });
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

  const [orientation, setOrientation] = useState("w");

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

  function flipBoard() {
    setOrientation(orientation === "w" ? "b" : "w");
  }

  function resetToFen(fen: string) {
    setTree(new VariationTree(null, fen, null));
  }

  const turn = formatMove(chess.turn());
  const dests = toDests(chess);
  const lastMove = moveToKey(tree.move);

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
    ["f", () => flipBoard()],
  ]);

  useEffect(() => {
    form.setValues({ fen: tree.fen });
  }, [tree]);

  return (
    <>
      <SimpleGrid cols={2} breakpoints={[{ maxWidth: 800, cols: 1 }]}>
        <Stack justify="center">
          <div style={{ aspectRatio: 1 }}>
            <Chessground
              style={{ justifyContent: "start" }}
              width={"100%"}
              height={"100%"}
              orientation={formatMove(orientation)}
              fen={chess.fen()}
              movable={{
                free: false,
                color: turn,
                dests: dests,
                showDests,
                events: {
                  after: (orig, dest) => {
                    if (orig === "a0" || dest === "a0") {
                      // NOTE: Idk if this can happen
                      return;
                    }
                    if (chess.get(orig)?.type === KING) {
                      switch (dest) {
                        case "h1":
                          dest = "g1";
                          break;
                        case "a1":
                          dest = "c1";
                          break;
                        case "h8":
                          dest = "g8";
                          break;
                        case "a8":
                          dest = "c8";
                          break;
                      }
                    }
                    makeMove({
                      from: orig,
                      to: dest,
                    });
                  },
                },
              }}
              turnColor={turn}
              check={chess.inCheck()}
              lastMove={lastMove}
              // drawable={{
              //   enabled: true,
              //   visible: true,
              //   defaultSnapToValidMove: true,
              //   eraseOnClick: true,
              //   autoShapes:
              //     showArrows && engineVariations.length > 0
              //       ? engineVariations[0].map((variation, i) => {
              //           const move = variation.uciMoves[0];
              //           const { from, to } = parseUci(move);
              //           return {
              //             orig: from,
              //             dest: to,
              //             brush: i === 0 ? "paleBlue" : "paleGrey",
              //           };
              //         })
              //       : [],
              // }}
            />
          </div>

          <Group position={"apart"}>
            <OpeningName fen={tree.fen} />
            <Tooltip label={"Flip Board"}>
              <ActionIcon onClick={() => flipBoard()}>
                <IconSwitchVertical />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Stack>

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
              <Stack>
                <Group grow>
                  <SymbolButton annotation={Annotation.Brilliant} />
                  <SymbolButton annotation={Annotation.Good} />
                  <SymbolButton annotation={Annotation.Interesting} />
                  <SymbolButton annotation={Annotation.Dubious} />
                  <SymbolButton annotation={Annotation.Mistake} />
                  <SymbolButton annotation={Annotation.Blunder} />
                </Group>
                <AnnotationEditor editor={editor} />
              </Stack>
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
                          half_moves={tree.half_moves}
                          chess={chess}
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
          <GameNotation tree={tree} setTree={setTree} />
          <MoveControls />
        </Stack>
      </SimpleGrid>
    </>
  );

  function SymbolButton({ annotation }: { annotation: Annotation }) {
    let label: string;
    switch (annotation) {
      case Annotation.Good:
        label = "Good";
        break;
      case Annotation.Brilliant:
        label = "Brilliant";
        break;
      case Annotation.Mistake:
        label = "Mistake";
        break;
      case Annotation.Blunder:
        label = "Blunder";
        break;
      case Annotation.Dubious:
        label = "Dubious";
        break;
      case Annotation.Interesting:
        label = "Interesting";
        break;
      default:
        label = "Unknown";
    }
    const color = annotationColor(annotation);
    const isActive = tree.annotation === annotation;
    return (
      <Tooltip label={label}>
        <ActionIcon
          onClick={() => annotate(annotation)}
          variant={isActive ? "filled" : "default"}
          color={color}
        >
          <Text>{annotation}</Text>
        </ActionIcon>
      </Tooltip>
    );
  }

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
