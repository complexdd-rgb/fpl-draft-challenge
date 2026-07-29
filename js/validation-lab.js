/* FPL Challenge Studio — Validation Lab user interface. */
(() => {
  "use strict";

  let state = {
    playerId: "",
    season: "",
    lastValidation: null
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ready() {
    const engine = window.ValidationEngine;
    const panel = document.getElementById("validationLabPanel");
    if (!engine || !panel || panel.dataset.validationReady === "true") return;
    panel.dataset.validationReady = "true";

    const elements = getElements();
    populatePromptSelect(elements.promptSelect, engine.getPromptLibrary());
    populatePromptSelect(elements.explorerPromptSelect, engine.getPromptLibrary());
    populateSeasonSelect(elements.healthSeason, engine.getAllSeasonLabels(), true);
    bindPlayerSearch(elements, engine);
    bindActions(elements, engine);
    updateOverview(elements, engine);

    const initial = engine.searchPlayers("Ross Barkley", 1)[0] || engine.getPlayers()[0];
    if (initial) choosePlayer(initial, elements, engine);
    if (elements.promptSelect.options.length > 1) {
      const preferred = [...elements.promptSelect.options].find(option => option.value === "mid_midtable_exact_five");
      elements.promptSelect.value = preferred ? preferred.value : elements.promptSelect.options[1].value;
      syncPromptText(elements, engine);
    }
    if (elements.explorerPromptSelect.options.length > 1) {
      elements.explorerPromptSelect.value = elements.promptSelect.value;
    }
    scanSeason(elements, engine);
  }

  function getElements() {
    return {
      overviewPlayers: document.getElementById("validationOverviewPlayers"),
      overviewSeasons: document.getElementById("validationOverviewSeasons"),
      overviewPrompts: document.getElementById("validationOverviewPrompts"),
      overviewEligibility: document.getElementById("validationOverviewEligibility"),
      playerSearch: document.getElementById("validationPlayerSearch"),
      suggestions: document.getElementById("validationPlayerSuggestions"),
      playerSeason: document.getElementById("validationSeasonSelect"),
      inspectBtn: document.getElementById("validationInspectBtn"),
      inspectorStatus: document.getElementById("validationInspectorStatus"),
      inspectorResult: document.getElementById("validationInspectorResult"),
      promptSelect: document.getElementById("validationPromptSelect"),
      promptText: document.getElementById("validationPromptText"),
      evaluateBtn: document.getElementById("validationEvaluateBtn"),
      copyBtn: document.getElementById("validationCopyReportBtn"),
      ruleStatus: document.getElementById("validationRuleStatus"),
      ruleResult: document.getElementById("validationRuleResult"),
      explorerPromptSelect: document.getElementById("validationExplorerPromptSelect"),
      explorerSeason: document.getElementById("validationExplorerSeason"),
      explorerBtn: document.getElementById("validationExploreBtn"),
      explorerStatus: document.getElementById("validationExplorerStatus"),
      explorerResult: document.getElementById("validationExplorerResult"),
      healthSeason: document.getElementById("validationHealthSeason"),
      healthBtn: document.getElementById("validationHealthBtn"),
      healthStatus: document.getElementById("validationHealthStatus"),
      healthResult: document.getElementById("validationHealthResult")
    };
  }

  function populatePromptSelect(select, library) {
    if (!select) return;
    const prompts = (library || []).filter(prompt => prompt?.id && prompt.enabled !== false)
      .sort((a, b) => a.position.localeCompare(b.position) || a.label.localeCompare(b.label));
    select.innerHTML = `<option value="__manual__">Manual prompt text</option>${prompts.map(prompt =>
      `<option value="${escapeHtml(prompt.id)}">${escapeHtml(prompt.position)} · ${escapeHtml(prompt.label)}</option>`
    ).join("")}`;
  }

  function populateSeasonSelect(select, labels, includeAll = false) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `${includeAll ? '<option value="">All seasons</option>' : ""}${labels.map(label => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join("")}`;
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function updateOverview(elements, engine) {
    const players = engine.getPlayers();
    const records = players.flatMap(player => player.seasons || []);
    const eligible = records.filter(record => Number(record.minutes) > 0).length;
    if (elements.overviewPlayers) elements.overviewPlayers.textContent = players.length.toLocaleString("en-GB");
    if (elements.overviewSeasons) elements.overviewSeasons.textContent = records.length.toLocaleString("en-GB");
    if (elements.overviewPrompts) elements.overviewPrompts.textContent = engine.getPromptLibrary().filter(prompt => prompt.enabled !== false).length.toLocaleString("en-GB");
    if (elements.overviewEligibility) elements.overviewEligibility.textContent = `${eligible.toLocaleString("en-GB")} eligible`;
  }

  function bindPlayerSearch(elements, engine) {
    if (!elements.playerSearch) return;
    let timer = null;
    elements.playerSearch.addEventListener("input", () => {
      state.playerId = "";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => renderSuggestions(elements, engine), 80);
    });
    elements.playerSearch.addEventListener("focus", () => renderSuggestions(elements, engine));
    elements.playerSearch.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        const first = engine.searchPlayers(elements.playerSearch.value, 1)[0];
        if (first) choosePlayer(first, elements, engine);
      }
      if (event.key === "Escape") hideSuggestions(elements);
    });
    elements.suggestions?.addEventListener("click", event => {
      const button = event.target.closest("[data-validation-player]");
      if (!button) return;
      const player = engine.resolvePlayer(button.dataset.validationPlayer);
      if (player) choosePlayer(player, elements, engine);
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".validation-player-picker")) hideSuggestions(elements);
    });
  }

  function renderSuggestions(elements, engine) {
    if (!elements.suggestions) return;
    const matches = engine.searchPlayers(elements.playerSearch.value, 10);
    if (!elements.playerSearch.value.trim() || !matches.length) {
      hideSuggestions(elements);
      return;
    }
    elements.suggestions.innerHTML = matches.map(player => {
      const seasons = engine.getPlayerSeasons(player);
      const clubs = [...new Set(seasons.slice(0, 4).map(season => season.club))].join(" · ");
      return `<button type="button" data-validation-player="${escapeHtml(player.playerId)}"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(seasons.length)} seasons${clubs ? ` · ${escapeHtml(clubs)}` : ""}</small></button>`;
    }).join("");
    elements.suggestions.hidden = false;
  }

  function hideSuggestions(elements) {
    if (elements.suggestions) elements.suggestions.hidden = true;
  }

  function choosePlayer(player, elements, engine) {
    state.playerId = player.playerId;
    elements.playerSearch.value = player.name;
    const seasons = engine.getPlayerSeasons(player);
    elements.playerSeason.innerHTML = seasons.map(season => `<option value="${escapeHtml(season.season)}">${escapeHtml(season.season)} · ${escapeHtml(season.club)} · ${escapeHtml(season.position)}</option>`).join("");
    state.season = seasons[0]?.season || "";
    elements.playerSeason.value = state.season;
    hideSuggestions(elements);
    inspectPlayer(elements, engine);
  }

  function currentPlayer(elements, engine) {
    const player = engine.resolvePlayer(state.playerId) || engine.resolvePlayer(elements.playerSearch.value) || engine.searchPlayers(elements.playerSearch.value, 1)[0];
    if (player && !state.playerId) state.playerId = player.playerId;
    return player;
  }

  function bindActions(elements, engine) {
    elements.playerSeason?.addEventListener("change", () => {
      state.season = elements.playerSeason.value;
      inspectPlayer(elements, engine);
    });
    elements.inspectBtn?.addEventListener("click", () => inspectPlayer(elements, engine));
    elements.promptSelect?.addEventListener("change", () => syncPromptText(elements, engine));
    elements.evaluateBtn?.addEventListener("click", () => evaluateRules(elements, engine));
    elements.copyBtn?.addEventListener("click", () => copyReport(elements, engine));
    elements.explorerPromptSelect?.addEventListener("change", () => {
      const prompt = engine.getPromptLibrary().find(item => item.id === elements.explorerPromptSelect.value);
      if (prompt && elements.promptSelect) {
        elements.promptSelect.value = prompt.id;
        elements.promptText.value = prompt.label;
      }
    });
    populateSeasonSelect(elements.explorerSeason, engine.getAllSeasonLabels(), true);
    elements.explorerBtn?.addEventListener("click", () => explorePrompt(elements, engine));
    elements.healthBtn?.addEventListener("click", () => scanSeason(elements, engine));
  }

  function syncPromptText(elements, engine) {
    const prompt = engine.getPromptLibrary().find(item => item.id === elements.promptSelect.value);
    if (prompt) {
      elements.promptText.value = prompt.label;
      elements.promptText.readOnly = true;
    } else {
      elements.promptText.readOnly = false;
      if (!elements.promptText.value.trim()) elements.promptText.value = "Midfielder\nExactly 5 goals\nClub finished 7th–12th";
    }
  }

  function inspectPlayer(elements, engine) {
    const player = currentPlayer(elements, engine);
    const season = elements.playerSeason.value || state.season;
    if (!player || !season) {
      setStatus(elements.inspectorStatus, "Choose a player and season.", "warn");
      return;
    }
    state.playerId = player.playerId;
    state.season = season;
    const result = engine.inspectPlayer(player, season);
    if (!result.ok) {
      setStatus(elements.inspectorStatus, result.error, "fail");
      elements.inspectorResult.innerHTML = "";
      return;
    }
    setStatus(elements.inspectorStatus, `${result.player.name} · ${result.record.season} loaded`, result.health.eligible ? "pass" : "warn");
    elements.inspectorResult.innerHTML = renderInspection(result, engine);
  }

  function renderInspection(result, engine) {
    const identity = [
      ["Club", result.identity.club],
      ["Position", engine.POSITION_LABELS[result.identity.position] || result.identity.position],
      ["Date of birth", result.identity.dateOfBirth || "Missing"],
      ["Age at season start", result.identity.ageAtSeasonStart ?? "Missing"],
      ["Manager", (result.identity.managers || []).join(", ") || "Missing"]
    ];
    const stats = [
      ["FPL points", result.stats.points], ["Minutes", result.stats.minutes], ["Goals", result.stats.goals], ["Assists", result.stats.assists],
      ["Clean sheets", result.stats.cleanSheets], ["Bonus", result.stats.bonus], ["Saves", result.stats.saves], ["Goals conceded", result.stats.goalsConceded]
    ];
    const database = [
      ["Starting price", engine.formatValue("startingPrice", result.database.startingPrice)],
      ["Final price", engine.formatValue("finalPrice", result.database.finalPrice)],
      ["League finish", result.database.leaguePosition ?? "Missing"],
      ["Champions", result.database.champions ? "Yes" : "No"],
      ["Top four", result.database.topFour ? "Yes" : "No"],
      ["Bottom half", result.database.bottomHalf ? "Yes" : "No"],
      ["Relegated", result.database.relegated ? "Yes" : "No"],
      ["Promoted", result.database.promoted ? "Yes" : "No"]
    ];

    return `
      <div class="validation-player-heading">
        <div><span>${escapeHtml(result.record.season)}</span><h4>${escapeHtml(result.player.name)}</h4><p>${escapeHtml(result.record.club)} · ${escapeHtml(result.record.position)}</p></div>
        <div class="validation-health-score ${result.health.eligible ? "pass" : "warn"}"><strong>${result.health.percentage}%</strong><small>${result.health.eligible ? "Eligible answer" : "0-minute record"}</small></div>
      </div>
      <div class="validation-detail-grid">
        ${detailGroup("Identity", identity)}
        ${detailGroup("Season stats", stats)}
        ${detailGroup("Database metadata", database)}
      </div>
      <div class="validation-check-list">
        <h4>Data checks</h4>
        ${result.checks.map(renderCheck).join("")}
      </div>`;
  }

  function detailGroup(title, rows) {
    return `<section class="validation-detail-group"><h4>${escapeHtml(title)}</h4>${rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "Missing")}</strong></div>`).join("")}</section>`;
  }

  function evaluateRules(elements, engine) {
    const player = currentPlayer(elements, engine);
    const season = elements.playerSeason.value || state.season;
    if (!player || !season) {
      setStatus(elements.ruleStatus, "Choose a player and season in Player Inspector first.", "warn");
      return;
    }
    const input = elements.promptSelect.value === "__manual__" ? elements.promptText.value : elements.promptSelect.value;
    const result = engine.evaluatePrompt(player, season, input);
    state.lastValidation = result;
    elements.copyBtn.disabled = !result.ok;
    if (!result.ok) {
      setStatus(elements.ruleStatus, result.error, "fail");
      elements.ruleResult.innerHTML = "";
      return;
    }
    setStatus(elements.ruleStatus, result.passed ? "PASS — this player-season qualifies." : "FAIL — one or more rules did not match.", result.passed ? "pass" : "fail");
    elements.ruleResult.innerHTML = `
      <div class="validation-result-banner ${result.passed ? "pass" : "fail"}">
        <strong>${result.passed ? "PASS" : "FAIL"}</strong>
        <span>${escapeHtml(result.player.name)} · ${escapeHtml(result.record.season)} · ${escapeHtml(result.record.club)}</span>
      </div>
      ${result.warning ? `<p class="validation-warning">${escapeHtml(result.warning)}</p>` : ""}
      <div class="validation-check-list">${result.checks.map(renderCheck).join("")}</div>`;
  }

  function renderCheck(item) {
    return `<article class="validation-check ${item.passed ? "pass" : "fail"}">
      <span class="validation-check-icon" aria-hidden="true">${item.passed ? "✓" : "×"}</span>
      <div><strong>${escapeHtml(item.label)}</strong><p>Stored: ${escapeHtml(item.actual)}${item.expected ? ` · Expected: ${escapeHtml(item.expected)}` : ""}</p>${!item.passed && item.explanation ? `<small>${escapeHtml(item.explanation)}</small>` : ""}</div>
      <em>${item.passed ? "PASS" : "FAIL"}</em>
    </article>`;
  }

  async function copyReport(elements, engine) {
    if (!state.lastValidation?.ok) return;
    const report = engine.makeDebugReport(state.lastValidation);
    try {
      await navigator.clipboard.writeText(report);
      setStatus(elements.ruleStatus, "Debug report copied to the clipboard.", "pass");
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setStatus(elements.ruleStatus, "Debug report copied to the clipboard.", "pass");
    }
  }

  function explorePrompt(elements, engine) {
    const input = elements.explorerPromptSelect.value;
    if (!input || input === "__manual__") {
      setStatus(elements.explorerStatus, "Choose a saved prompt from the list.", "warn");
      return;
    }
    setStatus(elements.explorerStatus, "Analysing the database…", "working");
    window.setTimeout(() => {
      const result = engine.explorePrompt(input, { season: elements.explorerSeason.value, limit: 20 });
      if (!result.ok) {
        setStatus(elements.explorerStatus, result.error, "fail");
        return;
      }
      setStatus(elements.explorerStatus, `${result.validPlayerCount.toLocaleString("en-GB")} valid players found across ${result.checked.toLocaleString("en-GB")} player-seasons.`, result.validPlayerCount ? "pass" : "fail");
      elements.explorerResult.innerHTML = renderExplorer(result);
    }, 20);
  }

  function renderExplorer(result) {
    const validRows = result.valid.length
      ? result.valid.map(item => `<li><strong>${escapeHtml(item.player.name)}</strong><span>${escapeHtml(item.record.season)} · ${escapeHtml(item.record.club)} · ${Number(item.record.points || 0).toLocaleString("en-GB")} pts</span></li>`).join("")
      : "<li><strong>No valid answers</strong><span>The selected prompt may need review.</span></li>";
    const nearRows = result.nearMisses.length
      ? result.nearMisses.map(item => `<li><strong>${escapeHtml(item.result.player.name)}</strong><span>${escapeHtml(item.result.record.season)} · failed ${escapeHtml(item.failedRule.label)} (${escapeHtml(item.failedRule.actual)})</span></li>`).join("")
      : "<li><strong>No single-rule near misses</strong><span>Every rejected record failed more than one diagnostic rule.</span></li>";
    return `<div class="validation-explorer-summary"><strong>${result.validPlayerCount.toLocaleString("en-GB")}</strong><span>unique valid players</span></div>
      <div class="validation-two-column-lists"><section><h4>Best valid answers</h4><ol>${validRows}</ol></section><section><h4>Near misses</h4><ol>${nearRows}</ol></section></div>`;
  }

  function scanSeason(elements, engine) {
    const season = elements.healthSeason.value || engine.getAllSeasonLabels()[0];
    elements.healthSeason.value = season;
    const result = engine.seasonHealth(season);
    if (!result.ok) {
      setStatus(elements.healthStatus, result.error, "fail");
      return;
    }
    const tone = result.status === "Certified" ? "pass" : result.status === "Blocked" ? "fail" : "warn";
    setStatus(elements.healthStatus, `${result.season} · ${result.status} · ${result.completeness}% metadata completeness`, tone);
    elements.healthResult.innerHTML = renderSeasonHealth(result);
  }

  function renderSeasonHealth(result) {
    const rows = [
      ["Player records", result.summary.players],
      ["Eligible answers", result.summary.eligible],
      ["Zero-minute records", result.summary.zeroMinutes],
      ["Missing DOB", result.summary.missingDob],
      ["Missing age", result.summary.missingAge],
      ["Missing starting price", result.summary.missingStartingPrice],
      ["Missing final price", result.summary.missingFinalPrice],
      ["Missing league finish", result.summary.missingLeaguePosition],
      ["Missing managers", result.summary.missingManagers],
      ["Invalid positions", result.summary.invalidPosition],
      ["Invalid core stats", result.summary.invalidCoreStats]
    ];
    return `<div class="validation-health-hero ${result.status.toLowerCase()}"><div><span>${escapeHtml(result.season)}</span><strong>${escapeHtml(result.status)}</strong><small>${result.blocking.toLocaleString("en-GB")} blockers · ${result.metadataGaps.toLocaleString("en-GB")} metadata gaps</small></div><div><strong>${result.completeness}%</strong><small>complete</small></div></div>
      <div class="validation-health-grid">${rows.map(([label, value]) => `<div class="${Number(value) > 0 && /missing|invalid/i.test(label) ? "has-gap" : ""}"><span>${escapeHtml(label)}</span><strong>${Number(value).toLocaleString("en-GB")}</strong></div>`).join("")}</div>`;
  }

  function setStatus(element, message, tone = "") {
    if (!element) return;
    element.textContent = message;
    element.dataset.tone = tone;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.requestAnimationFrame(ready), { once: true });
  } else {
    window.requestAnimationFrame(ready);
  }
})();
