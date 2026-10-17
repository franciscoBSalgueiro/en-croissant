#!/usr/bin/env python3
"""Maia 2 UCI chess engine.

Wraps the Maia 2 neural network (https://github.com/CSSLab/maia2) in a UCI
interface so it can be used from any chess GUI, including En Croissant.

Maia 2 is a single transformer trained on human games that predicts moves
conditioned on Elo, so unlike a classical engine there is no search: each
`go` runs one forward pass over the policy and, for every reported line,
one forward pass on the resulting position to obtain the expected score a
player of the configured level would achieve after the move.

UCI options:
  MaiaElo   - Elo the model conditions on (1100-1900, steps of 100)
  ModelType - Maia 2 checkpoint to use (rapid or blitz)
  MultiPV   - number of candidate human moves to report
  Threads / Hash - accepted for GUI compatibility, no effect

The Maia 2 checkpoints are downloaded from the official source on first use
and cached next to this script.
"""

from __future__ import annotations

import contextlib
import io
import math
import os
import sys
import time
from pathlib import Path

import chess

MAIA_MIN_ELO = 1100
MAIA_MAX_ELO = 1900

options = {
    "MaiaElo": 1500,
    "ModelType": "rapid",
    "MultiPV": 1,
    "Threads": 1,
    "Hash": 16,
}

board = chess.Board()
chess960 = False

# populated lazily: (model_type, model, prepared)
_state = None


def out(line: str) -> None:
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def load_model():
    """Load the Maia 2 model, capturing library output that would corrupt
    the UCI stream (gdown progress bars, torch warnings) into stderr."""
    global _state
    if _state is not None and _state[0] == options["ModelType"]:
        return _state[1], _state[2]
    out(f"info string loading Maia 2 {options['ModelType']} model "
        f"(first run downloads the weights)...")
    sys.stdout.flush()
    with contextlib.redirect_stdout(sys.stderr):
        from maia2 import inference
        from maia2.model import from_pretrained

        model = from_pretrained(
            type=options["ModelType"],
            device="cpu",
            save_root=str(Path(__file__).resolve().parent / "models"),
        )
        prepared = inference.prepare()
    _state = (options["ModelType"], model, prepared)
    out("info string Maia 2 model ready")
    return model, prepared


def win_prob_to_cp(win_prob: float) -> int:
    """Map an expected score (side-to-move POV, 0..1) to centipawns."""
    p = min(max(win_prob, 1e-3), 1 - 1e-3)
    return max(-1500, min(1500, round(600.0 * math.log(p / (1.0 - p)))))


def predict(fen: str) -> tuple[dict[str, float], float]:
    """Policy (uci -> prob, side-to-move notation) and the expected score of
    WHITE (Maia 2's value head is White-perspective for any side to move)."""
    from maia2 import inference

    model, prepared = _state[1], _state[2]
    with contextlib.redirect_stdout(io.StringIO()):
        move_probs, white_win_prob = inference.inference_each(
            model, prepared, fen, options["MaiaElo"], options["MaiaElo"]
        )
    return move_probs, white_win_prob


def search() -> None:
    start = time.time()
    load_model()

    fen = board.fen()
    move_probs, _ = predict(fen)

    legal = {m.uci(): m for m in board.legal_moves}
    ranked = sorted(
        ((prob, uci) for uci, prob in move_probs.items() if uci in legal),
        key=lambda item: -item[0],
    )
    multipv = max(1, min(options["MultiPV"], len(ranked)))

    for i, (prob, uci) in enumerate(ranked[:multipv], start=1):
        mover_is_white = board.turn == chess.WHITE
        board.push(legal[uci])
        if board.is_checkmate():
            score = "mate 0"
        elif board.is_stalemate() or board.is_insufficient_material():
            score = "cp 0"
        else:
            _, white_score = predict(board.fen())
            score = f"cp {win_prob_to_cp(white_score if mover_is_white else 1.0 - white_score)}"
        board.pop()
        out(
            f"info depth 1 seldepth 1 multipv {i} nodes 1 "
            f"nps 1 score {score} pv {uci}"
        )

    best = ranked[0][1] if ranked else None
    if best is None:  # no policy hit: fall back to a legal move
        best = next(iter(legal.values())).uci()
    out(f"info string {int((time.time() - start) * 1000)} ms, "
        f"Elo {options['MaiaElo']} {options['ModelType']}")
    out(f"bestmove {best}")


def set_position(tokens: list[str]) -> None:
    global board
    if tokens and tokens[0] == "startpos":
        fen, rest = chess.STARTING_FEN, tokens[1:]
    else:
        fen, rest = tokens[1], tokens[2:]
    board = chess.Board(fen, chess960=chess960)
    if rest and rest[0] == "moves":
        for uci in rest[1:]:
            board.push(chess.Move.from_uci(uci))


def main() -> None:
    global board, chess960
    out("id name Maia 2")
    out("id author CSSLab (UofT), UCI wrapper")
    out(f"option name MaiaElo type spin default {options['MaiaElo']} "
        f"min {MAIA_MIN_ELO} max {MAIA_MAX_ELO} step 100")
    out("option name ModelType type combo default rapid var rapid var blitz")
    out("option name MultiPV type spin default 1 min 1 max 20")
    out("option name Threads type spin default 1 min 1 max 256")
    out("option name Hash type spin default 16 min 1 max 4096")
    out("uciok")

    for line in sys.stdin:
        tokens = line.split()
        if not tokens:
            continue
        cmd, args = tokens[0], tokens[1:]
        if cmd == "uci":
            out("id name Maia 2")
            out("uciok")
        elif cmd == "isready":
            load_model()
            out("readyok")
        elif cmd == "setoption":
            try:
                name_idx = args.index("name") + 1
                value_idx = args.index("value") + 1 if "value" in args else None
                name = " ".join(
                    args[name_idx : (value_idx - 1) if value_idx else len(args)]
                )
                if value_idx:
                    value = " ".join(args[value_idx:])
                    if name == "UCI_Chess960":
                        chess960 = value.lower() == "true"
                        board = chess.Board(board.fen(), chess960=chess960)
                    elif name in ("MultiPV", "Threads", "Hash", "MaiaElo"):
                        options[name] = int(value)
                    elif name == "ModelType":
                        options[name] = value
            except ValueError:
                pass
        elif cmd == "ucinewgame":
            board = chess.Board()
        elif cmd == "position":
            set_position(args)
        elif cmd == "go":
            search()
        elif cmd == "stop":
            pass  # search is synchronous and already answered
        elif cmd == "quit":
            break


if __name__ == "__main__":
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    try:
        main()
    except BrokenPipeError:
        pass
