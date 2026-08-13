/* FPL Draft Challenge — slot-level season selection + legacy render guards.
   The core game engine still owns drafts, persistence, validation and scoring. This layer
   only prevents a season dropdown change from rebuilding all 11 prompt cards. */
(() => {
  "use strict";

  const grid = document.getElementById("grid");
  if (!grid) return;

  /*
   * The core season handler does exactly the state work we want:
   *   drafts[id].season = value; save(); render();
   *
   * Its expensive part is the final render(), which recreates the whole XI and rebinds
   * every control. Because render is a global function binding in the classic game script,
   * keep the original function for every other action but replace that one call with a
   * single-slot metadata refresh when a season-select change is currently being handled.
   */
  let pendingSeasonId = "";
  const fullRender = typeof render === "function" ? render : null;

  function selectedRecord(id) {
    try {
      const draft = drafts?.[id];
      return draft ? getRecord(draft.playerId, draft.season) : null;
    } catch {
      return null;
    }
  }

  function refreshSeasonSlot(id) {
    const slot = document.getElementById(`slot-${id}`);
    if (!slot) {
      fullRender?.();
      return;
    }

    const record = selectedRecord(id);
    const confirm = slot.querySelector("[data-confirm]");
    if (confirm) confirm.disabled = !record;

    let meta = slot.querySelector(".selected-meta");
    if (!record) {
      meta?.remove();
      return;
    }

    if (!meta) {
      meta = document.createElement("div");
      meta.className = "selected-meta";
      const feedback = slot.querySelector(".feedback");
      const choiceRow = slot.querySelector(".choice-row");
      if (feedback) feedback.before(meta);
      else if (choiceRow) choiceRow.insertAdjacentElement("afterend", meta);
      else slot.appendChild(meta);
    }

    const price = Number.isFinite(record.startingPrice)
      ? `£${record.startingPrice.toFixed(1)}m starting price`
      : "Starting price unavailable";
    meta.textContent = `${record.club} · ${record.position} · ${price}`;
  }

  // Capture fires immediately before the game engine's existing target-level change
  // listener. No event is stopped or replayed; this only identifies which render call can
  // safely be reduced to a slot refresh.
  document.addEventListener("change", event => {
    const select = event.target instanceof Element
      ? event.target.closest(".season-select[data-season]")
      : null;
    if (!select || !grid.contains(select)) return;
    pendingSeasonId = select.dataset.season || "";
  }, true);

  if (fullRender) {
    try {
      render = function(...args) {
        if (pendingSeasonId) {
          const id = pendingSeasonId;
          pendingSeasonId = "";
          refreshSeasonSlot(id);
          return;
        }
        return fullRender.apply(this, args);
      };
    } catch {
      // If a future bundling change makes the global render binding immutable, fail open:
      // the core engine continues using its original full render rather than risking state.
      pendingSeasonId = "";
    }
  }

  // Older Phase 4.5 dashboard code still computes its dashboard once a second. Guard the
  // instance HTML setters so unchanged markup is a no-op; when only the countdown changed,
  // update that text node rather than rebuilding the whole dashboard.
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
