import {
  ActionIcon,
  AspectRatio,
  Button,
  Group,
  Stack,
  Switch,
  Text,
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
import { Chess, PartialMove } from "chess.ts";
import { useEffect, useState } from "react";
import {
  EngineVariation,
  formatMove,
  getLastChessMove,
  moveToKey,
  toDests,
  VariationTree
} from "../utils/chess";
import BestMoves from "./BestMoves";
import GameNotation from "./GameNotation";

function BoardAnalysis({ initialFen }: { initialFen: string }) {
  const [showDests, setShowDests] = useLocalStorage<boolean>({
    key: "show-dests",
    defaultValue: true,
  });

  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(
    buildVariationTree(new Chess(initialFen))
  );
  const [engineVariation, setEngineVariation] = useState<EngineVariation>();
  const chess = new Chess();
  chess.loadPgn(tree.pgn);

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

  function makeMove(move: PartialMove) {
    chess.move(move);
    const newTree = new VariationTree(tree, chess.pgn());
    if (tree.children.length === 0) {
      tree.children = [newTree];
    } else if (tree.children[0].pgn !== chess.pgn()) {
      tree.children.push(newTree);
    }
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

  async function waitForMove() {
    await listen("best_move", (event) => {
      const { pv, depth, score } = event.payload as {
        pv: String;
        depth: number;
        score: number;
      };
      // limit to 10 moves
      const moves = pv.split(" ").slice(0, 10);

      if (moves.length > 5) {
        setEngineVariation({
          moves,
          depth,
          score,
        });
      }
    });
  }

  useEffect(() => {
    waitForMove();
  }, []);

  useEffect(() => {
    if (engineOn) {
      emit("stop_engine");
      invoke("get_best_moves", {
        engine:
          "/home/francisco/Documents/prog/en-croissant/src-tauri/engines/stockfish_15_linux_x64_bmi2/stockfish_15_x64_bmi2",
        fen: chess.fen(),
      });
    } else {
      emit("stop_engine");
    }
  }, [tree, engineOn]);

  const { ref, width, height } = useElementSize();

  return (
    <>
      <Group grow align={"flex-start"}>
        <Stack>
          <AspectRatio ref={ref} ratio={1}>
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
                      if (chess.get(orig)?.type === "k") {
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
                      makeMove({ from: orig, to: dest });
                    },
                  },
                },
                turnColor: turn,
                check: chess.inCheck(),
                lastMove,
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
          <Text>{chess.fen()}</Text>
          <Text>{chess.pgn()}</Text>
        </Stack>

        <Stack>
          {/* <div>{tree.getTopVariation().getNumberOfChildren()}</div>
          {tree.getTopVariation().getNumberOfBranches()} */}
          <Switch
            checked={engineOn}
            onChange={(event) => setEngineOn(event.currentTarget.checked)}
            onLabel="On"
            offLabel="Off"
            size="lg"
          />
          {engineOn && engineVariation && (
            <>
              <BestMoves
                engineVariation={engineVariation}
                chess={chess}
                makeMoves={makeMoves}
              />
            </>
          )}

          <GameNotation tree={tree} setTree={setTree} />
          <MoveControls />
        </Stack>
      </Group>
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
