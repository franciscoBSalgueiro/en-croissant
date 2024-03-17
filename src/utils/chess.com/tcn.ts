import { type NormalMove, charToRole, parseSquare } from "chessops";

const pieceEncoding =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++=";

export function decodeTCN(moveCode: string): NormalMove {
  const move = {} as NormalMove;
  const codeLength = moveCode.length;
  const decodedMoves: NormalMove[] = [];

  for (let i = 0; i < codeLength; i += 2) {
    const pieceIndex1 = pieceEncoding.indexOf(moveCode[i]);
    let pieceIndex2 = pieceEncoding.indexOf(moveCode[i + 1]);

    if (pieceIndex2 > 63) {
      const promotion = "qnrbkp"[Math.floor((pieceIndex2 - 64) / 3)];
      const newIndex =
        pieceIndex1 + (pieceIndex1 < 16 ? -8 : 8) + ((pieceIndex2 - 1) % 3) - 1;

      move.promotion = charToRole(promotion);
      pieceIndex2 = newIndex;
    }

    move.from = parseSquare(
      pieceEncoding[pieceIndex1 % 8] +
        (Math.floor(pieceIndex1 / 8) + 1).toString(),
    )!;

    move.to = parseSquare(
      pieceEncoding[pieceIndex2 % 8] +
        (Math.floor(pieceIndex2 / 8) + 1).toString(),
    )!;

    decodedMoves.push(move);
  }

  return decodedMoves[0];
}
