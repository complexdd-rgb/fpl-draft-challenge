/* FPL Draft Challenge — season-select responsiveness + legacy render guards.
   Presentation/performance only: the existing game handler still owns draft state,
   validation, persistence and scoring. */
(() => {
  "use strict";

  const grid = document.getElementById("grid");
  if (!grid) return;

  // The legacy game handler rebuilds the full XI immediately on a season change. Let the
  // browser paint the native select value first, then replay the same change event on the
  // next frame. The original handler still performs the actual save/render unchanged.
  const replaying = new WeakSet();
  document.addEventListener("change", event => {
    const select = event.target instanceof Element ? event.target.closest(".season-select[data-season]") : null;
    if (!select || replaying.has(select)) return;

    event.stopImmediatePropagation();
    const confirm = select.closest(".slot")?.querySelector("[data-confirm]");
    if (confirm) confirm.disabled = true;
    select.dataset.seasonPending = "1";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!select.isConnected) return;
        replaying.add(select);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        replaying.delete(select);
        delete select.dataset.seasonPending;
      });
    });
  }, true);

  // Older Phase 4.5 dashboard code still writes the same panel HTML every second. Guard
  // those instance setters so identical writes become no-ops. For the hero, a countdown-
  // only change updates just the countdown text instead of rebuilding the whole dashboard.
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  if (!descriptor?.get || !descriptor?.set) return;
  const nativeGet = descriptor.get;
  const nativeSet = descriptor.set;
  const countdownPattern = /(<strong id="phase45HeroCountdown">)([^<]*)(<\/strong>)/;
  const normaliseHero = value => String(value).replace(countdownPattern, "$1__COUNTDOWN__$3");

  function guardInnerHtml(element, { countdownOnly = false } = {}) {
    if (!element || element.dataset.fplInnerHtmlGuard === "1") return;
    element.dataset.fplInnerHtmlGuard = "1";
    Object.defineProperty(element, "innerHTML", {
      configurable: true,
      get() { return nativeGet.call(this); },
      set(value) {
        const next = String(value ?? "");
        const current = nativeGet.call(this);
        if (next === current) return;

        if (countdownOnly && normaliseHero(next) === normaliseHero(current)) {
          const match = next.match(countdownPattern);
          const countdown = this.querySelector("#phase45HeroCountdown");
          if (match && countdown) countdown.textContent = match[2];
          return;
        }
        nativeSet.call(this, next);
      }
    });
  }

  guardInnerHtml(document.getElementById("phase45Hero"), { countdownOnly: true });
  guardInnerHtml(document.getElementById("liveMiniPitch"));
  guardInnerHtml(document.getElementById("historyGridExtended"));
  guardInnerHtml(document.getElementById("achievementGrid"));
})();
