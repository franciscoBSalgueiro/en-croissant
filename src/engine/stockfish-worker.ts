/*
  Web Worker that loads Stockfish.js in the browser.
  To avoid bundler resolution issues, load via CDN by default.
  You can override the URL by setting self.STOCKFISH_URL before worker init.
*/

let sf: any;

async function init() {
  try {
    const prevOnMessage = (self as any).onmessage;
    const tryImport = (url: string) => {
      // eslint-disable-next-line no-console
      console.info("[WASM] loading Stockfish from", url);
      (self as any).importScripts(url);
      return true;
    };
    const candidates: string[] = [];
    if ((self as any).STOCKFISH_URL) candidates.push((self as any).STOCKFISH_URL);
    // Prefer local hashed builds we ship in public/wasm (single and lite variants)
    candidates.push(
      "/wasm/stockfish-17.1-single-a496a04.js",
      "/wasm/stockfish-17.1-lite-51f59da.js",
    );
    // Generic local file (requires matching stockfish.wasm next to it). Keep as a later fallback.
    candidates.push("/wasm/stockfish.js");
    // Known files in node_modules (dev server may expose)
    candidates.push(
      "/node_modules/stockfish/src/stockfish-17.1-single-a496a04.js",
      "/node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js",
      "/node_modules/stockfish/src/stockfish-17.1-lite-51f59da.js",
      "/node_modules/stockfish/src/stockfish-17.1-8e4d048.js",
    );
    // CDN fallbacks (explicit file names, not index)
    candidates.push(
      "https://cdn.jsdelivr.net/npm/stockfish@17.1.0/src/stockfish-17.1-lite-single-03e3232.js",
      "https://cdn.jsdelivr.net/npm/stockfish@17.1.0/src/stockfish-17.1-single-a496a04.js",
      "https://cdn.jsdelivr.net/npm/stockfish@17.1.0/src/stockfish-17.1-lite-51f59da.js",
    );

    let loaded = false;
    for (const url of candidates) {
      try { if (tryImport(url)) { loaded = true; break; } } catch (_) { /* try next */ }
    }
    if (!loaded) throw new Error("No Stockfish source could be loaded");
    const g: any = self as any;
    const factory = g.STOCKFISH || g.Stockfish || g.stockfish || g.Module || g.default;
    if (typeof factory === "function") {
      const maybe = factory();
      sf = (maybe && typeof (maybe as any).then === "function") ? await (maybe as any) : maybe;
      // eslint-disable-next-line no-console
      console.info("[WASM] engine initialized (factory build)");
      sf.onmessage = (e: any) => {
        const data = typeof e === "string" ? e : e?.data;
        if (data != null) postMessage(data);
      };
      // Bridge parent -> engine for factory builds
      (self as any).onmessage = (e: MessageEvent<string>) => {
        if (!sf) return;
        // eslint-disable-next-line no-console
        console.debug("[Worker<-]", e.data);
        sf.postMessage(e.data);
      };
    } else if ((self as any).onmessage && (self as any).onmessage !== prevOnMessage) {
      // Self-contained worker build; engine attached its own onmessage/postMessage pipeline.
      // eslint-disable-next-line no-console
      console.info("[WASM] engine initialized (self-contained worker build)");
      sf = self as any;
      // Nothing else to wire; the engine will postMessage directly to parent.
    } else {
      // eslint-disable-next-line no-console
      console.error("[WASM] Stockfish factory not found and no self-contained handler present", Object.keys(g).filter(k => /stockfish|Module|STOCKFISH/i.test(k)));
      return;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[WASM] failed to load Stockfish", e);
  }
}

init();


