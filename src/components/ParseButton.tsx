import { Button } from "@mantine/core";
import { invoke } from "@tauri-apps/api";

function ParseButton() {
  async function readPGN() {
    // invoke("read_pgn", {
    //   file: "C:\\Users\\Francisco\\Desktop\\Lichess Elite Database\\lichess_elite_2016-03.pgn",
    // }).then((res) => console.log(res));
    
    invoke("get_opening", {
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      }).then((res) => console.log(res));
  }

  return <Button onClick={() => readPGN()}>PARSE</Button>;
}

export default ParseButton;
