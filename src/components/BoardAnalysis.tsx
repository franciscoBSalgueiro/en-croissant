import {
  ActionIcon,
  AspectRatio,
  Button,
  Collapse,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Tooltip
} from "@mantine/core";
import {
  useElementSize,
  useHotkeys,
  useLocalStorage,
  useToggle
} from "@mantine/hooks";
import Chessground from "@react-chess/chessground";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconSettings,
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
import DepthSlider from "./DepthSlider";
import GameNotation from "./GameNotation";
import LinesSlider from "./LinesSlider";

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
  const [maxDepth, setMaxDepth] = useLocalStorage<number>({
    key: "max-depth",
    defaultValue: 24,
  });
  const [showSettings, toggleShowSettings] = useToggle();
  const [selectedEngines, setSelectedEngines] = useLocalStorage<Engine[]>({
    key: "selected-engines",
    defaultValue: [],
  });

  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(
    buildVariationTree(new Chess(initialFen))
  );
  const chess = new Chess();
  chess.loadPgn(tree.pgn);
  const [numberLines, setNumberLines] = useLocalStorage<number>({
    key: "number-lines",
    defaultValue: 3,
  });
  const [engineVariations, setEngineVariation] = useState<EngineVariation[]>(
    []
  );

  const [engineOn, setEngineOn] = useState(false);

  // Board orientation
  const [orientation, setOrientation] = useState("w");

  // Retursn a tree of all the previous moves
  function buildVariationTree(chess: Chess): VariationTree {
    const tree = new VariationTree(null, chess.pgn());

    if (chess.history().length > 0) {
      const parent = chess.undo();
      if (parent) {
        tree.parent = buildVariationTree(chess);
      }
    }
    return tree;
  }

  function makeMove(move: { from: Square; to: Square; promotion?: string }) {
    chess.move(move);
    const newTree = new VariationTree(tree, chess.pgn());
    if (tree.children.length === 0) {
      tree.children = [newTree];
    } else if (tree.children[0].pgn !== chess.pgn()) {
      tree.children.push(newTree);
    }
    setEngineVariation([]);
    setTree(newTree);
  }

  function makeMoves(moves: string[]) {
    let parentTree = tree;
    let newTree = tree;
    moves.forEach((move) => {
      chess.move(move, { sloppy: true });
      newTree = new VariationTree(parentTree, chess.pgn());
      if (parentTree.children.length === 0) {
        parentTree.children = [newTree];
      } else if (parentTree.children[0].pgn !== chess.pgn()) {
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
      invoke("get_best_moves", {
        engine: selectedEngines[0].path,
        fen: chess.fen(),
        depth: maxDepth,
        numberLines,
        numberThreads: 8,
        relative: !!selectedEngines[0].downloadLink,
      });
    } else {
      emit("stop_engine");
    }
  }, [tree, engineOn]);

  const { ref, width, height } = useElementSize();
  useEffect(() => {
    async function waitForMove() {
      await listen("best_moves", (event) => {
        setEngineVariation(event.payload as EngineVariation[]);
      });
    }

    waitForMove();
  }, []);

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
                  autoShapes: engineVariations.map((variation, i) => {
                    const move = variation.uciMoves[0];
                    const { from, to } = parseUci(move);
                    return {
                      orig: from,
                      dest: to,
                      brush: i === 0 ? "paleBlue" : "paleGrey",
                    };
                  }),
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
            <Button
              onClick={() => setTree(buildVariationTree(new Chess(initialFen)))}
            >
              Reset
            </Button>
          </Group>
          {/* <Text>{chess.fen()}</Text>
          <Text>{chess.pgn()}</Text> */}
        </Stack>

        <ScrollArea style={{ height: "95vh" }} offsetScrollbars>
          <Stack>
            <Group position="apart">
              <Group>
                <Switch
                  checked={engineOn}
                  onChange={(event) => setEngineOn(event.currentTarget.checked)}
                  onLabel="On"
                  offLabel="Off"
                  size="lg"
                  disabled={selectedEngines.length === 0}
                />
                {selectedEngines.length === 0 && (
                  <Text color="red">No engines selected</Text>
                )}
              </Group>

              <ActionIcon
                onClick={() => {
                  toggleShowSettings();
                }}
              >
                <IconSettings />
              </ActionIcon>
            </Group>
            <Collapse in={showSettings}>
              <Stack spacing="xl">
                <DepthSlider value={maxDepth} setValue={setMaxDepth} />
                <LinesSlider value={numberLines} setValue={setNumberLines} />
                <EngineSettingsBoard
                  selectedEngines={selectedEngines}
                  setSelectedEngines={setSelectedEngines}
                />
              </Stack>
            </Collapse>
            {engineOn &&
              selectedEngines.map((engine) => {
                return (
                  <BestMoves
                    key={engine.name}
                    engine={engine}
                    numberLines={numberLines}
                    engineVariations={engineVariations}
                    chess={chess}
                    makeMoves={makeMoves}
                    half_moves={tree.half_moves}
                  />
                );
              })}

            <GameNotation tree={tree} setTree={setTree} />
            <MoveControls />
          </Stack>
        </ScrollArea>
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
