declare module "react-chessground" {
    import { Config } from "chessground/config";
    interface ReactChessGroundProps
        extends Config,
            React.HTMLAttributes<HTMLElement> {
        width?: number | string;
        height?: number | string;
    }

    declare class Chessground extends React.Component<
        ReactChessGroundProps,
        unknown
    > {}
    export default Chessground;
}
