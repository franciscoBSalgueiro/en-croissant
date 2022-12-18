import {
  ActionIcon,
  AspectRatio, Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tooltip
} from "@mantine/core";
import { useElementSize, useHotkeys, useLocalStorage } from "@mantine/hooks";
import Chessground from "@react-chess/chessground";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconSwitchVertical
} from "@tabler/icons";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { Chess, KING, Square } from "chess.js";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  EngineVariation,
  formatMove,
  getLastChessMove,
  moveToKey,
  parseUci,
  toDests,
  VariationTree
} from "../utils/chess";
import { Engine } from "../utils/engines";
import BestMoves from "./BestMoves";
import GameNotation from "./GameNotation";

const EngineSettingsBoard = dynamic(
  () => import("../components/EngineSettingsBoard"),
  {
    ssr: false,
  }
);

function BoardAnalysis({ initialFen }: { initialFen: string }) {
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

  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(
    // buildVariationTree(new Chess(initialFen))
    new VariationTree(null, initialFen, null)
  );
  console.log(tree.fen);
  const chess = new Chess(tree.fen);
  const [numberLines, setNumberLines] = useLocalStorage<number>({
    key: "number-lines",
    defaultValue: 3,
  });
  const [engineVariations, setEngineVariation] = useState<EngineVariation[][]>(
    []
  );

  const [engineOn, setEngineOn] = useState(false);

  // Board orientation
  const [orientation, setOrientation] = useState("w");

  // Retursn a tree of all the previous moves
  // function buildVariationTree(chess: Chess): VariationTree {
  //   const tree = new VariationTree(null, chess.pgn());

  //   if (chess.history().length > 0) {
  //     const parent = chess.undo();
  //     if (parent) {
  //       tree.parent = buildVariationTree(chess);
  //     }
  //   }
  //   return tree;
  // }

  function makeMove(move: { from: Square; to: Square; promotion?: string }) {
    const newMove = chess.move(move);
    const newTree = new VariationTree(tree, chess.fen(), newMove?.san ?? "" );
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
    async function waitForMove() {
      await listen("best_moves", (event) => {
        console.log(event.payload);
        const ev = event.payload as EngineVariation[];
        setEngineVariation((prev) =>
          prev.filter((e) => e[0].engine !== ev[0].engine).concat([ev])
        );
      });
    }

    waitForMove();
  }, []);

  useEffect(() => {
    chess.load(initialFen);
    setTree(
      new VariationTree(null, initialFen, null)
    );
    setEngineOn(false);
  }, [initialFen]);

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
                // add an arrow between a1 and b2
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
          {/* <Text>{chess.fen()}</Text>
          <Text>{chess.pgn()}</Text> */}
        </Stack>

        <Stack>
          <ScrollArea style={{ height: "85vh" }} offsetScrollbars>
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
                      engineVariations={
                        engineVariations.find(
                          (e) => e[0].engine === engine.path
                        ) ?? []
                      }
                      chess={chess}
                      makeMoves={makeMoves}
                      half_moves={tree.half_moves}
                      max_depth={maxDepth}
                    />
                  );
                })}

              <GameNotation tree={tree} setTree={setTree} />
            </Stack>

            {/* <FenInput setBoardFen={() => {}} /> */}
          </ScrollArea>
          <MoveControls />
        </Stack>
      </SimpleGrid>
    </>
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
