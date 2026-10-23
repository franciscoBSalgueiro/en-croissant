(() => {
  "use strict";
  const key = "__enCroissantContentScript";
  if (globalThis[key]) return;
  const { getContext, deepLink } = globalThis.EnCroissantExtension;
  const label = "Analyze in En Croissant";
  let button = null;
  let timer = null;
  let interval = null;
  let observer = null;
  let running = false;

  function removeButton() {
    button?.remove();
    button = null;
  }

  function reconcile() {
    timer = null;
    const context = getContext(document, location.href);
    if (!context) {
      removeButton();
      return;
    }
    if (!button) {
      button = document.createElement("a");
      button.dataset.enCroissant = "analyze";
      button.textContent = label;
      button.title = "Open this game in the En Croissant desktop app (installation required)";
      button.setAttribute("aria-label", label);
      // A real link preserves keyboard access and the browser's user gesture
      // for external-protocol prompts. Revalidate synchronously on activation
      // so a SPA cannot launch the previous game's stale URL.
      const activate = (event) => {
        const current = getContext(document, location.href);
        if (!current || !event.isTrusted) {
          event.preventDefault();
          if (!current) reconcile();
          return;
        }
        button.href = deepLink(current.gameUrl);
        event.stopPropagation();
      };
      button.addEventListener("click", activate);
      button.addEventListener("auxclick", activate);
    }
    const className =
      context.site === "lichess"
        ? "ec-analyze ec-analyze--lichess button button-metal"
        : "ec-analyze ec-analyze--chess cc-button-component cc-button-secondary";
    if (button.className !== className) button.className = className;
    const href = deepLink(context.gameUrl);
    if (button.getAttribute("href") !== href) button.setAttribute("href", href);
    if (button.parentElement !== context.target) context.target.append(button);
  }

  function schedule() {
    if (running && timer === null) timer = setTimeout(reconcile, 100);
  }

  function start() {
    if (running) return;
    running = true;
    observer = new MutationObserver((records) => {
      if (records.some((record) => !button?.contains(record.target))) schedule();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-hidden", "href", "style"],
    });
    // pushState/replaceState do not emit popstate, and page history lives in
    // another JS world. A small fallback poll covers URL-only SPA navigation.
    interval = setInterval(() => {
      if (!document.hidden) schedule();
    }, 1000);
    reconcile();
  }

  function stop() {
    running = false;
    observer?.disconnect();
    clearInterval(interval);
    clearTimeout(timer);
    timer = null;
    removeButton();
  }

  addEventListener("popstate", schedule);
  addEventListener("hashchange", schedule);
  addEventListener("pagehide", stop);
  addEventListener("pageshow", start);
  document.addEventListener("visibilitychange", schedule);
  globalThis[key] = { stop };
  start();
})();
