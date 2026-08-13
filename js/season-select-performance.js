/* FPL Draft Challenge — stable draft-card layout + slot-level draft updates.
   The core game engine still owns drafts, persistence, validation and scoring. This layer
   prevents player/season choices from rebuilding all 11 prompt cards and reserves the
   eventual metadata/action space so cards do not jump when a player is selected. */
(() => {
  "use strict";

  const grid = document.getElementById("grid");
  if (!grid) return;

  const fullRender = typeof render === "function" ? render : null;
  let pendingSlotId = "";
  let pendingSlotReason = "";

  function installStableCardStyles() {
    if (document.getElementById("fplStableDraftCardStyles")) return;
    const style = document.createElement("style");
    style.id = "fplStableDraftCardStyles";
    style.textContent = `
      .slot.fpl-stable-draft-space .selected-meta{min-height:18px}
      .slot.fpl-stable-draft-space .clear{min-height:30px}
      .slot.fpl-stable-draft-space .fpl-reserved-meta,
      .slot.fpl-stable-draft-space .fpl-reserved-clear{
        visibility:hidden!important;
        pointer-events:none!important;
        user-select:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function bindPlaceholderClear(button, id) {
    if (!button || button.dataset.fplFastClearBound === "1") return;
    button.dataset.fplFastClearBound = "1";
    button.addEventListener("click", () => {
      try {
        if (completedRecord) return;
        ensureStarted();
        delete drafts[id];
        delete picks[id];
        feedback[id] = "";
        save();
        fullRender?.();
        reserveCardSpace();
      } catch {
        fullRender?.();
        reserveCardSpace();
      }
    });
  }

  function ensureReservedMeta(slot) {
    let meta = slot.querySelector(".selected-meta");
    if (meta) return meta;
    meta = document.createElement("div");
    meta.className = "selected-meta fpl-reserved-meta";
    meta.setAttribute("aria-hidden", "true");
    meta.innerHTML = "&nbsp;";
    const feedbackNode = slot.querySelector(".feedback");
    const choiceRow = slot.querySelector(".choice-row");
    if (feedbackNode) feedbackNode.before(meta);
    else if (choiceRow) choiceRow.insertAdjacentElement("afterend", meta);
    else slot.appendChild(meta);
    return meta;
  }

  function ensureReservedClear(slot, id) {
    let button = slot.querySelector("[data-clear], .fpl-reserved-clear");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "clear fpl-reserved-clear";
      button.disabled = true;
      button.setAttribute("aria-hidden", "true");
      button.textContent = "Clear selection";
      slot.appendChild(button);
    }
    if (button.classList.contains("fpl-reserved-clear")) bindPlaceholderClear(button, id);
    return button;
  }

  function reserveSlotSpace(slot) {
    if (!slot || slot.classList.contains("compact-confirmed")) return;
    const id = slot.querySelector(".player-search[data-id]")?.dataset.id || "";
    if (!id) return;
    slot.classList.add("fpl-stable-draft-space");
    ensureReservedMeta(slot);
    ensureReservedClear(slot, id);
  }

  function reserveCardSpace() {
    grid.querySelectorAll(".slot:not(.compact-confirmed)").forEach(reserveSlotSpace);
  }

  function selectedRecord(id) {
    try {
      const draft = drafts?.[id];
      return draft ? getRecord(draft.playerId, draft.season) : null;
    } catch {
      return null;
    }
  }

  function activateMeta(slot, record) {
    const meta = ensureReservedMeta(slot);
    if (!record) {
      meta.classList.add("fpl-reserved-meta");
      meta.setAttribute("aria-hidden", "true");
      meta.innerHTML = "&nbsp;";
      return;
    }
    const price = Number.isFinite(record.startingPrice)
      ? `£${record.startingPrice.toFixed(1)}m starting price`
      : "Starting price unavailable";
    meta.classList.remove("fpl-reserved-meta");
    meta.removeAttribute("aria-hidden");
    meta.textContent = `${record.club} · ${record.position} · ${price}`;
  }

  function activateClear(slot, id, active) {
    const button = ensureReservedClear(slot, id);
    if (!active) {
      button.classList.add("fpl-reserved-clear");
      button.disabled = true;
      button.removeAttribute("data-clear");
      button.setAttribute("aria-hidden", "true");
      bindPlaceholderClear(button, id);
      return;
    }
    if (button.classList.contains("fpl-reserved-clear")) {
      button.classList.remove("fpl-reserved-clear");
      button.disabled = false;
      button.dataset.clear = id;
      button.removeAttribute("aria-hidden");
      button.textContent = "Clear selection";
      bindPlaceholderClear(button, id);
    }
  }

  function refreshDraftSlot(id) {
    const slot = document.getElementById(`slot-${id}`);
    if (!slot) {
      fullRender?.();
      reserveCardSpace();
      return;
    }

    try {
      const prompt = challenge.prompts.find(item => item.id === id);
      const draft = drafts?.[id] || null;
      const player = draft ? getPlayer(draft.playerId) : null;
      if (!prompt || !player) {
        fullRender?.();
        reserveCardSpace();
        return;
      }

      slot.classList.add("fpl-stable-draft-space");

      const input = slot.querySelector(".player-search[data-id]");
      if (input) input.value = player.name;

      const suggestionBox = slot.querySelector(".suggestions");
      if (suggestionBox) {
        suggestionBox.classList.add("hidden");
        suggestionBox.innerHTML = "";
      }

      const seasons = eligibleSeasons(player, prompt);
      const select = slot.querySelector(".season-select[data-season]");
      if (select) {
        select.disabled = false;
        select.replaceChildren(...seasons.map(item => new Option(item.season, item.season, false, item.season === draft.season)));
        select.value = draft.season;
      }

      const record = selectedRecord(id);
      const confirm = slot.querySelector("[data-confirm]");
      if (confirm) confirm.disabled = !record;

      activateMeta(slot, record);
      activateClear(slot, id, true);

      const feedbackNode = slot.querySelector(".feedback");
      if (feedbackNode) {
        const message = feedback?.[id] || "Choose a season, then confirm.";
        feedbackNode.textContent = message;
        feedbackNode.classList.toggle("good", message.startsWith("✅"));
        feedbackNode.classList.toggle("bad", message.startsWith("❌"));
      }

      if (typeof updateStatus === "function") updateStatus();
    } catch {
      fullRender?.();
      reserveCardSpace();
    }
  }

  // A suggestion click calls choosePlayer(), which previously ended by rebuilding the entire
  // grid. Mark that one upcoming render so it can become a single-card refresh instead.
  document.addEventListener("click", event => {
    const option = event.target instanceof Element ? event.target.closest("[data-option]") : null;
    if (!option || !grid.contains(option)) return;
    const slot = option.closest(".slot");
    const id = slot?.querySelector(".player-search[data-id]")?.dataset.id || "";
    if (!id) return;
    pendingSlotId = id;
    pendingSlotReason = "player";
  }, true);

  // The core season handler still performs drafts[id].season=value and save(). Its render is
  // reduced to the same single-card refresh, so neither player nor season selection touches
  // the other ten cards.
  document.addEventListener("change", event => {
    const select = event.target instanceof Element
      ? event.target.closest(".season-select[data-season]")
      : null;
    if (!select || !grid.contains(select)) return;
    pendingSlotId = select.dataset.season || "";
    pendingSlotReason = "season";
  }, true);

  if (fullRender) {
    try {
      render = function(...args) {
        if (pendingSlotId && (pendingSlotReason === "player" || pendingSlotReason === "season")) {
          const id = pendingSlotId;
          pendingSlotId = "";
          pendingSlotReason = "";
          refreshDraftSlot(id);
          return;
        }
        const result = fullRender.apply(this, args);
        reserveCardSpace();
        return result;
      };
    } catch {
      pendingSlotId = "";
      pendingSlotReason = "";
    }
  }

  installStableCardStyles();
  reserveCardSpace();

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
