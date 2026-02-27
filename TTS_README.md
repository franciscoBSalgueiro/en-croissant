# Text-to-Speech Narration for Chess Annotations

This fork adds **ElevenLabs TTS narration** to En Croissant, turning annotated PGN files into spoken chess lessons. Step through any game and hear every comment read aloud with correct chess pronunciation.

Built for studying annotated master games and reviewing your own game debriefs without staring at the screen.

## What It Does

Load any PGN with annotations, press forward through the moves, and hear:

- **Move narration**: "14, Rook e3. Good move." (move number + spoken SAN + annotation quality)
- **Comment narration**: Full commentary read aloud with chess terms pronounced correctly
- **Automatic playback**: Audio triggers as you step through moves, or click the speaker icon on any comment to hear it on demand

### Chess-Aware Text Preprocessing

The TTS engine doesn't just read raw text -- it understands chess notation:

| Written in PGN | Spoken aloud |
|-----------------|-------------|
| `Nf3` | "Knight f3" |
| `Bxe6+` | "Bishop takes e6, check" |
| `O-O-O` | "castles queenside" |
| `e8=Q#` | "e8 promotes to Queen, checkmate" |
| `Rae1` | "Rook a e1" (disambiguation) |
| `5.Qxd8+` (in comments) | "5, Queen takes d8, check" |
| `en prise` | "on preez" (French pronunciation) |
| `Ra8 is hanging` | "Rook on a8 is hanging" |
| `R vs R` | "Rook versus Rook" |
| `6...Bf5` (move number dots) | "6, Bishop f5" (natural pause, no "dot") |

Comments are cleaned before speaking: `[%eval]`, `[%cal]`, `[%csl]` tags are stripped. Leading quality words that duplicate the NAG symbol are removed (so `?? {BLUNDER. The rook hangs}` doesn't stutter "Blunder. Blunder.").

### Caching

Every narration is cached in memory after the first generation. Stepping backward and forward through a game replays instantly from cache -- no API calls. You can also precache an entire game tree in the background so there are zero pauses during playback.

The cache is keyed by voice + text, so changing the voice clears the relevant entries. Changing playback speed does **not** invalidate the cache (speed is applied client-side).

A **Clear Audio Cache** button in Settings lets you force re-generation after editing annotations.

## Setup

### 1. Get an ElevenLabs API Key

Sign up at [elevenlabs.io](https://elevenlabs.io). The free tier gives you ~10,000 characters/month -- enough for several annotated games.

### 2. Configure in Settings

Open En Croissant and go to **Settings > Sound**:

| Setting | Description |
|---------|-------------|
| **Text-to-Speech** | Master toggle. Enable to activate all TTS features. |
| **Auto-Narrate on Move** | When enabled, annotations are read aloud automatically as you step through moves with the arrow keys. |
| **ElevenLabs API Key** | Paste your `sk_...` API key here. Stored locally. |
| **TTS Voice** | Pick from your available ElevenLabs voices. A "Test" button lets you preview. |
| **TTS Volume** | 0-100%. Independent of the board sound effects volume. |
| **TTS Speed** | 0.5x to 2.0x playback speed. Applied client-side, so changing speed never invalidates the audio cache. |
| **TTS Audio Cache** | "Clear Audio Cache" button. Use after editing PGN annotations to force fresh audio generation. |

### 3. Load an Annotated PGN

Import or open any PGN file with comments. Step through with arrow keys -- you'll hear every annotation narrated.

For best results, annotations should follow standard PGN comment format:
```
14. Re3! {Blocks the e-file and attacks the queen.} Be6 {But now the knight is undefended.}
```

## How It Works

### Architecture

The TTS system is implemented as two self-contained files plus small integration hooks:

```
src/
  utils/
    tts.ts                          # Core engine (465 lines)
      - sanToSpoken()               # SAN -> spoken English
      - cleanCommentForTTS()        # Strip PGN tags, expand inline SAN, apply chess vocab
      - buildNarration()            # Assemble move + annotation + comment into one utterance
      - speakText()                 # ElevenLabs API call with caching
      - precacheGame()              # Background precache entire game tree
      - clearAudioCache()           # Revoke blob URLs and reset cache
  components/
    settings/
      TTSSettings.tsx               # UI components (202 lines)
        - TTSEnabledSwitch
        - TTSAutoNarrateSwitch
        - TTSApiKeyInput
        - TTSVoiceSelect
        - TTSVolumeSlider
        - TTSSpeedSlider
        - TTSClearCacheButton
```

### Integration Points (minimal changes to existing code)

| File | Change | Lines |
|------|--------|-------|
| `src/state/atoms.ts` | 6 persistent atoms for TTS settings | +24 |
| `src/components/settings/SettingsPage.tsx` | 7 settings entries in Sound tab | +62 |
| `src/state/store/tree.ts` | Auto-narrate on move navigation, stop on go-back | +24 |
| `src/components/common/Comment.tsx` | Speaker icon button when TTS enabled | +33 |
| `src/components/tabs/ImportModal.tsx` | `defaultPath` for file dialog | +1 |

Total: **828 lines added**, 25 lines modified. The 2 new files account for 667 of those lines. The feature is almost entirely additive -- it doesn't change existing behavior when TTS is disabled.

### Audio Pipeline

```
PGN Move Node
    |
    v
buildNarration(san, comment, annotations, halfMoves)
    |
    +-- sanToSpoken(san)              # "Nf3+" -> "Knight f3, check"
    +-- annotationsToSpoken(["!"])    # "Good move."
    +-- cleanCommentForTTS(comment)
            |
            +-- strip [%eval], [%cal], [%csl] tags
            +-- strip leading quality words (BLUNDER, EXCELLENT, etc.)
            +-- expandInlineSAN()     # "5.Qxd8+" -> "5, Queen takes d8, check"
            +-- deduplicate move numbers in lists
            +-- applyChessVocab()     # "en prise" -> "on preez", "Ra8 is" -> "Rook on a8 is"
    |
    v
"14, Rook e3.  Good move.  Blocks the e-file and attacks the queen."
    |
    v
speakText(narration)
    |
    +-- check audioCache (voiceId:text -> blob URL)
    |       |
    |       +-- [HIT]  -> play from cache instantly
    |       +-- [MISS] -> call ElevenLabs API -> cache blob URL -> play
    |
    v
HTMLAudioElement.play()
    volume = ttsVolumeAtom
    playbackRate = ttsSpeedAtom
```

### Stale Request Handling

Rapid navigation (holding the arrow key) generates many requests. A generation counter ensures only the latest request plays:

1. Each `speakText()` call increments `requestGeneration`
2. In-flight API requests are aborted via `AbortController`
3. When a response arrives, it checks if its generation matches current -- stale responses are silently discarded
4. Any currently playing audio is stopped before the new one starts

This means you can scrub through a game quickly without audio piling up or playing out of order.

## Writing TTS-Friendly Annotations

These guidelines produce the best spoken narration:

### SAN in comments
Use standard SAN notation. The preprocessor expands it:
- `"After 7.Nf3, White controls e5"` -> "After 7, Knight f3, White controls e5"
- `"The Bg5 pins the knight"` -> "The Bishop g5 pins the knight"

### Annotation symbols
The NAG glyph (`!`, `??`, `!?`, etc.) generates spoken quality words automatically. Don't duplicate them in the comment:
- Bad: `?? {BLUNDER. A terrible move...}`  (TTS says "Blunder. Blunder. A terrible move")
- Good: `?? {A terrible move...}` (TTS says "Blunder. A terrible move")

### Move number dots
Standard PGN notation works: `6...Bf5`. The preprocessor converts dots to commas for natural pauses instead of "dot dot dot."

### Periods for pacing
Periods create natural TTS pauses. Use them between distinct ideas:
```
{Doubled isolated e-pawns. The f-file is ripped open. The position is strategically won.}
```

### Arrows and circles
`[%cal ...]` and `[%csl ...]` tags are stripped from audio automatically. Use them freely for visual annotations without affecting narration.

## ElevenLabs API Details

- **Model**: `eleven_turbo_v2_5` (fast, good quality)
- **Default voice**: Adam (`pNInz6obpgDQGcFmaJgB`)
- **Voice settings**: stability 0.5, similarity_boost 0.75, style 0.0, speaker_boost on
- **Audio format**: MP3 (audio/mpeg)
- **Rate limits**: The precacher runs sequentially to avoid hitting ElevenLabs rate limits. If an error occurs during precaching, it stops gracefully.

## Compatibility

This feature is purely additive. When TTS is disabled (the default), the app behaves identically to upstream En Croissant. No existing functionality is modified.

The TTS atoms persist to localStorage, so settings survive app restarts. The audio cache is in-memory only and clears on restart.

## License

Same as En Croissant: GPL-3.0.
