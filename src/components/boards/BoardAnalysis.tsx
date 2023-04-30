import { ScrollArea, Stack, Tabs } from "@mantine/core";
import {
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
import { Chess, Color, PieceSymbol, Square, validateFen } from "chess.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import BoardLayout from "../../layouts/BoardLayout";
import {
  VariationTree,
  goToPosition,
  parsePGN,
  stripPGNheader,
} from "../../utils/chess";
import { CompleteGame, defaultGame } from "../../utils/db";
import { Engine } from "../../utils/engines";
import { getBoardSize, invoke, useLocalFile } from "../../utils/misc";
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

  const [editingMode, toggleEditingMode] = useToggle();
  const [reportingMode, toggleReportingMode] = useToggle();
  const [engines, setEngines] = useLocalFile<Engine[]>(
    "engines/engines.json",
    []
  );
  const [arrows, setArrows] = useState<string[]>([]);
  const chess: Chess | null = useMemo(
    () =>
      validateFen(completeGame.game.tree.fen).ok
        ? new Chess(completeGame.game.tree.fen)
        : null,
    [completeGame.game.tree.fen]
  );

  const makeMove = useCallback(
    function makeMove(
      move: { from: Square; to: Square; promotion?: string } | string
    ) {
      if (chess === null) return;
      // if (chess === null) {
      //   invoke("make_move", {
      //     fen: completeGame.game.tree.fen,
      //     from: move.from,
      //     to: move.to,
      //   }).then((fen) => {
      //     const newTree = new VariationTree(null, fen as string, null);
      //     setTree(newTree);
      //   });
      // } else if (editingMode) {
      //   const piece = chess.get(move.from);
      //   chess.remove(move.to);
      //   chess.remove(move.from);
      //   chess.put(piece, move.to);
      //   const newTree = new VariationTree(null, chess.fen(), null);
      //   setTree(newTree);
      // } else {
      const newMove = chess.move(move);
      const newTree = new VariationTree(
        completeGame.game.tree,
        chess.fen(),
        newMove
      );
      if (completeGame.game.tree.children.length === 0) {
        completeGame.game.tree.children = [newTree];
        setTree(newTree);
      } else if (
        completeGame.game.tree.children.every(
          (child) => child.fen !== chess!.fen()
        )
      ) {
        completeGame.game.tree.children.push(newTree);
        setTree(newTree);
      } else {
        const child = completeGame.game.tree.children.find(
          (child) => child.fen === chess!.fen()
        );
        setTree(child!);
      }
      // }
    },
    [chess, completeGame.game.tree, editingMode, setTree]
  );

  const makeMoves = useCallback(
    function makeMoves(moves: string[]) {
      let parentTree = completeGame.game.tree;
      let newTree = completeGame.game.tree;
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
    },
    [chess, completeGame.game.tree, setTree]
  );

  const deleteVariation = useCallback(
    function deleteVariation() {
      if (completeGame.game.tree.parent) {
        completeGame.game.tree.parent.children =
          completeGame.game.tree.parent.children.filter(
            (child) => !child.equals(completeGame.game.tree)
          );
        setTree(completeGame.game.tree.parent);
      }
    },
    [completeGame.game.tree]
  );

  const promoteVariation = useCallback(
    function promoteVariation() {
      if (completeGame.game.tree.parent) {
        const parent = completeGame.game.tree.parent;
        parent.children = [
          completeGame.game.tree,
          ...parent.children.filter(
            (child) => !child.equals(completeGame.game.tree)
          ),
        ];
        setTree(completeGame.game.tree);
      }
    },
    [completeGame.game.tree]
  );

  const addPiece = useCallback(
    function addPiece(square: Square, piece: PieceSymbol, color: Color) {
      let newTree: VariationTree;
      if (chess) {
        chess.put({ type: piece, color }, square);
        newTree = new VariationTree(null, chess.fen(), null);
        setTree(newTree);
      } else {
        invoke("put_piece", {
          fen: completeGame.game.tree.fen,
          square,
          piece,
          color,
        }).then((fen) => {
          newTree = new VariationTree(null, fen as string, null);
          setTree(newTree);
        });
      }
    },
    [chess, completeGame.game.tree.fen, setTree]
  );

  function undoMove() {
    if (completeGame.game.tree.parent) {
      setTree(completeGame.game.tree.parent);
    }
  }

  function redoMove() {
    if (completeGame.game.tree.children.length > 0) {
      setTree(completeGame.game.tree.children[0]);
    }
  }

  function goToStart() {
    setTree(completeGame.game.tree.getTopVariation());
  }

  function goToEnd() {
    setTree(completeGame.game.tree.getBottomVariation());
  }

  const changeToPlayMode = useCallback(
    function changeToPlayMode() {
      setTabs(
        tabs.map((tab) => (tab.value === id ? { ...tab, type: "play" } : tab))
      );
    },
    [id, tabs]
  );

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
        completeGame.game.tree
          .getTopVariation()
          .getPGN({ headers: completeGame.game })
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
  }, [completeGame.game.tree.fen]);

  const { height, width } = useViewportSize();

  const boardSize = getBoardSize(height, width);
  const [inProgress, setInProgress] = useState(false);

  const [notationExpanded, setNotationExpanded] = useState(false);

  return (
    <GameContext.Provider value={completeGame}>
      <ReportModal
        moves={completeGame.game.tree.getTopVariation().getPGN({
          headers: completeGame.game,
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
          {!notationExpanded && (
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
                <ScrollArea sx={{ height: boardSize / 2 }} offsetScrollbars>
                  <GameInfo
                    dateString={completeGame.game.date}
                    whiteName={completeGame.game.white.name}
                    blackName={completeGame.game.black.name}
                    white_elo={completeGame.game.white_elo}
                    black_elo={completeGame.game.black_elo}
                    result={completeGame.game.result}
                    setCompleteGame={setCompleteGame}
                  />
                  <FenInput setCompleteGame={setCompleteGame} />
                  <PgnInput game={completeGame.game} />
                </ScrollArea>
              </Tabs.Panel>
              <Tabs.Panel value="database" pt="xs">
                <DatabasePanel makeMove={makeMove} height={boardSize / 2} />
              </Tabs.Panel>
              <Tabs.Panel value="annotate" pt="xs">
                <AnnotationPanel setTree={setTree} />
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
          )}
          <Stack>
            <GameNotation
              game={completeGame.game}
              setTree={setTree}
              deleteVariation={deleteVariation}
              promoteVariation={promoteVariation}
              topVariation={completeGame.game.tree.getTopVariation()}
              result={completeGame.game.result}
              boardSize={notationExpanded ? 1750 : (width > 1000 ? boardSize : 600)}
              setNotationExpanded={setNotationExpanded}
              notationExpanded={notationExpanded}
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
