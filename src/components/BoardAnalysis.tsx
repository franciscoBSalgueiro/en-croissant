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
import { useElementSize, useHotkeys } from "@mantine/hooks";
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
import { useCallback, useEffect, useState } from "react";
import { formatMove, getLastChessMove, moveToKey, toDests, VariationTree } from "../utils/chess";
import BestMoves from "./BestMoves";
import GameNotation from "./GameNotation";

export interface EngineVariation {
  moves: Chess | null;
  score: number;
  depth: number;
}

function BoardAnalysis({ initialFen }: { initialFen: string }) {
  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(
    buildVariationTree(new Chess(initialFen))
  );
  console.time("buildChess");
  const chess = new Chess();
  chess.loadPgn(tree.position);
  console.timeEnd("buildChess");

  const [engineOn, setEngineOn] = useState(false);

  const [engineVariation, setEngineVariation] = useState<EngineVariation>({
    moves: null,
    score: 0,
    depth: 0,
  });

  const setEngineVar = useCallback(
    (moves: string[], score: number, depth: number) => {
      const newChess = chess.clone();

      for (let turn of moves) {
        newChess.move(turn, { sloppy: true });
      }
      console.log(newChess.history());
      setEngineVariation({
        moves: newChess,
        score: score,
        depth: depth,
      });
    },
    [tree]
  );

  // Board orientation
  const [orientation, setOrientation] = useState("w");

  // Retursn a tree of all the previous moves
  function buildVariationTree(chess: Chess): VariationTree {
    console.time("buildVariationTree");

    const tree = new VariationTree(null, chess.pgn());

    if (chess.history().length > 0) {
      const parent = chess.undo();
      if (parent) {
        tree.parent = buildVariationTree(chess);
      }
    }
    console.timeEnd("buildVariationTree");
    return tree;
  }

  function resetEngineVariation() {
    setEngineVariation({
      moves: null,
      score: 0,
      depth: 0,
    });
  }

  function makeMove(move: PartialMove) {
    console.time("makeMove");
    chess.move(move);
    const newTree = new VariationTree(tree, chess.pgn());
    if (tree.children.length === 0) {
      tree.children = [newTree];
    } else if (tree.children[0].position !== chess.pgn()) {
      tree.children.push(newTree);
    }
    setTree(newTree);
    console.timeEnd("makeMove");
  }

  function undoMove() {
    if (tree.parent) {
      setTree(tree.parent);
      resetEngineVariation();
    }
  }

  function redoMove() {
    if (tree.children.length > 0) {
      setTree(tree.children[0]);
      resetEngineVariation();
    }
  }

  function goToStart() {
    setTree(tree.getTopVariation());
    resetEngineVariation();
  }

  function goToEnd() {
    setTree(tree.getBottomVariation());
    resetEngineVariation();
  }

  function flipBoard() {
    setOrientation(orientation === "w" ? "b" : "w");
  }

  console.time("utils");
  const turn = formatMove(chess.turn());
  const dests = toDests(chess);
  const lastMove = moveToKey(getLastChessMove(chess));
  console.timeEnd("utils");

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
      console.log(pv);
      if (pv.length > 10) {
        const moves = pv.split(" ").slice(0, 10);
        setEngineVar(moves, score, depth);
      }
    });
  }

  useEffect(() => {
    waitForMove();
  }, []);

  useEffect(() => {
    if (engineOn) {
      invoke("get_best_moves", {
        engine:
          "/home/francisco/Documents/prog/en-croissant/src-tauri/engines/stockfish_15_linux_x64_bmi2/stockfish_15_x64_bmi2",
        fen: chess.fen(),
      });
    } else {
      console.time("stop");
      emit("stop_engine");
      console.timeEnd("stop");
    }
  }, [engineOn]);

  console.time("getsize");
  const { ref, width, height } = useElementSize();
  console.timeEnd("getsize");

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
          <Switch
            checked={engineOn}
            onChange={(event) => setEngineOn(event.currentTarget.checked)}
            onLabel="On"
            offLabel="Off"
            size="lg"
          />
          {/* {engineOn && <BestMoves engineVariation={engineVariation} />} */}
          {engineVariation.moves && false && (
            <BestMoves
              engineVariation={engineVariation}
              tree={tree}
              setTree={setTree}
            />
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
