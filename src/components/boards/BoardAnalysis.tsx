import { Stack, Tabs } from "@mantine/core";
import {
  useForceUpdate,
  useHotkeys,
  useSessionStorage,
  useToggle,
  useViewportSize,
} from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconZoomCheck,
} from "@tabler/icons-react";
import { save } from "@tauri-apps/api/dialog";
import { writeTextFile } from "@tauri-apps/api/fs";
import { Chess, Color, PieceSymbol, Square } from "chess.js";
import { useCallback, useEffect, useState } from "react";
import BoardLayout from "../../layouts/BoardLayout";
import {
  VariationTree,
  goToPosition,
  parsePGN,
  stripPGNheader,
} from "../../utils/chess";
import { CompleteGame, defaultGame } from "../../utils/db";
import { Engine } from "../../utils/engines";
import { invoke, useLocalFile } from "../../utils/misc";
import { Tab } from "../../utils/tabs";
import GameContext from "../common/GameContext";
import GameInfo from "../common/GameInfo";
import MoveControls from "../common/MoveControls";
import AnalysisPanel from "../panels/analysis/AnalysisPanel";
import ReportModal from "../panels/analysis/ReportModal";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import DatabasePanel from "../panels/database/DatabasePanel";
import FenInput from "../panels/info/FenInput";
import PgnInput from "../panels/info/PgnInput";
import BoardPlay from "./BoardPlay";
import GameNotation from "./GameNotation";

function BoardAnalysis({
  id,
  tabs,
  setTabs,
}: {
  id: string;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
}) {
  const [completeGame, setCompleteGame] = useSessionStorage<CompleteGame>({
    key: id,
    defaultValue: { game: defaultGame(), currentMove: [] },
    serialize: (value) => {
      const storedGame: any = {
        ...value.game,
        tree: undefined,
        moves: stripPGNheader(value.game.moves),
      };

      const storedTree = JSON.stringify({
        game: storedGame,
        currentMove: value.game.tree.getPosition(),
      });
      return storedTree;
    },
    deserialize: (value) => {
      const { game, currentMove } = JSON.parse(value);
      const tree = parsePGN(stripPGNheader(game.moves));
      const treeAtPosition = goToPosition(tree, currentMove);
      game.tree = treeAtPosition;
      return { game, currentMove };
    },
  });
  const game = completeGame.game;
  const tree = game.tree;
  const setTree = useCallback((tree: VariationTree) => {
    setCompleteGame((prevGame) => {
      return {
        ...prevGame,
        game: {
          ...prevGame.game,
          moves: tree.getTopVariation().getPGN({ headers: prevGame.game }),
          tree,
        },
      };
    });
  }, []);

  const forceUpdate = useForceUpdate();
  const [editingMode, toggleEditingMode] = useToggle();
  const [reportingMode, toggleReportingMode] = useToggle();
  const [engines, setEngines] = useLocalFile<Engine[]>(
    "engines/engines.json",
    []
  );
  const [arrows, setArrows] = useState<string[]>([]);
  let chess: Chess | null;
  try {
    chess = new Chess(tree.fen);
  } catch (e) {
    chess = null;
  }

  function makeMove(move: { from: Square; to: Square; promotion?: string }) {
    if (chess === null) {
      invoke("make_move", {
        fen: tree.fen,
        from: move.from,
        to: move.to,
      }).then((fen) => {
        const newTree = new VariationTree(null, fen as string, null);
        setTree(newTree);
      });
    } else if (editingMode) {
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
        setTree(newTree);
      } else if (tree.children.every((child) => child.fen !== chess!.fen())) {
        tree.children.push(newTree);
        setTree(newTree);
      } else {
        const child = tree.children.find((child) => child.fen === chess!.fen());
        setTree(child!);
      }
    }
  }

  function makeMoves(moves: string[]) {
    let parentTree = tree;
    let newTree = tree;
    moves.forEach((move) => {
      const newMove = chess!.move(move);
      newTree = new VariationTree(parentTree, chess!.fen(), newMove);
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

  function deleteVariation() {
    if (tree.parent) {
      tree.parent.children = tree.parent.children.filter(
        (child) => !child.equals(tree)
      );
      setTree(tree.parent);
    }
  }

  function promoteVariation() {
    if (tree.parent) {
      const parent = tree.parent;
      parent.children = [
        tree,
        ...parent.children.filter((child) => !child.equals(tree)),
      ];
      forceUpdate();
    }
  }

  function addPiece(square: Square, piece: PieceSymbol, color: Color) {
    let newTree: VariationTree;
    if (chess) {
      chess.put({ type: piece, color }, square);
      newTree = new VariationTree(null, chess.fen(), null);
      setTree(newTree);
    } else {
      invoke("put_piece", {
        fen: tree.fen,
        square,
        piece,
        color,
      }).then((fen) => {
        newTree = new VariationTree(null, fen as string, null);
        setTree(newTree);
      });
    }
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

  function changeToPlayMode() {
    setTabs(
      tabs.map((tab) => (tab.value === id ? { ...tab, type: "play" } : tab))
    );
  }

  async function saveFile() {
    const filePath = await save({
      filters: [
        {
          name: "PGN",
          extensions: ["pgn"],
        },
      ],
    });
    if (filePath)
      await writeTextFile(
        filePath,
        tree.getTopVariation().getPGN({ headers: game })
      );
  }

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
    ["Delete", () => deleteVariation()],
    ["Ctrl+S", () => saveFile()],
  ]);

  useEffect(() => {
    setArrows([]);
  }, [tree.fen]);

  const { height, width } = useViewportSize();

  function getBoardSize(height: number, width: number) {
    const initial = Math.min((height - 140) * 0.95, width * 0.4);
    if (width < 680) {
      return width - 120;
    }
    return initial;
  }
  const boardSize = getBoardSize(height, width);
  const [inProgress, setInProgress] = useState(false);

  return (
    <GameContext.Provider value={completeGame}>
      <ReportModal
        moves={tree.getTopVariation().getPGN({
          headers: game,
          comments: false,
          specialSymbols: false,
          symbols: false,
        })}
        reportingMode={reportingMode}
        toggleReportingMode={toggleReportingMode}
        setTree={setTree}
        setInProgress={setInProgress}
      />
      <BoardLayout
        board={
          <BoardPlay
            makeMove={makeMove}
            arrows={arrows}
            forceUpdate={forceUpdate}
            setTree={setTree}
            editingMode={editingMode}
            toggleEditingMode={toggleEditingMode}
            setCompleteGame={setCompleteGame}
            completeGame={completeGame}
            addPiece={addPiece}
          />
        }
      >
        <>
          <Tabs defaultValue="analysis">
            <Tabs.List grow>
              <Tabs.Tab value="analysis" icon={<IconZoomCheck size={16} />}>
                Analysis
              </Tabs.Tab>
              <Tabs.Tab value="database" icon={<IconDatabase size={16} />}>
                Database
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
                <GameInfo game={game} setCompleteGame={setCompleteGame} />
                <FenInput setCompleteGame={setCompleteGame} />
                <PgnInput game={game} />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="database" pt="xs">
              <DatabasePanel makeMove={makeMove} height={boardSize / 2} />
            </Tabs.Panel>
            <Tabs.Panel value="annotate" pt="xs">
              <AnnotationPanel forceUpdate={forceUpdate} setTree={setTree} />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" pt="xs">
              <AnalysisPanel
                boardSize={boardSize}
                engines={engines}
                id={id}
                makeMoves={makeMoves}
                setArrows={setArrows}
                setCompleteGame={setCompleteGame}
                setEngines={setEngines}
                changeToPlayMode={changeToPlayMode}
                toggleReportingMode={toggleReportingMode}
                inProgress={inProgress}
                setInProgress={setInProgress}
              />
            </Tabs.Panel>
          </Tabs>
          <Stack>
            <GameNotation
              game={game}
              setTree={setTree}
              deleteVariation={deleteVariation}
              promoteVariation={promoteVariation}
              topVariation={tree.getTopVariation()}
              result={game.result}
              boardSize={width > 1000 ? boardSize : 600}
            />
            <MoveControls
              goToStart={goToStart}
              goToEnd={goToEnd}
              redoMove={redoMove}
              undoMove={undoMove}
            />
          </Stack>
        </>
      </BoardLayout>
    </GameContext.Provider>
  );
}

export default BoardAnalysis;
