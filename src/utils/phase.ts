import { type Chess, SquareSet } from "chessops";

// Logic copied from Lichess
// https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/Divider.scala

function majorsAndMinors(pos: Chess): number {
  return pos.board.occupied.diff(pos.board.king).diff(pos.board.pawn).size();
}

function backrankSparse(pos: Chess): boolean {
  const firstRank = new SquareSet(0xff, 0);
  const lastRank = new SquareSet(0, 0xff000000);

  const whiteBackrank = firstRank.intersect(pos.board.white).size();
  const blackBackrank = lastRank.intersect(pos.board.black).size();

  return whiteBackrank < 4 || blackBackrank < 4;
}

function score(y: number, white: number, black: number): number {
  if (white === 0 && black === 0) return 0;
  if (white === 1 && black === 0) return 1 + (8 - y);
  if (white === 2 && black === 0) return y > 2 ? 2 + (y - 2) : 0;
  if (white === 3 && black === 0) return y > 1 ? 3 + (y - 1) : 0;
  if (white === 4 && black === 0) return y > 1 ? 3 + (y - 1) : 0;

  if (white === 0 && black === 1) return 1 + y;
  if (white === 1 && black === 1) return 5 + Math.abs(4 - y);
  if (white === 2 && black === 1) return 4 + (y - 1);
  if (white === 3 && black === 1) return 5 + (y - 1);

  if (white === 0 && black === 2) return y < 6 ? 2 + (6 - y) : 0;
  if (white === 1 && black === 2) return 4 + (7 - y);
  if (white === 2 && black === 2) return 7;

  if (white === 0 && black === 3) return y < 7 ? 3 + (7 - y) : 0;
  if (white === 1 && black === 3) return 5 + (7 - y);

  if (white === 0 && black === 4) return y < 7 ? 3 + (7 - y) : 0;

  return 0;
}

const getMixednessRegions = () => {
  const regions: { region: SquareSet; y: number }[] = [];
  for (let y = 0; y <= 6; y++) {
    for (let x = 0; x <= 6; x++) {
      const shift = x + 8 * y;

      const baseRegion = BigInt(0x0303);
      const shifted = baseRegion << BigInt(shift);

      const lo = Number(shifted & BigInt(0xffffffff));
      const hi = Number(shifted >> BigInt(32));

      regions.push({ region: new SquareSet(lo, hi), y: y + 1 });
    }
  }
  return regions;
};

const mixednessRegions = getMixednessRegions();

function mixedness(pos: Chess): number {
  return mixednessRegions.reduce((acc, { region, y }) => {
    const whitePieces = pos.board.white.intersect(region).size();
    const blackPieces = pos.board.black.intersect(region).size();
    return acc + score(y, whitePieces, blackPieces);
  }, 0);
}

export type GamePhases = {
  middlegamePly: number | null;
  endgamePly: number | null;
};

export function getGamePhases(boards: Chess[]): GamePhases {
  let middlegamePly: number | null = null;
  let endgamePly: number | null = null;

  for (let i = 0; i < boards.length; i++) {
    const board = boards[i];
    if (middlegamePly === null) {
      if (
        majorsAndMinors(board) <= 10 ||
        backrankSparse(board) ||
        mixedness(board) > 150
      ) {
        middlegamePly = i;
      }
    }

    if (middlegamePly !== null && endgamePly === null) {
      if (majorsAndMinors(board) <= 6) {
        endgamePly = i;
      }
    }
  }

  return { middlegamePly, endgamePly };
}
