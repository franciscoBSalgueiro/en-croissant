
// _defineProperty(Chessground, "propTypes", {
//   width: _propTypes["default"].oneOfType([_propTypes["default"].string, _propTypes["default"].number]),
//   height: _propTypes["default"].oneOfType([_propTypes["default"].string, _propTypes["default"].number]),
//   fen: _propTypes["default"].string,
//   orientation: _propTypes["default"].string,
//   turnColor: _propTypes["default"].string,
//   check: _propTypes["default"].string,
//   lastMove: _propTypes["default"].array,
//   selected: _propTypes["default"].string,
//   coordinates: _propTypes["default"].bool,
//   autoCastle: _propTypes["default"].bool,
//   viewOnly: _propTypes["default"].bool,
//   disableContextMenu: _propTypes["default"].bool,
//   resizable: _propTypes["default"].bool,
//   addPieceZIndex: _propTypes["default"].bool,
//   highlight: _propTypes["default"].object,
//   animation: _propTypes["default"].object,
//   movable: _propTypes["default"].object,
//   premovable: _propTypes["default"].object,
//   predroppable: _propTypes["default"].object,
//   draggable: _propTypes["default"].object,
//   selectable: _propTypes["default"].object,
//   onChange: _propTypes["default"].func,
//   onMove: _propTypes["default"].func,
//   onDropNewPiece: _propTypes["default"].func,
//   onSelect: _propTypes["default"].func,
//   items: _propTypes["default"].object,
//   drawable: _propTypes["default"].object
// });

// _defineProperty(Chessground, "defaultProps", {
//   coordinates: true,
//   resizable: true,
//   highlight: {
//     lastMove: true,
//     check: true
//   }
// });

declare module "react-chessground" {
  import { Config } from 'chessground/config';
  interface ReactChessGroundProps extends Config, React.HTMLAttributes<HTMLElement> {
    width?: number | string;
    height?: number | string;
  }

  declare class Chessground extends React.Component<
    ReactChessGroundProps,
    any
  > {}
  export default Chessground;
}
