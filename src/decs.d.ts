declare module "react-chessground" {
    import { Config } from "chessground/config";
    interface ReactChessGroundProps extends Config {
        width?: number | string;
        height?: number | string;
        style?: React.CSSProperties;
    }

    class Chessground extends React.Component<
        ReactChessGroundProps,
        unknown
    > { }
    export default Chessground;
}
