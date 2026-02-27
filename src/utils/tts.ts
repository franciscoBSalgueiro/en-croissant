import { getDefaultStore } from "jotai";
import {
  ttsApiKeyAtom,
  ttsAutoNarrateAtom,
  ttsEnabledAtom,
  ttsSpeedAtom,
  ttsVoiceIdAtom,
  ttsVolumeAtom,
} from "@/state/atoms";
import type { TreeNode } from "@/utils/treeReducer";

// --- Audio playback state ---

let currentAudio: HTMLAudioElement | null = null;
let currentAbort: AbortController | null = null;
let requestGeneration = 0;

// Cache: cacheKey -> blob URL (never revoked while in cache)
const audioCache = new Map<string, string>();

// --- SAN to spoken English ---

const PIECE_NAMES: Record<string, string> = {
  K: "King",
  Q: "Queen",
  R: "Rook",
  B: "Bishop",
  N: "Knight",
};

export function sanToSpoken(san: string): string {
  if (!san) return "";

  // Castling
  if (san === "O-O" || san === "0-0") return "castles kingside";
  if (san === "O-O-O" || san === "0-0-0") return "castles queenside";

  let spoken = san;

  // Strip check/checkmate symbols for separate handling
  const isCheckmate = spoken.endsWith("#");
  const isCheck = spoken.endsWith("+");
  spoken = spoken.replace(/[+#]$/, "");

  // Handle promotion: e.g. e8=Q -> e8 promotes to Queen
  const promoMatch = spoken.match(/^(.+)=([QRBN])$/);
  if (promoMatch) {
    const base = promoMatch[1];
    const promoPiece = PIECE_NAMES[promoMatch[2]] || promoMatch[2];
    spoken = `${sanMoveToSpoken(base)} promotes to ${promoPiece}`;
  } else {
    spoken = sanMoveToSpoken(spoken);
  }

  if (isCheckmate) spoken += ", checkmate";
  else if (isCheck) spoken += ", check";

  return spoken;
}

function sanMoveToSpoken(san: string): string {
  // Piece moves: Nf3, Bxe6, Rae1, Qd1, etc.
  const pieceMatch = san.match(/^([KQRBN])([a-h]?[1-8]?)(x?)([a-h][1-8])$/);
  if (pieceMatch) {
    const piece = PIECE_NAMES[pieceMatch[1]] || pieceMatch[1];
    const disambig = pieceMatch[2]; // e.g. "a" in Rae1
    const captures = pieceMatch[3] === "x";
    const dest = pieceMatch[4];

    let result = piece;
    if (disambig) result += ` ${disambig}`;
    if (captures) result += " takes";
    result += ` ${dest}`;
    return result;
  }

  // Pawn captures: exd5, dxe4
  const pawnCapture = san.match(/^([a-h])x([a-h][1-8])$/);
  if (pawnCapture) {
    return `${pawnCapture[1]} takes ${pawnCapture[2]}`;
  }

  // Simple pawn move: e4, d5
  const pawnMove = san.match(/^([a-h][1-8])$/);
  if (pawnMove) {
    return pawnMove[1];
  }

  // Fallback: return as-is
  return san;
}

// --- Chess vocabulary for comment text ---

// Expand inline SAN notation that appears in comment text
// e.g. "7.Nf3 controls e5" -> "7. Knight f3 controls e5"
// e.g. "Bg3 stays active" -> "Bishop g3 stays active"
function expandInlineSAN(text: string): string {
  // Move number + SAN: "7.Nf3" or "12.Bf5" or "28...Rxa8" or "5.Qxd8+"
  // Replace dots with comma so TTS doesn't say "dot"
  // Note: trailing (?!\w) instead of \b because +/# are non-word chars
  // and \b fails between two non-word chars (e.g. "+" followed by space)
  text = text.replace(
    /\b(\d+)(\.{1,3})([KQRBN]?[a-h]?x?[a-h][1-8](?:=[QRBN])?[+#]?)(?!\w)/g,
    (_match, num, _dots, san) => {
      return `${num}, ${sanToSpoken(san)}`;
    },
  );

  // Standalone SAN at word boundary: "Bg3 stays active", "Nf3 controls", "Qxd8+ strips"
  // Must start with piece letter followed by file/rank
  text = text.replace(
    /\b([KQRBN][a-h]?x?[a-h][1-8][+#]?)(?!\w)/g,
    (_match, san) => sanToSpoken(san),
  );

  return text;
}

// Chess terms that TTS engines mispronounce
function applyChessVocab(text: string): string {
  // "en prise" - French pronunciation hint
  text = text.replace(/\ben prise\b/gi, "on preez");

  // Piece abbreviations in prose: "R vs R", "R+6P vs R+B+N+4P"
  text = text.replace(/\bR vs R\b/gi, "Rook versus Rook");
  text = text.replace(/\bR vs\b/gi, "Rook versus");
  text = text.replace(/\bR\+/g, "Rook plus ");
  text = text.replace(/\bB\+/g, "Bishop plus ");
  text = text.replace(/\bN\+/g, "Knight plus ");
  text = text.replace(/\bvs\b/gi, "versus");

  // Castling in prose
  text = text.replace(/\bO-O-O\b/g, "castles queenside");
  text = text.replace(/\bO-O\b/g, "castles kingside");

  // Piece+square in prose: "Ra8 is hanging" -> "Rook on a8 is hanging"
  text = text.replace(
    /\b([KQRBN])([a-h][1-8])\s+(is|was|has|can|stays|controls|defends|attacks|guards|covers|on)\b/g,
    (_m: string, piece: string, sq: string, verb: string) =>
      `${PIECE_NAMES[piece] || piece} on ${sq} ${verb}`,
  );

  // Standalone "P" as pawns (careful - only when it looks like piece count)
  text = text.replace(/(\d)P\b/g, "$1 pawns");

  return text;
}

// --- Comment cleaning for TTS ---

const ANNOTATION_SPOKEN: Record<string, string> = {
  "!!": "Brilliant move.",
  "!": "Good move.",
  "!?": "Interesting move.",
  "?!": "Dubious move.",
  "?": "Mistake.",
  "??": "Blunder.",
};

export function cleanCommentForTTS(comment: string): string {
  if (!comment) return "";

  let text = comment;

  // Strip PGN embedded tags: [%eval ...], [%csl ...], [%cal ...], [%clk ...]
  text = text.replace(/\[%(?:eval|csl|cal|clk)\s+[^\]]*\]/g, "");

  // Strip annotation symbols that might appear in text
  text = text.replace(/^(?:\?\?|\?\!|\!\?|\!\!|\?|\!)\s*/g, "");

  // Strip leading quality words that duplicate annotation spoken form
  // e.g. when ?? annotation says "Blunder", strip "BLUNDER." from comment start
  text = text.replace(
    /^(?:BLUNDER|BRILLIANT|EXCELLENT|GOOD|MISTAKE|INACCURACY|DUBIOUS)[.!,:]?\s*/i,
    "",
  );

  // Expand inline SAN notation in comment text
  text = expandInlineSAN(text);

  // Deduplicate repeated move numbers in lists
  // "6, Bishop f5, 6, Knight d7, or 6, Knight f6"
  // -> "6, Bishop f5, Knight d7, or Knight f6"
  const seenMoveNums = new Set<string>();
  text = text.replace(/(\d+),\s+/g, (match, num) => {
    if (seenMoveNums.has(num)) return "";
    seenMoveNums.add(num);
    return match;
  });

  // Strip any remaining dots in move numbers that weren't caught above
  // e.g. "6...a5" or "move 28..." -> replace dots with comma
  text = text.replace(/(\d+)(\.{1,3})/g, "$1,");

  // Apply chess vocabulary fixes
  text = applyChessVocab(text);

  // Clean up multiple spaces and trim
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

export function annotationsToSpoken(annotations: string[]): string {
  return annotations
    .map((a) => ANNOTATION_SPOKEN[a] || "")
    .filter(Boolean)
    .join(" ");
}

// --- Build full narration for a move node ---

export function buildNarration(
  san: string | null,
  comment: string,
  annotations: string[],
  halfMoves: number,
): string {
  const parts: string[] = [];

  // Move number + move in spoken form
  if (san) {
    const moveNum = Math.ceil(halfMoves / 2);
    const movePrefix = `${moveNum}, `;
    parts.push(movePrefix + sanToSpoken(san) + ".");
  }

  // Annotation quality assessment — add pause before praise/criticism
  const annoSpoken = annotationsToSpoken(annotations);
  if (annoSpoken) parts.push(annoSpoken);

  // Comment text — separated by pause
  const cleanComment = cleanCommentForTTS(comment);
  if (cleanComment) parts.push(cleanComment);

  // Join with pauses (period + space gives TTS a natural breath)
  return parts.join("  ");
}

// --- ElevenLabs API ---

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

async function generateSpeech(
  text: string,
  apiKey: string,
  voiceId: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`);
  }

  return response.arrayBuffer();
}

// --- Public API ---

export function stopSpeaking() {
  // Abort any in-flight API request
  if (currentAbort) {
    currentAbort.abort();
    currentAbort = null;
  }
  // Bump generation so any pending responses are discarded
  requestGeneration++;
  // Stop any playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  // Note: we do NOT revoke blob URLs here — they stay in audioCache for replay
}

export async function speakText(text: string): Promise<void> {
  const store = getDefaultStore();
  const apiKey = store.get(ttsApiKeyAtom);
  const voiceId = store.get(ttsVoiceIdAtom) || DEFAULT_VOICE_ID;
  const volume = store.get(ttsVolumeAtom);
  const speed = store.get(ttsSpeedAtom);

  if (!apiKey || !text.trim()) return;

  // Stop any currently playing audio and cancel in-flight requests
  stopSpeaking();

  // Tag this request with a generation number so stale responses are discarded
  const thisGeneration = ++requestGeneration;
  const abort = new AbortController();
  currentAbort = abort;

  try {
    const cacheKey = `${voiceId}:${text}`;
    let blobUrl = audioCache.get(cacheKey);

    if (!blobUrl) {
      const audioData = await generateSpeech(text, apiKey, voiceId, abort.signal);
      if (thisGeneration !== requestGeneration) return;

      const blob = new Blob([audioData], { type: "audio/mpeg" });
      blobUrl = URL.createObjectURL(blob);
      audioCache.set(cacheKey, blobUrl);
    }

    if (thisGeneration !== requestGeneration) return;

    currentAudio = new Audio(blobUrl);
    currentAudio.volume = volume;
    currentAudio.playbackRate = speed;
    await currentAudio.play();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    console.error("TTS error:", e);
  }
}

export async function speakComment(comment: string): Promise<void> {
  const cleaned = cleanCommentForTTS(comment);
  if (cleaned) {
    await speakText(cleaned);
  }
}

export async function speakMoveNarration(
  san: string | null,
  comment: string,
  annotations: string[],
  halfMoves: number,
): Promise<void> {
  const narration = buildNarration(san, comment, annotations, halfMoves);
  if (narration) {
    await speakText(narration);
  }
}

export function isTTSEnabled(): boolean {
  const store = getDefaultStore();
  return store.get(ttsEnabledAtom);
}

export function isAutoNarrateEnabled(): boolean {
  const store = getDefaultStore();
  return store.get(ttsEnabledAtom) && store.get(ttsAutoNarrateAtom);
}

// --- Precache ---

// Build narration text for a node (same as what would be spoken)
function narrationForNode(node: TreeNode): string | null {
  if (!node.comment && node.annotations.length === 0) return null;
  return buildNarration(
    node.san,
    node.comment,
    node.annotations,
    node.halfMoves,
  );
}

// Precache all narrations for a game tree in the background
// Fires API calls sequentially to avoid rate limiting
export async function precacheGame(root: TreeNode): Promise<number> {
  const store = getDefaultStore();
  const apiKey = store.get(ttsApiKeyAtom);
  const voiceId = store.get(ttsVoiceIdAtom) || DEFAULT_VOICE_ID;

  if (!apiKey) return 0;

  // Collect all narration texts
  const texts: string[] = [];
  const queue: TreeNode[] = [root];
  while (queue.length > 0) {
    const node = queue.pop()!;
    const narration = narrationForNode(node);
    if (narration) {
      const cacheKey = `${voiceId}:${narration}`;
      if (!audioCache.has(cacheKey)) {
        texts.push(narration);
      }
    }
    for (const child of node.children) {
      queue.push(child);
    }
  }

  if (texts.length === 0) return 0;

  console.log(`TTS precaching ${texts.length} annotations...`);

  let cached = 0;
  for (const text of texts) {
    const cacheKey = `${voiceId}:${text}`;
    if (audioCache.has(cacheKey)) continue; // double-check

    try {
      const audioData = await generateSpeech(text, apiKey, voiceId);
      const blob = new Blob([audioData], { type: "audio/mpeg" });
      const blobUrl = URL.createObjectURL(blob);
      audioCache.set(cacheKey, blobUrl);
      cached++;
    } catch (e) {
      console.error("TTS precache error:", e);
      break; // stop on error (rate limit, etc.)
    }
  }

  console.log(`TTS precached ${cached}/${texts.length} annotations`);
  return cached;
}

// --- Voice listing ---

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
}

export async function listVoices(
  apiKey: string,
): Promise<ElevenLabsVoice[]> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });

  if (!response.ok) {
    throw new Error(`Failed to list voices: ${response.status}`);
  }

  const data = await response.json();
  return (data.voices || []).map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category || "premade",
  }));
}

export function clearAudioCache() {
  for (const url of audioCache.values()) {
    URL.revokeObjectURL(url);
  }
  audioCache.clear();
}
