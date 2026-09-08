/* FPL Draft Challenge — Daily Challenge player-facing redesign v1.
   DOM/accessibility/presentation only. No generation, prompt testing, scoring or persistence logic lives here. */
(() => {
  "use strict";

  const challenge = window.FPL_DAILY_CHALLENGE || null;
  const grid = document.getElementById("grid");
  if (!challenge || !grid) return;

  document.body.classList.add("daily-ui-redesign-v1");

  const promptIndex = new Map(challenge.prompts.map((prompt, index) => [prompt.id, index]));
  const stateText = Object.freeze({
    open: "Open",
    selected: "Selected",
    invalid: "Invalid",
    confirmed: "Confirmed",
    "given-up": "Given up"
  });

  let refreshQueued = false;

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  }

  function slotPromptId(slot) {
    return String(slot?.id || "").replace(/^slot-/, "");
  }

  function slotState(slot) {
    if (!slot) return "open";
    if (slot.classList.contains("given-up")) return "given-up";
    if (slot.classList.contains("compact-confirmed")) return "confirmed";
    if (slot.querySelector(".feedback.bad")) return "invalid";
    const search = slot.querySelector(".player-search");
    const hasSelection = Boolean(slot.querySelector(".selected-meta")) || Boolean(search?.value?.trim());
    return hasSelection ? "selected" : "open";
  }

  function ensureSkipLink() {
    if (document.querySelector(".daily-skip-link")) return;
    const link = document.createElement("a");
    link.className = "daily-skip-link";
    link.href = "#grid";
    link.textContent = "Skip to draft board";
    document.body.prepend(link);
  }

  function ensureBoardLabels() {
    const heading = document.querySelector(".section-heading h2");
    if (heading && !heading.id) heading.id = "dailyDraftHeading";
    grid.setAttribute("role", "list");
    if (heading?.id) grid.setAttribute("aria-labelledby", heading.id);

    const dock = document.getElementById("draftProgressDock");
    if (dock) dock.setAttribute("aria-label", "Draft progress and navigation");
    const dockLabel = document.querySelector("#draftProgressDock .dock-stat:first-child span");
    if (dockLabel) dockLabel.textContent = "complete";

    const penalty = document.getElementById("dockPenalty");
    if (penalty) {
      penalty.setAttribute("aria-live", "polite");
      penalty.setAttribute("aria-atomic", "true");
    }
  }

  function ensureOverview() {
    let overview = document.getElementById("dailySquadOverview");
    if (overview) return overview;

    overview = document.createElement("section");
    overview.id = "dailySquadOverview";
    overview.className = "daily-squad-overview";
    overview.setAttribute("aria-labelledby", "dailySquadOverviewTitle");
    overview.innerHTML = `
      <div class="daily-squad-overview-head">
        <div>
          <span class="overview-kicker">Live XI</span>
          <h3 id="dailySquadOverviewTitle">Your draft at a glance</h3>
          <p>Tap a shirt to jump straight to that clue. Confirmed picks, open clues and Give Ups stay visible here.</p>
        </div>
        <div class="daily-squad-count"><strong id="dailySquadResolved">0</strong><span>/ ${challenge.prompts.length} complete</span></div>
      </div>
      <div class="daily-mini-pitch" id="dailyMiniPitch" aria-label="Current draft formation"></div>`;

    const dock = document.getElementById("draftProgressDock");
    const heading = document.querySelector(".section-heading");
    if (dock?.parentNode) dock.parentNode.insertBefore(overview, dock);
    else if (heading?.parentNode) heading.after(overview);
    else grid.before(overview);

    return overview;
  }

  function miniSlotLabel(slot, state, index, position) {
    const confirmed = slot?.querySelector(".confirmed-player strong")?.textContent?.trim();
    const searchValue = slot?.querySelector(".player-search")?.value?.trim();
    if (state === "given-up") return { primary: "Give Up", secondary: `${position} · clue ${index + 1}` };
    if (state === "confirmed" && confirmed) return { primary: confirmed, secondary: `${position} · confirmed` };
    if ((state === "selected" || state === "invalid") && searchValue) return { primary: searchValue, secondary: `${position} · ${stateText[state].toLowerCase()}` };
    return { primary: `Clue ${index + 1}`, secondary: `${position} · open` };
  }

  function renderMiniPitch() {
    ensureOverview();
    const pitch = document.getElementById("dailyMiniPitch");
    if (!pitch) return;

    const positions = ["FWD", "MID", "DEF", "GK"];
    let resolved = 0;
    const rows = positions.map(position => {
      const items = challenge.prompts.map((prompt, index) => ({ prompt, index }))
        .filter(item => item.prompt.position === position)
        .map(({ prompt, index }) => {
          const slot = document.getElementById(`slot-${prompt.id}`);
          const state = slotState(slot);
          if (state === "confirmed" || state === "given-up") resolved++;
          const copy = miniSlotLabel(slot, state, index, position);
          return `<button class="daily-mini-slot" type="button" data-daily-jump="${prompt.id}" data-state="${state}" aria-label="Clue ${index + 1}, ${position}, ${stateText[state]}. ${copy.primary}"><strong>${escapeHtml(copy.primary)}</strong><span>${escapeHtml(copy.secondary)}</span></button>`;
        }).join("");
      return `<div class="daily-mini-line" data-position="${position}">${items}</div>`;
    }).join("");

    if (pitch.innerHTML !== rows) pitch.innerHTML = rows;
    const count = document.getElementById("dailySquadResolved");
    if (count) count.textContent = String(resolved);

    pitch.querySelectorAll("[data-daily-jump]").forEach(button => {
      if (button.dataset.dailyBound === "1") return;
      button.dataset.dailyBound = "1";
      button.addEventListener("click", () => {
        const slot = document.getElementById(`slot-${button.dataset.dailyJump}`);
        slot?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => slot?.querySelector(".player-search, .compact-change, .reopen-give-up")?.focus(), 250);
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function decorateSuggestions(slot, promptId, index, position, state) {
    const input = slot.querySelector(".player-search");
    const suggestions = slot.querySelector(".suggestions");
    if (!input || !suggestions) return;

    if (!input.id) input.id = `daily-player-search-${promptId}`;
    if (!suggestions.id) suggestions.id = `s-${promptId}`;

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-controls", suggestions.id);
    input.setAttribute("aria-expanded", String(!suggestions.classList.contains("hidden")));
    input.setAttribute("aria-label", `Search player for clue ${index + 1}, ${position}`);
    input.setAttribute("aria-invalid", String(state === "invalid"));

    suggestions.setAttribute("role", "listbox");
    suggestions.setAttribute("aria-label", `Player suggestions for clue ${index + 1}`);

    let activeId = "";
    suggestions.querySelectorAll("[data-option]").forEach((option, optionIndex) => {
      if (!option.id) option.id = `daily-option-${promptId}-${optionIndex}`;
      option.setAttribute("role", "option");
      const active = option.classList.contains("active");
      option.setAttribute("aria-selected", String(active));
      if (active) activeId = option.id;
    });
    if (activeId) input.setAttribute("aria-activedescendant", activeId);
    else input.removeAttribute("aria-activedescendant");
  }

  function decorateSlot(slot) {
    const promptId = slotPromptId(slot);
    const index = promptIndex.get(promptId);
    const prompt = Number.isInteger(index) ? challenge.prompts[index] : null;
    if (!prompt) return;

    const state = slotState(slot);
    slot.dataset.dailyState = state;
    slot.setAttribute("role", "listitem");
    slot.setAttribute("aria-label", `Clue ${index + 1}, ${prompt.position}, ${stateText[state]}`);

    const head = slot.querySelector(".slot-head");
    if (head) {
      let chip = head.querySelector(".daily-state-chip");
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "daily-state-chip";
        head.appendChild(chip);
      }
      chip.textContent = stateText[state];
    }

    const feedback = slot.querySelector(".feedback");
    if (feedback) {
      if (!feedback.id) feedback.id = `daily-feedback-${promptId}`;
      feedback.setAttribute("aria-live", state === "invalid" ? "assertive" : "polite");
      feedback.setAttribute("aria-atomic", "true");
      if (state === "invalid") feedback.setAttribute("role", "alert");
      else feedback.setAttribute("role", "status");
    }

    const season = slot.querySelector(".season-select");
    if (season) season.setAttribute("aria-label", `Season for clue ${index + 1}, ${prompt.position}`);

    const confirm = slot.querySelector("[data-confirm]");
    if (confirm) confirm.setAttribute("aria-label", `Confirm selection for clue ${index + 1}`);

    const clear = slot.querySelector("[data-clear]");
    if (clear) clear.setAttribute("aria-label", `${slot.classList.contains("compact-confirmed") ? "Change" : "Clear"} selection for clue ${index + 1}`);

    const giveUp = slot.querySelector("[data-give-up]");
    if (giveUp) giveUp.setAttribute("aria-label", `Give up on clue ${index + 1} and score zero points`);
    const reopen = slot.querySelector("[data-reopen-give-up]");
    if (reopen) reopen.setAttribute("aria-label", `Reopen clue ${index + 1}`);

    decorateSuggestions(slot, promptId, index, prompt.position, state);
  }

  function updateDockProgressA11y() {
    const progress = document.getElementById("dockProgress")?.textContent || "0/11";
    const [current, total] = progress.split("/").map(Number);
    const track = document.querySelector("#draftProgressDock .dock-track");
    if (track && Number.isFinite(current) && Number.isFinite(total)) {
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", "Draft completion");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", String(total));
      track.setAttribute("aria-valuenow", String(current));
      track.setAttribute("aria-valuetext", `${current} of ${total} clues complete`);
    }
  }

  function ensureResultsFlow() {
    const results = document.getElementById("results");
    if (!results) return;

    results.setAttribute("role", "region");
    const headline = document.getElementById("resultHeadline");
    if (headline && !headline.id) headline.id = "resultHeadline";
    if (headline?.id) results.setAttribute("aria-labelledby", headline.id);

    const hero = document.getElementById("resultHero");
    const scoreCard = results.querySelector(".score-card");
    const shareGroup = results.querySelector(".share-button-group, .daily-results-actions");
    if (hero && scoreCard && hero.nextElementSibling !== scoreCard) hero.after(scoreCard);
    if (scoreCard && shareGroup && scoreCard.nextElementSibling !== shareGroup) scoreCard.after(shareGroup);

    if (shareGroup) {
      shareGroup.classList.add("daily-results-actions");
      let leaderboardJump = document.getElementById("dailyLeaderboardJump");
      if (!leaderboardJump) {
        leaderboardJump = document.createElement("button");
        leaderboardJump.id = "dailyLeaderboardJump";
        leaderboardJump.className = "btn daily-leaderboard-jump";
        leaderboardJump.type = "button";
        leaderboardJump.textContent = "View leaderboard";
        shareGroup.appendChild(leaderboardJump);
        leaderboardJump.addEventListener("click", () => {
          const panel = document.getElementById("liveLeaderboardPanel");
          if (panel) {
            panel.scrollIntoView({ behavior: "smooth", block: "start" });
            const submit = panel.querySelector("#leaderboardDisplayName, #leaderboardSubmitResult, #leaderboardRefresh");
            setTimeout(() => submit?.focus(), 300);
            return;
          }
          const status = document.getElementById("copyStatus");
          if (status) status.textContent = "Leaderboard is still loading. Try again in a moment.";
        });
      }
    }

    if (scoreCard) {
      scoreCard.setAttribute("role", "list");
      scoreCard.querySelectorAll(":scope > div").forEach(item => item.setAttribute("role", "listitem"));
    }
  }

  function decorateLeaderboard() {
    const panel = document.getElementById("liveLeaderboardPanel");
    if (!panel) return;
    const heading = panel.querySelector("h2");
    if (heading && !heading.id) heading.id = "dailyLeaderboardHeading";
    panel.setAttribute("role", "region");
    if (heading?.id) panel.setAttribute("aria-labelledby", heading.id);
    const table = panel.querySelector("table");
    if (table) table.setAttribute("aria-label", "Today’s verified leaderboard");
    const state = document.getElementById("leaderboardState");
    if (state) {
      state.setAttribute("aria-live", "polite");
      state.setAttribute("aria-atomic", "true");
    }
  }

  function refresh() {
    ensureSkipLink();
    ensureBoardLabels();
    ensureOverview();
    grid.querySelectorAll(".slot").forEach(decorateSlot);
    renderMiniPitch();
    updateDockProgressA11y();
    ensureResultsFlow();
    decorateLeaderboard();
  }

  const gridObserver = new MutationObserver(scheduleRefresh);
  gridObserver.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  const results = document.getElementById("results");
  if (results) new MutationObserver(scheduleRefresh).observe(results, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true });

  document.addEventListener("keydown", event => {
    if (event.target?.classList?.contains("player-search")) requestAnimationFrame(scheduleRefresh);
  }, true);
  document.addEventListener("input", event => {
    if (event.target?.classList?.contains("player-search")) scheduleRefresh();
  }, true);
  document.addEventListener("focusin", event => {
    if (event.target?.classList?.contains("player-search")) scheduleRefresh();
  }, true);

  window.addEventListener("fpl:prompt-given-up", scheduleRefresh);
  window.addEventListener("fpl:challenge-completed", () => {
    scheduleRefresh();
    setTimeout(scheduleRefresh, 100);
    setTimeout(scheduleRefresh, 700);
  });
  window.addEventListener("fpl:leaderboard-visible", scheduleRefresh);
  window.addEventListener("fpl:leaderboard-updated", scheduleRefresh);

  refresh();
})();
