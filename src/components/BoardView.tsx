import Chessground from "react-chessground";

function BoardView({ fen }: { fen: string }) {
  return (
    <Chessground width={400} height={400} viewOnly={true} fen={fen} />
  );
}

export default BoardView;
