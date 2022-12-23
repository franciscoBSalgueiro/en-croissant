import {
  ActionIcon,
  AspectRatio,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  useElementSize,
  useForceUpdate,
  useHotkeys,
  useLocalStorage
} from "@mantine/hooks";
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
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Chess, DEFAULT_POSITION, KING, Square, validateFen } from "chess.js";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  Annotation,
  annotationColor,
  EngineVariation,
  formatMove,
  getLastChessMove,
  moveToKey,
  parseUci,
  toDests,
  VariationTree
} from "../utils/chess";
import { Engine } from "../utils/engines";
import { AnnotationEditor } from "./AnnotationEditor";
import BestMoves from "./BestMoves";
import Chessground from "./Chessground";
import FenInput from "./FenInput";
import GameNotation from "./GameNotation";

const EngineSettingsBoard = dynamic(
  () => import("../components/EngineSettingsBoard"),
  {
    ssr: false,
  }
);

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
  const [maxDepth, setMaxDepth] = useLocalStorage<number>({
    key: "max-depth",
    defaultValue: 24,
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
  const [numberLines, setNumberLines] = useLocalStorage<number>({
    key: "number-lines",
    defaultValue: 3,
  });
  const [engineVariations, setEngineVariation] = useState<EngineVariation[][]>(
    []
  );

  const [engineOn, setEngineOn] = useState(false);
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

  // useEffect(() => {
  //   editor?.commands.setContent(tree.comment);
  // }, [tree.comment]);

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
    const newTree = new VariationTree(tree, chess.fen(), newMove?.san ?? "");
    if (tree.children.length === 0) {
      tree.children = [newTree];
    } else if (tree.children.every((child) => child.fen !== chess.fen())) {
      tree.children.push(newTree);
    }
    setEngineVariation([]);
    setTree(newTree);
  }

  function makeMoves(moves: string[]) {
    let parentTree = tree;
    let newTree = tree;
    moves.forEach((move) => {
      const newMove = chess.move(move, { sloppy: true });
      newTree = new VariationTree(parentTree, chess.fen(), newMove?.san ?? "");
      if (parentTree.children.length === 0) {
        parentTree.children = [newTree];
      } else if (parentTree.children[0].fen !== chess.fen()) {
        parentTree.children.push(newTree);
      }
      parentTree = newTree;
    });
    setEngineVariation([]);
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
  const lastMove = moveToKey(getLastChessMove(chess));

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
    ["f", () => flipBoard()],
  ]);

  useEffect(() => {
    if (engineOn) {
      emit("stop_engine");
      for (const engine of selectedEngines) {
        invoke("get_best_moves", {
          engine: engine.path,
          fen: chess.fen(),
          depth: maxDepth,
          numberLines: Math.min(numberLines, chess.moves().length),
          numberThreads: 8,
          relative: !!engine.downloadLink,
        });
      }
    } else {
      emit("stop_engine");
    }
  }, [tree, engineOn]);

  useEffect(() => {
    setEngineVariation([]);
    if (engineOn) {
      emit("stop_engine");
      for (const engine of selectedEngines) {
        invoke("get_best_moves", {
          engine: engine.path,
          fen: chess.fen(),
          depth: maxDepth,
          numberLines: Math.min(numberLines, chess.moves().length),
          numberThreads: 8,
          relative: !!engine.downloadLink,
        });
      }
    }
  }, [maxDepth, numberLines]);

  const { ref, width, height } = useElementSize();

  useEffect(() => {
    form.setValues({ fen: tree.fen });
  }, [tree]);

  return (
    <>
      <SimpleGrid cols={2} breakpoints={[{ maxWidth: 1120, cols: 1 }]}>
        <Stack justify="center">
          <AspectRatio
            ref={ref}
            ratio={1}
            style={{
              width: "100%",
              maxWidth: "90vh",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <Chessground
              width={width}
              height={height}
              config={{
                orientation: formatMove(orientation),
                fen: chess.fen(),
                movable: {
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
                },
                turnColor: turn,
                check: chess.inCheck(),
                lastMove,
                drawable: {
                  enabled: true,
                  visible: true,
                  defaultSnapToValidMove: true,
                  eraseOnClick: true,
                  autoShapes:
                    showArrows && engineVariations.length > 0 && engineOn
                      ? engineVariations[0].map((variation, i) => {
                          const move = variation.uciMoves[0];
                          const { from, to } = parseUci(move);
                          return {
                            orig: from,
                            dest: to,
                            brush: i === 0 ? "paleBlue" : "paleGrey",
                          };
                        })
                      : [],
                },
              }}
            />
          </AspectRatio>

          <Group position={"center"}>
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
              <ScrollArea style={{ maxHeight: "50vh" }} offsetScrollbars>
                <Stack>
                  <EngineSettingsBoard
                    selectedEngines={selectedEngines}
                    setSelectedEngines={setSelectedEngines}
                    engineOn={engineOn}
                    setEngineOn={setEngineOn}
                    maxDepth={maxDepth}
                    setMaxDepth={setMaxDepth}
                    numberLines={numberLines}
                    setNumberLines={setNumberLines}
                  />
                  {engineOn &&
                    selectedEngines.map((engine) => {
                      return (
                        <BestMoves
                          key={engine.name}
                          engine={engine}
                          numberLines={numberLines}
                          chess={chess}
                          makeMoves={makeMoves}
                          half_moves={tree.half_moves}
                          max_depth={maxDepth}
                        />
                      );
                    })}
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
