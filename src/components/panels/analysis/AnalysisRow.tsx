import type { Key } from "@lichess-org/chessground/types";
import { ActionIcon, Box, CopyButton, Flex, Portal, rem, Table, Tooltip } from "@mantine/core";
import { useForceUpdate } from "@mantine/hooks";
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";
import { chessgroundMove } from "chessops/compat";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { Score } from "@/bindings";
import { Chessground } from "@/chessground/Chessground";
import MoveCell from "@/components/common/MoveCell";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  engineLinePlaySpeedAtom,
  enginePanelFrozenAtom,
  moveHighlightAtom,
  previewBoardOnHoverAtom,
  scoreTypeFamily,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import { formatScore } from "@/utils/score";
import ScoreBubble from "./ScoreBubble";

function AnalysisRow({
  engine,
  score,
  moves,
  halfMoves,
  threat,
  fen,
  orientation,
}: {
  engine: string;
  score: Score;
  moves: string[];
  halfMoves: number;
  threat: boolean;
  fen: string;
  orientation: "white" | "black";
}) {
  const [open, setOpen] = useState<boolean>(false);
  const { t } = useTranslation();

  const allMoves = moves;
  const visibleMoves = open ? allMoves : allMoves.slice(0, 12);
  const engineOutput = [engine, formatScore(score.value), allMoves.join(" ")]
    .filter(Boolean)
    .join(" ");

  const [pos] = positionFromFen(fen);
  const moveInfo = [];
  if (pos) {
    for (const san of visibleMoves) {
      const move = parseSan(pos, san);
      if (!move) break;
      pos.play(move);
      const fen = makeFen(pos.toSetup());
      const lastMove = chessgroundMove(move);
      const isCheck = pos.isCheck();
      moveInfo.push({ fen, san, lastMove, isCheck });
    }
  }

  const ref = useRef<HTMLTableRowElement>(null);
  const reset = useForceUpdate();
  useLayoutEffect(() => {
    document.addEventListener("analysis-panel-scroll", reset);
    return () => {
      document.removeEventListener("analysis-panel-scroll", reset);
    };
  }, [reset]);

  useEffect(() => reset(), [open]);

  const [evalDisplay, setEvalDisplay] = useAtom(scoreTypeFamily(engine));

  // --- Engine line playback state ---
  const store = useContext(TreeStateContext)!;
  const makeMove = useStore(store, (s) => s.makeMove);
  const goToMove = useStore(store, (s) => s.goToMove);
  const getPosition = useCallback(() => store.getState().position, [store]);
  const playSpeed = useAtomValue(engineLinePlaySpeedAtom);
  const setEnginePanelFrozen = useSetAtom(enginePanelFrozenAtom);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const playbackIndexRef = useRef(0);
  const prePlaybackPositionRef = useRef<number[] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSessionRef = useRef(false);

  const cancelPlaybackSilent = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (prePlaybackPositionRef.current !== null) {
      goToMove(prePlaybackPositionRef.current);
      prePlaybackPositionRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setHasSession(false);
    playbackIndexRef.current = 0;
    hasSessionRef.current = false;
    setEnginePanelFrozen(false);
  }, [goToMove, setEnginePanelFrozen]);

  // Listen for other rows starting playback — cancel ourselves
  useEffect(() => {
    const handler = () => {
      if (hasSessionRef.current) {
        cancelPlaybackSilent();
      }
    };
    document.addEventListener("stop-engine-line-playback", handler);
    return () => {
      document.removeEventListener("stop-engine-line-playback", handler);
    };
  }, [cancelPlaybackSilent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const stopPlayback = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    playbackIndexRef.current = 0;
    // We intentionally DO NOT setEnginePanelFrozen(false) here!
    // This leaves the engine panel frozen on the original line.
  }, []);

  const cancelPlayback = useCallback(() => {
    cancelPlaybackSilent();
  }, [cancelPlaybackSilent]);

  const startPlayback = useCallback(() => {
    if (threat || allMoves.length === 0) return;

    // Mark ourselves inactive before dispatching, so our own handler won't cancel us
    const wasSession = hasSessionRef.current;
    hasSessionRef.current = false;
    // Signal all other playing rows to cancel
    document.dispatchEvent(new Event("stop-engine-line-playback"));
    hasSessionRef.current = wasSession;

    // If paused, resume from current index
    if (isPaused) {
      setIsPaused(false);
      setIsPlaying(true);
      hasSessionRef.current = true;
      setEnginePanelFrozen(true);
      intervalRef.current = setInterval(() => {
        const idx = playbackIndexRef.current;
        if (idx >= allMoves.length) {
          stopPlayback();
          return;
        }
        makeMove({ payload: allMoves[idx], changeHeaders: false });
        playbackIndexRef.current = idx + 1;
      }, playSpeed * 1000);
      return;
    }

    // If restarting from a finished session
    if (prePlaybackPositionRef.current !== null) {
      goToMove(prePlaybackPositionRef.current);
    } else {
      prePlaybackPositionRef.current = [...getPosition()];
    }

    // Fresh start: clear any prior interval
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    playbackIndexRef.current = 0;
    setIsPlaying(true);
    setIsPaused(false);
    setHasSession(true);
    hasSessionRef.current = true;
    setEnginePanelFrozen(true);

    // Play first move immediately
    makeMove({ payload: allMoves[0], changeHeaders: false });
    playbackIndexRef.current = 1;

    if (allMoves.length > 1) {
      intervalRef.current = setInterval(() => {
        const idx = playbackIndexRef.current;
        if (idx >= allMoves.length) {
          stopPlayback();
          return;
        }
        makeMove({ payload: allMoves[idx], changeHeaders: false });
        playbackIndexRef.current = idx + 1;
      }, playSpeed * 1000);
    } else {
      // Only one move, auto-stop
      stopPlayback();
    }
  }, [
    threat,
    allMoves,
    isPaused,
    playSpeed,
    makeMove,
    getPosition,
    stopPlayback,
    setEnginePanelFrozen,
  ]);

  const pausePlayback = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  return (
    <>
      <Table.Tr style={{ verticalAlign: "top" }}>
        <Table.Td width={70}>
          <ScoreBubble
            size="md"
            score={score}
            evalDisplay={evalDisplay}
            setEvalDisplay={setEvalDisplay}
          />
        </Table.Td>
        <Table.Td>
          <Flex
            direction="row"
            wrap="wrap"
            style={{
              height: open ? "100%" : 35,
              overflow: "hidden",
              alignItems: "center",
            }}
          >
            {moveInfo.map(({ san, fen, lastMove, isCheck }, index) => (
              <BoardPopover
                position={{
                  left: ref.current?.getClientRects()[0]?.left ?? 0,
                  top: ref.current?.getClientRects()[0]?.top ?? 0,
                }}
                key={index}
                san={san}
                index={index}
                moves={allMoves}
                halfMoves={halfMoves}
                threat={threat}
                fen={fen}
                orientation={orientation}
                lastMove={lastMove}
                isCheck={isCheck}
              />
            ))}
          </Flex>
        </Table.Td>
        <Table.Th>
          <Flex direction="row" align="center" gap={4}>
            {!threat && allMoves.length > 0 && (
              <Flex direction="row" align="center" gap={2}>
                {isPlaying ? (
                  <Tooltip label="Pause" withArrow position="right">
                    <ActionIcon variant="subtle" color="yellow" size="sm" onClick={pausePlayback}>
                      <IconPlayerPause size={14} />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <Tooltip label={isPaused ? "Resume" : "Play line"} withArrow position="right">
                    <ActionIcon variant="subtle" color="green" size="sm" onClick={startPlayback}>
                      <IconPlayerPlay size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {hasSession && (
                  <Tooltip label="Cancel" withArrow position="right">
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={cancelPlayback}>
                      <IconX size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Flex>
            )}
            <ActionIcon
              style={{
                transition: "transform 200ms ease",
                transform: open ? "rotate(180deg)" : "none",
              }}
              onClick={() => setOpen(!open)}
            >
              <IconChevronDown size={16} />
            </ActionIcon>
            {open && (
              <CopyButton value={engineOutput} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip
                    label={copied ? t("Common.Copied") : t("Menu.Edit.Copy")}
                    withArrow
                    position="right"
                  >
                    <ActionIcon
                      color={copied ? "teal" : undefined}
                      variant="subtle"
                      onClick={copy}
                      aria-label={copied ? t("Common.Copied") : t("Menu.Edit.Copy")}
                    >
                      {copied ? (
                        <IconCheck style={{ width: rem(16) }} />
                      ) : (
                        <IconCopy style={{ width: rem(16) }} />
                      )}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            )}
          </Flex>
        </Table.Th>
      </Table.Tr>
      <Table.Tr ref={ref} />
    </>
  );
}

function BoardPopover({
  san,
  lastMove,
  isCheck,
  index,
  moves,
  halfMoves,
  threat,
  fen,
  orientation,
  position,
}: {
  san: string;
  lastMove: Key[];
  isCheck: boolean;
  index: number;
  moves: string[];
  halfMoves: number;
  threat: boolean;
  fen: string;
  orientation: "white" | "black";
  position: { left: number; top: number };
}) {
  const total_moves = halfMoves + index + 1 + (threat ? 1 : 0);
  const is_white = total_moves % 2 === 1;
  const move_number = Math.ceil(total_moves / 2);
  const store = useContext(TreeStateContext)!;
  const makeMoves = useStore(store, (s) => s.makeMoves);
  const preview = useAtomValue(previewBoardOnHoverAtom);
  const moveHighlight = useAtomValue(moveHighlightAtom);

  const [hovering, setHovering] = useState(false);

  return (
    <>
      <Box onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
        {(index === 0 || is_white) && `${move_number.toString()}${is_white ? "." : "..."}`}
        <MoveCell
          move={san}
          isCurrentVariation={false}
          annotations={[]}
          onContextMenu={() => undefined}
          isStart={false}
          onClick={() => {
            if (!threat) {
              makeMoves({ payload: moves.slice(0, index + 1) });
            }
          }}
        />
      </Box>
      {preview && hovering && (
        <Portal>
          <Box
            w={200}
            style={{
              top: position.top,
              left: position.left,
            }}
            pos="fixed"
          >
            <Chessground
              fen={fen}
              coordinates={false}
              viewOnly
              orientation={orientation}
              lastMove={moveHighlight ? lastMove : undefined}
              turnColor={is_white ? "black" : "white"}
              check={moveHighlight && isCheck}
              drawable={{
                enabled: true,
                visible: true,
                defaultSnapToValidMove: true,
                eraseOnMovablePieceClick: true,
              }}
            />
          </Box>
        </Portal>
      )}
    </>
  );
}

export default AnalysisRow;
