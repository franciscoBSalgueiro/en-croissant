import type { BestMoves } from "@/bindings";

// Lightweight IndexedDB cache for engine analysis (works in web and Tauri webview)

type GoModeDepth = { t: "Depth"; c: number };
type GoModeTime = { t: "Time"; c: number };
type GoModeNodes = { t: "Nodes"; c: number };
type GoModeInfinite = { t: "Infinite" };
export type GoMode = GoModeDepth | GoModeTime | GoModeNodes | GoModeInfinite | { t: string; c?: number };

export type EngineOptionKV = { name: string; value: string | number | boolean | null };

export type AnalysisCacheKeyParams = {
  fen: string;
  moves: string[];
  engineId: string; // desktop: engine.path; web: wasm engine id
  goMode: GoMode;
  options: EngineOptionKV[];
};

export type CachedAnalysis = {
  bestMoves: BestMoves[];
  depth: number;
  nodes: number;
  createdAt: number; // seconds since epoch
  lastAccessed: number; // seconds since epoch
};

const DB_NAME = "botvinnik-cache";
const DB_VERSION = 1;
const STORE = "engineAnalysis";
const INDEX_LAST_ACCESSED = "idx_last_accessed";
const MAX_ENTRIES = 10000;

type CacheRecord = {
  key: string;
  value: CachedAnalysis;
};

function secondsNow(): number {
  return Math.floor(Date.now() / 1000);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "key" });
        os.createIndex(INDEX_LAST_ACCESSED, ["value", "lastAccessed"], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Stable, portable key: canonical JSON then SHA-256 hex; fallback to JSON if subtle crypto missing
export async function buildAnalysisCacheKey(params: AnalysisCacheKeyParams): Promise<string> {
  const canonical = JSON.stringify({
    fen: params.fen,
    moves: params.moves,
    engineId: params.engineId,
    goMode: params.goMode,
    options: [...params.options].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  });
  try {
    if (window.crypto && window.crypto.subtle) {
      const data = new TextEncoder().encode(canonical);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      const bytes = Array.from(new Uint8Array(digest));
      const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
      return `v1:${hex}`;
    }
  } catch (_) {
    // ignore and fall through
  }
  return `v1:${canonical}`;
}

export async function getCachedAnalysis(key: string): Promise<CachedAnalysis | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      const rec = req.result as CacheRecord | undefined;
      if (!rec) {
        resolve(null);
        return;
      }
      // touch
      rec.value.lastAccessed = secondsNow();
      store.put(rec);
      resolve(rec.value);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function storeAnalysis(key: string, value: Omit<CachedAnalysis, "createdAt" | "lastAccessed">): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const now = secondsNow();
    const rec: CacheRecord = { key, value: { ...value, createdAt: now, lastAccessed: now } };
    const putReq = store.put(rec);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
  await pruneIfNeeded();
}

async function pruneIfNeeded(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const count = countReq.result || 0;
      if (count <= MAX_ENTRIES) {
        resolve();
        return;
      }
      const toDelete = count - MAX_ENTRIES;
      const idx = store.index(INDEX_LAST_ACCESSED);
      let deleted = 0;
      const cursorReq = idx.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result as IDBCursorWithValue | null;
        if (!cursor || deleted >= toDelete) {
          resolve();
          return;
        }
        const primaryKey = (cursor.primaryKey as any) as string;
        store.delete(primaryKey);
        deleted += 1;
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
}


