/// <reference types="vite/client" />

declare module "/wasm/stockfish/stockfish.js" {
  const init: any;
  export default init;
}

declare module "*.wasm?url" {
  const url: string;
  export default url;
}

declare module "*.worker.js?url" {
  const url: string;
  export default url;
}
