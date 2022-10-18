import {
  ActionIcon,
  AspectRatio,
  Button,
  Group,
  Stack,
  Switch
} from "@mantine/core";
import { useElementSize, useHotkeys } from "@mantine/hooks";
import Chessground from "@react-chess/chessground";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight
} from "@tabler/icons";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { Chess, PartialMove } from "chess.ts";
import { useEffect, useState } from "react";
import { formatMove, moveToKey, toDests, VariationTree } from "../utils/chess";
import BestMoves from "./BestMoves";
import GameNotation from "./GameNotation";

function BoardAnalysis({ initialFen }: { initialFen: string }) {
  const [engineOn, setEngineOn] = useState(false);
  const [engineMove, setEngineMove] = useState<string | null>(null);

  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(
    buildVariationTree(new Chess(initialFen))
  );
  const chess = tree.position;

  // Board orientation
  const [orientation, setOrientation] = useState("w");

  // Retursn a tree of all the previous moves
  function buildVariationTree(chess: Chess): VariationTree {
    const tree = new VariationTree(null, chess);

    if (chess.history().length > 0) {
      const parent = chess.undo();
      if (parent) {
        tree.parent = buildVariationTree(chess);
      }
    }

    return tree;
  }

  function makeMove(move: PartialMove) {
    const newChess = tree.position.clone();
    newChess.move(move);
    const newTree = new VariationTree(tree, newChess);
    if (tree.children.length === 0) {
      tree.children = [newTree];
    } else if (tree.children[0].position.fen() !== newChess.fen()) {
      tree.children.push(newTree);
    }
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
  const lastMove = moveToKey(tree.getLastMove());

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
    ["f", () => flipBoard()],
  ]);

  async function waitForMove() {
    await listen("best_move", (event) => {
      setEngineMove(event.payload as string);
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
      });
    }
  }, [engineOn]);

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
                  events: {
                    after: (orig, dest) => {
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
            <Button onClick={() => flipBoard()}>Flip</Button>
            <Button
              onClick={() => setTree(buildVariationTree(new Chess(initialFen)))}
            >
              Reset
            </Button>
          </Group>
        </Stack>

        <Stack>
          <Switch
            checked={engineOn}
            onChange={(event) => setEngineOn(event.currentTarget.checked)}
            onLabel="On"
            offLabel="Off"
            size="lg"
          />
          {engineOn && <BestMoves engineMove={engineMove} />}

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
