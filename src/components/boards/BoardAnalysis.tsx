import { Accordion, ScrollArea, SimpleGrid, Stack, Tabs } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  useForceUpdate,
  useHotkeys,
  useLocalStorage,
  useSessionStorage,
  useToggle
} from "@mantine/hooks";
import { IconInfoCircle, IconNotes, IconZoomCheck } from "@tabler/icons";
import { Chess, DEFAULT_POSITION, Square, validateFen } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import {
  chessToVariatonTree,
  movesToVariationTree,
  VariationTree
} from "../../utils/chess";
import { Game, Outcome, Player, Speed } from "../../utils/db";
import { Engine } from "../../utils/engines";
import GameInfo from "../common/GameInfo";
import MoveControls from "../common/MoveControls";
import TreeContext from "../common/TreeContext";
import BestMoves from "../panels/analysis/BestMoves";
import EngineSettingsBoard from "../panels/analysis/EngineSettingsBoard";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import FenInput from "../panels/info/FenInput";
import PgnInput from "../panels/info/PgnInput";
import BoardPlay from "./BoardPlay";
import GameNotation from "./GameNotation";

export interface CompleteGame {
  game: Game;
  white: Player;
  black: Player;
  currentMove: number;
}

function BoardAnalysis({ id }: { id: string }) {
  const [completeGame, setCompleteGame] = useSessionStorage<CompleteGame>({
    key: id,
    defaultValue: {
      game: {
        white: -1,
        black: -1,
        white_rating: 0,
        black_rating: 0,
        speed: Speed.Unknown,
        outcome: Outcome.Unknown,
        moves: "",
        date: "??.??.??",
        site: "",
      },
      white: {
        id: -1,
        name: "White",
        game_count: 0,
      },
      black: {
        id: -1,
        name: "Black",
        game_count: 0,
      },
      currentMove: 0,
    },
  });
  const game = completeGame.game;

  const forceUpdate = useForceUpdate();
  const [editingMode, toggleEditingMode] = useToggle();
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

  const initial_tree = useMemo(() => {
    if (game.moves[0] === "1" || game.moves[0] === "[") {
      const chess = new Chess();
      chess.loadPgn(game.moves);
      const tree = chessToVariatonTree(chess);
      return tree;
    }
    const tree = movesToVariationTree(game.moves);
    return tree;
  }, [game.moves]);

  function saveGame() {
    setCompleteGame((prev) => {
      const pgn = tree.getTopVariation().getPGN();
      const newTab = {
        ...prev,
      };
      newTab.game.moves = pgn;
      return newTab;
    });
  }

  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(initial_tree);
  useEffect(() => {
    setTree(initial_tree);
  }, [initial_tree]);
  const [arrows, setArrows] = useState<string[]>([]);
  const chess = new Chess(tree.fen);

  function makeMove(move: { from: Square; to: Square; promotion?: string }) {
    if (editingMode) {
      const piece = chess.get(move.from);
      chess.remove(move.to);
      chess.remove(move.from);
      chess.put(piece, move.to);
      const newTree = new VariationTree(null, chess.fen(), null);
      setTree(newTree);
    } else {
      const newMove = chess.move(move);
      const newTree = new VariationTree(tree, chess.fen(), newMove);
      if (tree.children.length === 0) {
        tree.children = [newTree];
      } else if (tree.children.every((child) => child.fen !== chess.fen())) {
        tree.children.push(newTree);
      }
      setTree(newTree);
    }
  }

  function makeMoves(moves: string[]) {
    let parentTree = tree;
    let newTree = tree;
    moves.forEach((move) => {
      const newMove = chess.move(move, { sloppy: true });
      newTree = new VariationTree(parentTree, chess.fen(), newMove);
      if (parentTree.children.length === 0) {
        parentTree.children = [newTree];
        parentTree = newTree;
      } else if (
        parentTree.children.every((child) => child.fen !== newTree.fen)
      ) {
        parentTree.children.push(newTree);
        parentTree = newTree;
      } else {
        parentTree = parentTree.children.find(
          (child) => child.fen === newTree.fen
        )!;
      }
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
    ["ctrl+S", () => saveGame()],
  ]);

  useEffect(() => {
    setArrows([]);
  }, [tree.fen]);

  return (
    <TreeContext.Provider value={tree}>
      <SimpleGrid cols={2} breakpoints={[{ maxWidth: 800, cols: 1 }]}>
        <BoardPlay
          makeMove={makeMove}
          arrows={arrows}
          editingMode={editingMode}
          toggleEditingMode={toggleEditingMode}
        />
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
              <Stack>
                <GameInfo
                  white={completeGame.white}
                  white_rating={game.white_rating}
                  black={completeGame.black}
                  black_rating={game.black_rating}
                  date={game.date}
                  outcome={game.outcome}
                />
                <FenInput form={form} onSubmit={resetToFen} />
                <PgnInput />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="annotate" pt="xs">
              <AnnotationPanel forceUpdate={forceUpdate} setTree={setTree} />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" pt="xs">
              <ScrollArea
                style={{ height: "40vh" }}
                offsetScrollbars
                type="always"
              >
                <Stack>
                  <Accordion variant="separated" multiple chevronSize={0}>
                    {selectedEngines.map((engine, i) => {
                      return (
                        <Accordion.Item key={engine.name} value={engine.path}>
                          <BestMoves
                            id={i}
                            engine={engine}
                            makeMoves={makeMoves}
                            setArrows={setArrows}
                          />
                        </Accordion.Item>
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
          <MoveControls
            goToStart={goToStart}
            goToEnd={goToEnd}
            redoMove={redoMove}
            undoMove={undoMove}
          />
        </Stack>
      </SimpleGrid>
    </TreeContext.Provider>
  );
}

export default BoardAnalysis;
