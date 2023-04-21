import { createContext } from "react";
import { CompleteGame, defaultGame } from "../../utils/db";

const GameContext = createContext<CompleteGame>({
    game: defaultGame(),
    currentMove: [],
});

export default GameContext;
