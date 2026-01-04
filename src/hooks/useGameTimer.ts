import type { Outcome } from "@/bindings";
import { currentPlayersAtom } from "@/state/atoms";
import type { Position } from "chessops/chess";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";

export function useGameTimer({
  gameState,
  pos,
  setGameState,
  setResult,
}: {
  gameState: string;
  pos: Position | undefined;
  setGameState: (state: "playing" | "settingUp" | "gameOver") => void;
  setResult: (result: Outcome) => void;
}) {
  const [whiteTime, setWhiteTime] = useState<number | null>(null);
  const [blackTime, setBlackTime] = useState<number | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const players = useAtomValue(currentPlayersAtom);

  useEffect(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, [pos?.turn]);

  useEffect(() => {
    if (gameState === "playing" && whiteTime !== null && whiteTime <= 0) {
      setGameState("gameOver");
      setResult("0-1");
    }
  }, [gameState, whiteTime, setGameState, setResult]);

  useEffect(() => {
    if (gameState !== "playing") {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === "playing" && blackTime !== null && blackTime <= 0) {
      setGameState("gameOver");
      setResult("1-0");
    }
  }, [gameState, blackTime, setGameState, setResult]);

  useEffect(() => {
    function decrementTime() {
      if (gameState === "playing") {
        if (pos?.turn === "white" && whiteTime !== null) {
          setWhiteTime((prev) => (prev !== null ? prev - 100 : null));
        } else if (pos?.turn === "black" && blackTime !== null) {
          setBlackTime((prev) => (prev !== null ? prev - 100 : null));
        }
      }
    }

    if (gameState === "playing" && !intervalIdRef.current) {
      const id = setInterval(decrementTime, 100);
      intervalIdRef.current = id;

      // Add increment
      if (pos?.turn === "black" && whiteTime !== null) {
        setWhiteTime(
          (prev) =>
            (prev !== null ? prev : 0) +
            (players.white.timeControl?.increment ?? 0),
        );
      }
      if (pos?.turn === "white" && blackTime !== null) {
        setBlackTime((prev) => {
          if (pos?.fullmoves === 1) {
            return prev;
          }

          return (
            (prev !== null ? prev : 0) +
            (players.black.timeControl?.increment ?? 0)
          );
        });
      }
    }
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [
    gameState,
    pos?.turn,
    pos?.fullmoves,
    players.white.timeControl?.increment,
    players.black.timeControl?.increment,
  ]);

  return {
    whiteTime,
    setWhiteTime,
    blackTime,
    setBlackTime,
  };
}
