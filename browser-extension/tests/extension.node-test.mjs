import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const core = await readFile(new URL("../src/core.js", import.meta.url), "utf8");
const content = await readFile(new URL("../src/content.js", import.meta.url), "utf8");
const dom = new JSDOM("", { runScripts: "outside-only" });
dom.window.eval(core);
const { canonicalGameUrl, deepLink } = dom.window.EnCroissantExtension;
const chess = "https://www.chess.com/game/live/123456789";
const lichess = "https://lichess.org/Ab12Cd34";

for (const input of [
  chess,
  "https://chess.com/analysis/game/live/123456789?tab=review#42",
  "https://www.chess.com/live/game/123456789",
  "https://www.chess.com/play/online/game/123456789",
  "https://www.chess.com/play/online?gameId=123456789",
  "https://www.chess.com/analysis?gameId=123456789",
])
  test(`canonical Chess.com URL: ${input}`, () => assert.equal(canonicalGameUrl(input), chess));

for (const input of [lichess, `${lichess}/black#42`, `${lichess}SeCr/white?foo=bar`]) {
  test(`canonical Lichess URL: ${input}`, () => assert.equal(canonicalGameUrl(input), lichess));
}

for (const input of [
  "http://lichess.org/Ab12Cd34",
  "https://lichess.org.evil.test/Ab12Cd34",
  "https://www.chess.com.evil.test/game/live/123",
  "https://evil.test/?url=" + chess,
  "https://user:password@lichess.org/Ab12Cd34",
  "https://lichess.org:444/Ab12Cd34",
  "javascript:alert(1)",
  "encroissant://import?url=x",
  "not a URL",
  "https://lichess.org/analysis",
  "https://lichess.org/training",
  "https://lichess.org/study/Ab12Cd34",
  "https://lichess.org/analysis/standard/Ab12Cd34",
  "https://www.chess.com/game/live/0",
  "https://www.chess.com/game/live/123/garbage",
  "https://www.chess.com/member/test?gameId=123",
  "https://www.chess.com/analysis?gameId=1&gameId=2",
  "https://lichess.org/Ab12Cd34/evil",
  "https://lichess.org/Ab12%2f34",
])
  test(`reject unsupported URL: ${input}`, () => assert.equal(canonicalGameUrl(input), null));

test("daily games retain their type", () => {
  assert.equal(
    canonicalGameUrl("https://www.chess.com/analysis/game/daily/456"),
    "https://www.chess.com/game/daily/456",
  );
  assert.equal(
    canonicalGameUrl("https://www.chess.com/play/daily?gameId=456"),
    "https://www.chess.com/game/daily/456",
  );
});

test("deep link round-trips through the desktop contract without player secrets", () => {
  const link = new URL(deepLink(`${lichess}SeCr/black?token=secret#4`));
  assert.equal(link.protocol, "encroissant:");
  assert.equal(link.host, "import");
  assert.equal(link.searchParams.get("url"), lichess);
  assert.equal(deepLink("https://evil.test/game/live/1"), null);
});

const chessAnalysis =
  '<main class="analysis-layout-main"><aside class="board-layout-sidebar"><div class="analysis-controls-component"></div></aside></main>';
const chessLive =
  '<main id="board-layout-main"></main><aside class="board-layout-sidebar"><div class="game-controls-component"></div></aside>';
const lichessRound =
  '<main class="round__app"><div class="moves"></div><div class="rcontrols"></div></main>';
const lichessAnalysis =
  '<main class="analyse"><div class="analyse__tools"><div class="result">½-½</div></div><div class="analyse__underboard"></div></main>';

function setup(t, url, html) {
  const instance = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  t.after(() => instance.window.close());
  instance.window.eval(core);
  return instance.window;
}
const getButton = (window) => window.document.querySelector('[data-en-croissant="analyze"]');
const settle = () => new Promise((resolve) => setTimeout(resolve, 160));

test("a direct Chess.com game route alone does not prove completion", async (t) => {
  const window = setup(
    t,
    chess,
    chessLive + '<div class="game-result">Unrelated archive result</div>',
  );
  window.eval(content);
  assert.equal(getButton(window), null);
  window.document.querySelector(".game-controls-component").innerHTML =
    '<div class="game-result">1-0</div>';
  await settle();
  assert.ok(getButton(window));
});

test("historical Chess.com page gets one accessible native-style link", (t) => {
  const window = setup(t, chess.replace("/game/", "/analysis/game/"), chessAnalysis);
  window.eval(content);
  const button = getButton(window);
  assert.equal(button.textContent, "Analyze in En Croissant");
  assert.equal(button.getAttribute("aria-label"), button.textContent);
  assert.equal(new URL(button.href).searchParams.get("url"), chess);
  assert.ok(button.classList.contains("cc-button-component"));
  assert.ok(button.closest(".analysis-controls-component"));
  window.eval(content);
  assert.equal(window.document.querySelectorAll(".ec-analyze").length, 1);
});

test("live Chess.com game stays hidden until completion, then disappears on rematch", async (t) => {
  const window = setup(t, chess.replace("/game/live/", "/play/online/game/"), chessLive);
  window.eval(content);
  assert.equal(getButton(window), null);
  const complete = window.document.createElement("div");
  complete.className = "game-over-modal-content";
  window.document.querySelector("aside").append(complete);
  await settle();
  assert.ok(getButton(window));
  complete.remove();
  window.history.pushState({}, "", "/play/online/game/987");
  await settle();
  assert.equal(getButton(window), null);
});

test("generic live route resolves only an unambiguous completed-game link", (t) => {
  const window = setup(t, "https://www.chess.com/play/online", chessLive);
  const { getContext } = window.EnCroissantExtension;
  window.document.querySelector("aside").innerHTML =
    '<div class="game-over-modal-content"><a href="/analysis/game/live/123456789">Review</a></div>';
  assert.equal(getContext(window.document, window.location.href).gameUrl, chess);
  window.document
    .querySelector(".game-over-modal-content")
    .insertAdjacentHTML("beforeend", '<a href="/game/live/987">Other game</a>');
  assert.equal(getContext(window.document, window.location.href), null);
});

test("unrelated archive links and hidden completion dialogs cannot enable import", (t) => {
  const window = setup(
    t,
    "https://www.chess.com/play/online",
    chessLive +
      `<a href="${chess}">Archive</a><div class="game-over-modal-content" hidden><a href="${chess}">Review</a></div>`,
  );
  window.eval(content);
  assert.equal(getButton(window), null);
});

test("completed Lichess analysis uses native button classes and public game ID", (t) => {
  const window = setup(t, `${lichess}SeCr/black`, lichessAnalysis);
  window.eval(content);
  const button = getButton(window);
  assert.ok(button.classList.contains("button-metal"));
  assert.equal(new URL(button.href).searchParams.get("url"), lichess);
  assert.ok(button.closest(".analyse__underboard"));
});

test("Lichess round button appears on terminal result text updates", async (t) => {
  const window = setup(t, lichess, lichessRound);
  window.eval(content);
  assert.equal(getButton(window), null);
  const result = window.document.createElement("div");
  result.className = "result";
  result.textContent = "*";
  window.document.querySelector(".moves").append(result);
  await settle();
  assert.equal(getButton(window), null);
  result.firstChild.data = "1-0";
  await settle();
  assert.ok(getButton(window));
});

test("ongoing Lichess analysis, studies, puzzles, and tools do not get a button", (t) => {
  for (const [path, html] of [
    ["/Ab12Cd34", lichessAnalysis.replace("½-½", "*")],
    ["/study/Ab12Cd34", lichessAnalysis],
    ["/analysis", lichessAnalysis],
    ["/training/Ab12Cd34", lichessAnalysis],
  ]) {
    const window = setup(t, `https://lichess.org${path}`, html);
    window.eval(content);
    assert.equal(getButton(window), null, path);
  }
});

test("replaces a removed host control without duplicating the button", async (t) => {
  const window = setup(t, chess, chessAnalysis);
  window.eval(content);
  const old = getButton(window);
  window.document.querySelector(".analysis-controls-component").outerHTML =
    '<div class="analysis-controls-component"></div>';
  await settle();
  assert.equal(getButton(window), old);
  assert.equal(window.document.querySelectorAll(".ec-analyze").length, 1);
});

test("URL-only pushState updates links and removes unsupported destinations", async (t) => {
  const window = setup(t, chess, chessAnalysis);
  window.eval(content);
  window.history.pushState({}, "", "/game/daily/987");
  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert.equal(
    new URL(getButton(window).href).searchParams.get("url"),
    "https://www.chess.com/game/daily/987",
  );
  window.history.replaceState({}, "", "/member/test");
  window.dispatchEvent(new window.PopStateEvent("popstate"));
  await settle();
  assert.equal(getButton(window), null);
});

test("stale and synthetic activation is prevented synchronously", (t) => {
  const window = setup(t, chess, chessAnalysis);
  window.eval(content);
  const button = getButton(window);
  const synthetic = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  button.dispatchEvent(synthetic);
  assert.equal(synthetic.defaultPrevented, true);
  window.history.pushState({}, "", "/member/test");
  const stale = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  button.dispatchEvent(stale);
  assert.equal(stale.defaultPrevented, true);
  assert.equal(getButton(window), null);
});

test("bfcache pagehide tears down and pageshow restores the controller", (t) => {
  const window = setup(t, chess, chessAnalysis);
  window.eval(content);
  window.dispatchEvent(new window.PageTransitionEvent("pagehide", { persisted: true }));
  assert.equal(getButton(window), null);
  window.dispatchEvent(new window.PageTransitionEvent("pageshow", { persisted: true }));
  assert.ok(getButton(window));
  window.dispatchEvent(new window.PageTransitionEvent("pageshow", { persisted: true }));
  assert.equal(window.document.querySelectorAll(".ec-analyze").length, 1);
});

test("manifest limits site access and uses no privileged APIs or remote code", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "https://www.chess.com/*",
    "https://chess.com/*",
    "https://lichess.org/*",
  ]);
  for (const path of [
    ...manifest.content_scripts[0].js,
    ...manifest.content_scripts[0].css,
    ...Object.values(manifest.icons),
  ]) {
    assert.ok((await readFile(new URL(`../${path}`, import.meta.url))).length > 0, path);
  }
});
