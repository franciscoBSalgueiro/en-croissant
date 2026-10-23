# Analyze in En Croissant

A shared Manifest V3 extension for desktop Chrome/Chromium and Firefox. Adds an
**Analyze in En Croissant** link inside Chess.com and Lichess game controls.
En Croissant must be installed with its `encroissant:` protocol registered.

## Build and install

Requires Node.js 22 or later.

```sh
cd browser-extension
npm ci
npm test
npm run build
```

- **Chrome:** open `chrome://extensions`, enable Developer mode, choose **Load
  unpacked**, and select `browser-extension/dist/chrome`.
- **Firefox (development):** open `about:debugging#/runtime/this-firefox`, choose
  **Load Temporary Add-on**, and select `dist/firefox/manifest.json`. Temporary
  installations are removed when Firefox exits.
- **Distribution:** upload `dist/en-croissant-chrome-1.0.0.zip` to the Chrome Web
  Store and `dist/en-croissant-firefox-1.0.0.zip` to Mozilla Add-ons for review and
  signing. Firefox requires signing for permanent installation. The source
  `manifest.json` contains the stable Firefox ID; do not change it after release.
  Both packages use identical JavaScript/CSS. Chrome omits Firefox metadata.

The packages contain only the manifest, local scripts/styles, app icons and
license. Tests, dependencies, and development files are excluded. ZIP timestamps
are fixed for reproducible builds. Update the version in both `package.json` and
`manifest.json` for releases, then regenerate `package-lock.json` with npm install.

## Behavior

| Interface                                                                | Availability                                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Chess.com `/game/live/ID`, `/game/daily/ID`, `/analysis/game/TYPE/ID`    | Historical game/analysis controls                                                             |
| Chess.com `/live/game/ID`, `/play/online/game/ID`, `/play/daily/game/ID` | After visible game completion                                                                 |
| Chess.com `/play/online`, `/play/daily`, `/live`                         | After completion, using `gameId` in the URL or an unambiguous game link in the end-of-game UI |
| Chess.com `/analysis?gameId=ID`                                          | Historical game controls; `gameType=daily` preserves daily games                              |
| Lichess `/GAMEID`, `/GAMEID/white`, `/GAMEID/black`, player links        | After a rendered terminal result, including historical analysis pages                         |

Lichess studies, puzzles, broadcasts, arbitrary FEN analysis, Chess.com events,
and games without a discoverable supported ID are intentionally excluded.
Ongoing Lichess analysis pages do not enable the button. The extension does not
automatically open the desktop app or enable engine analysis during play.

Each adapter uses several ordered control selectors and puts the link inside the
first visible match. Lichess uses its metal button styling and theme variables;
Chess.com uses its button classes with scoped secondary-button styling. The
ordinary anchor supports keyboard focus, Enter, and external-protocol prompts.
The browser may ask permission to launch En Croissant. If no app launches, check
the desktop installation/protocol registration; browsers do not reliably expose
whether an external application is installed or launched successfully.

## Desktop integration and trust boundary

The link is exactly:

```text
encroissant://import?url=<encodeURIComponent(canonical HTTPS game URL)>
```

`src/utils/launch.ts` handles `import`, reads `url` through `URL.searchParams`,
and calls the existing `getGameFromUrl`, PGN parser and analysis-tab creation.
`src/App.tsx` delivers both startup URLs (`getCurrent`) and subsequent URLs
(`onOpenUrl`). No desktop modifications, alternate import endpoints, background
service worker, or browser-specific API wrappers are needed.

Validation accepts only exact HTTPS site hosts and supported game routes/IDs;
credentials and nonstandard ports are rejected. Imported URLs have no fragment
or query parameters. Lichess's four-character player secret is stripped. A
completion dialog cannot supply an off-site URL or an ambiguous game selection.
Activation rechecks the current route and UI synchronously, and ignores synthetic
click events. Game IDs and rendered state are page-controlled input, not a
security or anti-cheating guarantee. The desktop importer remains responsible
for validating its own inputs from other deep-link sources.

A throttled MutationObserver handles result text changes, hidden dialogs, lazy
mounting and replaced controls. `popstate`, `hashchange`, visibility changes and
a one-second foreground timer cover navigation, including `pushState` and
`replaceState` in the page's separate JS world. Injection is idempotent and
observers/timers stop on `pagehide` and resume on `pageshow` for bfcache restores.
No page-world scripts or patches to either site's JavaScript are used.

## Privacy

The extension has no analytics, storage, cookies, remote code, or network
requests. It reads only the supported page URL and game-interface DOM to render
the link. On explicit activation it passes the canonical public game URL to the
locally installed En Croissant application, which retrieves the game using its
existing importer. No browsing history or game data is sent to an extension
server. See [PRIVACY.md](PRIVACY.md) for store submission text.

## Validation and release checklist

`npm test` runs URL, security, DOM and lifecycle regressions with jsdom. The
fixtures model the specific selector structures in the adapters; they are not
live-site end-to-end tests. Lichess result/control selectors can be checked in
`lichess-org/lila`, `ui/round/src/view/{replay,table}.ts` and
`ui/analyse/src/view/{components,tools}.ts`. Site markup may change independently
of this repository. Unknown markup fails closed instead of guessing a game.

Before publishing each release, smoke-test both signed/loaded browser builds:

1. Finish a Chess.com live game, including a draw; test after dismissing the
   result modal, and test a rematch. Confirm no stale link remains during play.
2. Open Chess.com live and daily historical analysis; use next/previous game
   navigation, then Back/Forward. Confirm exactly one button targets that game.
3. Finish a Lichess game, open its historical computer-analysis page, flip the
   board, and open a 12-character player link. Confirm only the public 8-character
   ID reaches En Croissant. Check an ongoing game and ongoing analysis as well.
4. Exercise lazy-loaded/replaced controls, narrow layouts, light/dark themes,
   keyboard focus/Enter, background tabs and bfcache restoration.
5. With En Croissant closed and already running, activate the button and accept
   the browser prompt. Verify the imported players, result and moves. Test the
   missing-app and declined-prompt cases; the page should remain usable.
6. Run Mozilla `web-ext lint --source-dir dist/firefox` and inspect Chrome's
   extension error panel. Review the store packages and privacy declarations.

Real browser protocol handoff, authenticated post-game flows and store review
must be verified in the target release environment; jsdom cannot validate them.
