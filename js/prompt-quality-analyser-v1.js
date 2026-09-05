/* FPL Draft Challenge — Prompt Quality Analyser v1.0.0
   Analyses Prompt Factory survivors without publishing them. Exact duplicates can be rejected;
   useful threshold variants are preserved and tagged into stable variant groups for later weekly spacing. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_QUALITY_ANALYSER_V1?.ready) return;

  const VERSION = "1.0.0";
  const BATCH_SIZE = 500;
  const VALID_POSITIONS = new Set(["ANY", "GK", "DEF", "MID", "FWD"]);
  const VALID_OPERATORS = new Set(["eq", "gte", "lte", "gt", "lt", "between", "eqText", "contains", "isTrue", "isFalse"]);
  const VALID_FIELDS = new Set([
    "points", "goals", "assists", "goalInvolvements", "cleanSheets", "bonus", "saves", "minutes",
    "startingPrice", "ageAtSeasonStart", "yellowCards", "redCards", "goalsConceded", "leaguePosition",
    "careerSeasonCount", "careerClubCount", "club", "manager", "nationality", "outsideBigSix", "champions",
    "topFour", "bottomHalf", "relegated", "promoted"
  ]);
  const NUMERIC_OPERATORS = new Set(["eq", "gte", "lte", "gt", "lt", "between"]);

  const state = {
    running: false,
    cancelRequested: false,
    results: new Map(),
    meta: new WeakMap(),
    selectedFamily: "",
    criteria: {
      minQualityScore: 45,
      minCoverage: 35,
      minPlayers: 2,
      maxPlayers: 150,
      maxLabelLength: 180,
      maxConditions: 3
    },
    analysedAt: null
  };

  const factory = () => window.FPL_PROMPT_FACTORY_V1 || null;
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const slug = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const clamp = (value, low, high) => Math.min(high, Math.max(low, Number(value) || 0));

  function hashText(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function factoryResults() {
    const results = factory()?.getResults?.();
    return results && typeof results === "object" ? results : {};
  }

  function familyDefinitions() {
    return Array.isArray(factory()?.families) ? factory().families : [];
  }

  function availableEntries() {
    const results = factoryResults();
    const entries = [];
    for (const definition of familyDefinitions()) {
      const result = results[definition.id];
      if (!result || !Array.isArray(result.survivorCandidates)) continue;
      for (const candidate of result.survivorCandidates) entries.push({ family: definition.id, candidate });
    }
    return entries;
  }

  function readCriteria() {
    const numberFrom = (id, fallback) => {
      const value = Number(document.getElementById(id)?.value);
      return Number.isFinite(value) ? value : fallback;
    };
    const minPlayers = Math.max(1, Math.round(numberFrom("qualityMinPlayers", state.criteria.minPlayers)));
    const maxPlayers = Math.max(minPlayers, Math.round(numberFrom("qualityMaxPlayers", state.criteria.maxPlayers)));
    state.criteria = {
      ...state.criteria,
      minQualityScore: clamp(numberFrom("qualityMinScore", state.criteria.minQualityScore), 0, 100),
      minCoverage: clamp(numberFrom("qualityMinCoverage", state.criteria.minCoverage), 0, 100),
      minPlayers,
      maxPlayers
    };
    return { ...state.criteria };
  }

  function exactSignature(candidate) {
    const conditions = (candidate.conditions || []).map(condition => [
      condition.field,
      condition.operator,
      String(condition.value ?? ""),
      String(condition.value2 ?? "")
    ].join(":"));
    return `${candidate.position}|${conditions.sort().join("|")}`;
  }

  function variantConditionToken(condition) {
    const field = String(condition?.field || "");
    const operator = String(condition?.operator || "");
    if (NUMERIC_OPERATORS.has(operator)) {
      return `${field}:${operator}:${operator === "between" ? "#:#" : "#"}`;
    }
    if (operator === "eqText" || operator === "contains") {
      return `${field}:${operator}:${slug(condition.value)}`;
    }
    return `${field}:${operator}`;
  }

  function variantSignature(candidate) {
    const tokens = (candidate.conditions || []).map(variantConditionToken).sort();
    return `${candidate.position}|${tokens.join("|")}`;
  }

  function variantGroup(candidate) {
    return `vg_${String(candidate.position || "any").toLowerCase()}_${hashText(variantSignature(candidate))}`;
  }

  function schemaIssues(candidate, criteria) {
    const issues = [];
    if (!candidate || typeof candidate !== "object") return ["Candidate is not an object."];
    if (!String(candidate.id || "").trim()) issues.push("Missing candidate ID.");
    const label = String(candidate.label || "").trim();
    if (!label) issues.push("Missing player-facing wording.");
    if (label.length > criteria.maxLabelLength) issues.push(`Wording is longer than ${criteria.maxLabelLength} characters.`);
    if (/\b(?:undefined|null|nan)\b/i.test(label)) issues.push("Wording contains an unresolved value.");
    if (!String(candidate.family || "").trim()) issues.push("Missing family.");
    if (!VALID_POSITIONS.has(String(candidate.position || ""))) issues.push("Unsupported position.");
    if (!Array.isArray(candidate.conditions) || candidate.conditions.length < 1) issues.push("No declarative conditions.");
    if (Array.isArray(candidate.conditions) && candidate.conditions.length > criteria.maxConditions) issues.push(`More than ${criteria.maxConditions} conditions.`);

    for (const condition of candidate.conditions || []) {
      if (!VALID_FIELDS.has(String(condition?.field || ""))) issues.push(`Unsupported field: ${condition?.field || "missing"}.`);
      if (!VALID_OPERATORS.has(String(condition?.operator || ""))) issues.push(`Unsupported operator: ${condition?.operator || "missing"}.`);
      if (["eqText", "contains"].includes(condition?.operator) && !String(condition?.value ?? "").trim()) issues.push(`Missing value for ${condition.field}.`);
      if (NUMERIC_OPERATORS.has(condition?.operator) && !Number.isFinite(Number(condition?.value))) issues.push(`Non-numeric value for ${condition.field}.`);
      if (condition?.operator === "between" && !Number.isFinite(Number(condition?.value2))) issues.push(`Missing upper value for ${condition.field}.`);
    }
    return [...new Set(issues)];
  }

  function answerPoolPoints(players) {
    const count = Number(players) || 0;
    if (count <= 2) return 6;
    if (count <= 5) return 10;
    if (count <= 80) return 15;
    if (count <= 150) return 12;
    return 5;
  }

  function qualityScore(candidate) {
    const evidence = candidate?.evidence || {};
    const coverage = clamp(evidence.coverage, 0, 100);
    const seasons = Math.max(0, Number(evidence.seasons) || 0);
    const clubs = Math.max(0, Number(evidence.clubs) || 0);
    const players = Math.max(0, Number(evidence.answerPlayers) || 0);
    const labelLength = String(candidate?.label || "").trim().length;
    const conditionCount = Array.isArray(candidate?.conditions) ? candidate.conditions.length : 0;

    const coveragePoints = Math.min(30, coverage * 0.3);
    const seasonPoints = Math.min(20, seasons * 1.5);
    const clubPoints = Math.min(20, clubs * 1.2);
    const poolPoints = answerPoolPoints(players);
    const wordingPoints = labelLength >= 12 && labelLength <= 140 ? 10 : 5;
    const complexityPoints = conditionCount === 1 ? 5 : conditionCount === 2 ? 4 : conditionCount === 3 ? 3 : 0;
    return Math.round(clamp(coveragePoints + seasonPoints + clubPoints + poolPoints + wordingPoints + complexityPoints, 0, 100));
  }

  function classify(candidate, criteria, exactOwner) {
    const hardReasons = schemaIssues(candidate, criteria);
    const evidence = candidate?.evidence || {};
    if (evidence.playable !== true || evidence.survivor !== true) hardReasons.push("Factory evidence no longer marks this candidate as playable and surviving.");

    const exactKey = exactSignature(candidate);
    const existing = exactOwner.get(exactKey);
    if (existing && existing !== candidate) hardReasons.push(`Exact duplicate of ${existing.id}.`);
    else if (!existing) exactOwner.set(exactKey, candidate);

    const score = qualityScore(candidate);
    const reviewReasons = [];
    const players = Number(evidence.answerPlayers) || 0;
    const coverage = Number(evidence.coverage) || 0;
    if (players < criteria.minPlayers) reviewReasons.push(`Only ${players} answer players; review floor is ${criteria.minPlayers}.`);
    if (players > criteria.maxPlayers) reviewReasons.push(`${players} answer players; review ceiling is ${criteria.maxPlayers}.`);
    if (coverage < criteria.minCoverage) reviewReasons.push(`${coverage}% data coverage; review floor is ${criteria.minCoverage}%.`);
    if (score < criteria.minQualityScore) reviewReasons.push(`Quality score ${score}; automatic-pass floor is ${criteria.minQualityScore}.`);

    const status = hardReasons.length ? "rejected" : reviewReasons.length ? "review" : "pass";
    return {
      status,
      score,
      reasons: status === "rejected" ? [...new Set(hardReasons)] : [...new Set(reviewReasons)],
      variantGroup: variantGroup(candidate),
      variantSignature: variantSignature(candidate),
      exactSignature: exactKey
    };
  }

  function emptyFamilyResult(family) {
    return {
      family,
      analysed: 0,
      pass: 0,
      review: 0,
      rejected: 0,
      variantGroups: 0,
      passCandidates: [],
      reviewCandidates: [],
      rejectedCandidates: []
    };
  }

  async function analyseAll() {
    if (state.running) return;
    const entries = availableEntries();
    if (!entries.length) {
      setStatus("Run Prompt Factory first. There are no Factory survivors to analyse yet.");
      render();
      return;
    }

    state.running = true;
    state.cancelRequested = false;
    state.results = new Map();
    state.meta = new WeakMap();
    state.analysedAt = null;
    const criteria = readCriteria();
    const exactOwner = new Map();
    const groupCounts = new Map();
    updateButtons();

    for (let index = 0; index < entries.length; index += BATCH_SIZE) {
      if (state.cancelRequested) break;
      const end = Math.min(entries.length, index + BATCH_SIZE);
      for (let cursor = index; cursor < end; cursor += 1) {
        const { family, candidate } = entries[cursor];
        const result = state.results.get(family) || emptyFamilyResult(family);
        const meta = classify(candidate, criteria, exactOwner);
        state.meta.set(candidate, meta);
        result.analysed += 1;
        result[meta.status] += 1;
        result[`${meta.status}Candidates`].push(candidate);
        if (meta.status !== "rejected") groupCounts.set(meta.variantGroup, (groupCounts.get(meta.variantGroup) || 0) + 1);
        state.results.set(family, result);
      }
      setStatus(`Quality analysis: ${end.toLocaleString("en-GB")} / ${entries.length.toLocaleString("en-GB")} Factory survivors`);
      renderSummary();
      await nextFrame();
    }

    for (const result of state.results.values()) {
      const groups = new Set();
      for (const candidate of [...result.passCandidates, ...result.reviewCandidates]) {
        const meta = state.meta.get(candidate);
        if (!meta) continue;
        groups.add(meta.variantGroup);
        state.meta.set(candidate, { ...meta, variantGroupSize: groupCounts.get(meta.variantGroup) || 1 });
      }
      result.variantGroups = groups.size;
    }

    state.running = false;
    state.analysedAt = new Date().toISOString();
    const stopped = state.cancelRequested;
    state.cancelRequested = false;
    if (!state.selectedFamily || !state.results.has(state.selectedFamily)) state.selectedFamily = [...state.results.keys()][0] || "";
    setStatus(stopped ? "Quality analysis stopped. Partial results are shown." : "Quality analysis complete. Review candidates are kept; nothing was published.");
    updateButtons();
    renderFamilyTable();
    renderPreview();
    renderSummary();
    window.dispatchEvent(new CustomEvent("fpl:prompt-quality-analysis-complete", { detail: summary() }));
  }

  function stop() {
    if (!state.running) return;
    state.cancelRequested = true;
    setStatus("Stopping after the current quality batch…");
  }

  function clear() {
    if (state.running) return;
    state.results = new Map();
    state.meta = new WeakMap();
    state.analysedAt = null;
    setStatus("Quality results cleared. Factory results and the canonical library are unchanged.");
    renderFamilyTable();
    renderPreview();
    renderSummary();
  }

  function invalidateFromFactory() {
    if (state.running) state.cancelRequested = true;
    state.results = new Map();
    state.meta = new WeakMap();
    state.analysedAt = null;
    setStatus("Factory results changed. Run Quality Analysis again to refresh variant groups and scores.");
    renderFamilyTable();
    renderPreview();
    renderSummary();
  }

  function summary() {
    const results = [...state.results.values()];
    const groups = new Set();
    for (const result of results) {
      for (const candidate of [...result.passCandidates, ...result.reviewCandidates]) {
        const meta = state.meta.get(candidate);
        if (meta) groups.add(meta.variantGroup);
      }
    }
    return {
      analysed: results.reduce((sum, result) => sum + result.analysed, 0),
      pass: results.reduce((sum, result) => sum + result.pass, 0),
      review: results.reduce((sum, result) => sum + result.review, 0),
      rejected: results.reduce((sum, result) => sum + result.rejected, 0),
      variantGroups: groups.size,
      families: results.length,
      analysedAt: state.analysedAt
    };
  }

  function decoratedCandidate(candidate) {
    const meta = state.meta.get(candidate);
    if (!meta) return null;
    return {
      ...candidate,
      variantGroup: meta.variantGroup,
      qualityStatus: meta.status,
      qualityScore: meta.score,
      qualityReasons: meta.reasons.slice(),
      qualityVersion: VERSION,
      qualityAnalysedAt: state.analysedAt,
      qualityEvidence: {
        ...(candidate.evidence || {}),
        variantGroupSize: meta.variantGroupSize || 1
      }
    };
  }

  function getCandidates({ includeReview = false } = {}) {
    const out = [];
    for (const result of state.results.values()) {
      for (const candidate of result.passCandidates) {
        const decorated = decoratedCandidate(candidate);
        if (decorated) out.push(decorated);
      }
      if (includeReview) for (const candidate of result.reviewCandidates) {
        const decorated = decoratedCandidate(candidate);
        if (decorated) out.push(decorated);
      }
    }
    return out;
  }

  function renderSummary() {
    const total = summary();
    const map = {
      promptQualityAnalysed: total.analysed,
      promptQualityPass: total.pass,
      promptQualityReview: total.review,
      promptQualityRejected: total.rejected,
      promptQualityVariantGroups: total.variantGroups
    };
    for (const [id, value] of Object.entries(map)) {
      const node = document.getElementById(id);
      if (node) node.textContent = Number(value).toLocaleString("en-GB");
    }
  }

  function familyRow(definition) {
    const factoryResult = factoryResults()[definition.id];
    const qualityResult = state.results.get(definition.id);
    const available = Number(factoryResult?.survivors || 0);
    return `<button class="prompt-quality-family-row${state.selectedFamily === definition.id ? " selected" : ""}" type="button" data-quality-family="${esc(definition.id)}">
      <span><strong>${esc(definition.label)}</strong><small>${available.toLocaleString("en-GB")} Factory survivors</small></span>
      <b>${qualityResult ? qualityResult.pass.toLocaleString("en-GB") : "—"}</b>
      <b>${qualityResult ? qualityResult.review.toLocaleString("en-GB") : "—"}</b>
      <b>${qualityResult ? qualityResult.rejected.toLocaleString("en-GB") : "—"}</b>
      <em>${qualityResult ? qualityResult.variantGroups.toLocaleString("en-GB") : "—"}</em>
    </button>`;
  }

  function renderFamilyTable() {
    const list = document.getElementById("promptQualityFamilyTable");
    if (!list) return;
    const defs = familyDefinitions().filter(definition => factoryResults()[definition.id]);
    list.innerHTML = defs.length ? defs.map(familyRow).join("") : `<div class="prompt-library-empty"><strong>No Factory families have been run</strong><span>Run Prompt Factory first, then analyse its survivor pool here.</span></div>`;
    list.querySelectorAll("[data-quality-family]").forEach(button => button.addEventListener("click", () => {
      state.selectedFamily = button.dataset.qualityFamily;
      renderFamilyTable();
      renderPreview();
    }));
    renderSummary();
  }

  function candidateCard(candidate) {
    const meta = state.meta.get(candidate);
    if (!meta) return "";
    const reason = meta.reasons[0] || (meta.status === "pass" ? "Automatic quality pass" : "");
    return `<article class="prompt-quality-candidate ${esc(meta.status)}">
      <div>
        <div class="prompt-quality-card-title"><span class="prompt-quality-state ${esc(meta.status)}">${meta.status === "pass" ? "Pass" : meta.status === "review" ? "Review · kept" : "Rejected"}</span><strong>${meta.score}/100</strong></div>
        <h4>${esc(candidate.label)}</h4>
        <code>${esc(candidate.id)}</code>
        <div class="prompt-library-meta">
          <span class="prompt-library-chip">${esc(candidate.position)}</span>
          <span class="prompt-library-chip">${esc(candidate.family)}</span>
          <span class="prompt-library-chip">${esc(meta.variantGroup)}</span>
          <span class="prompt-library-chip">${Number(candidate.evidence?.coverage || 0)}% coverage</span>
        </div>
        <p>${esc(reason)}</p>
      </div>
      <dl>
        <div><dt>Players</dt><dd>${Number(candidate.evidence?.answerPlayers || 0)}</dd></div>
        <div><dt>Seasons</dt><dd>${Number(candidate.evidence?.seasons || 0)}</dd></div>
        <div><dt>Clubs</dt><dd>${Number(candidate.evidence?.clubs || 0)}</dd></div>
        <div><dt>Group size</dt><dd>${Number(meta.variantGroupSize || 1)}</dd></div>
      </dl>
    </article>`;
  }

  function renderPreview() {
    const heading = document.getElementById("promptQualityPreviewHeading");
    const summaryNode = document.getElementById("promptQualityPreviewSummary");
    const list = document.getElementById("promptQualityCandidateList");
    if (!list) return;
    const definition = familyDefinitions().find(item => item.id === state.selectedFamily);
    const result = state.results.get(state.selectedFamily);
    if (heading) heading.textContent = definition ? `${definition.label} quality evidence` : "Quality evidence";
    if (!result) {
      if (summaryNode) summaryNode.textContent = "Analyse the current Factory survivors to see quality evidence.";
      list.innerHTML = `<div class="prompt-library-empty"><strong>No quality evidence yet</strong><span>Near-threshold variants are intentionally preserved. Quality Analysis only separates passes, review candidates and genuine rejects.</span></div>`;
      return;
    }
    if (summaryNode) summaryNode.textContent = `${result.pass.toLocaleString("en-GB")} pass · ${result.review.toLocaleString("en-GB")} review kept · ${result.rejected.toLocaleString("en-GB")} rejected · ${result.variantGroups.toLocaleString("en-GB")} variant groups`;
    const preview = [...result.passCandidates.slice(0, 15), ...result.reviewCandidates.slice(0, 10), ...result.rejectedCandidates.slice(0, 5)];
    list.innerHTML = preview.length ? preview.map(candidateCard).join("") : `<div class="prompt-library-empty"><strong>No analysed candidates</strong><span>This family has no Quality Analyser output yet.</span></div>`;
  }

  function setStatus(message) {
    const node = document.getElementById("promptQualityStatus");
    if (node) node.textContent = message;
  }

  function updateButtons() {
    const run = document.getElementById("promptQualityRunAll");
    const stopButton = document.getElementById("promptQualityStop");
    const clearButton = document.getElementById("promptQualityClear");
    if (run) run.disabled = state.running;
    if (stopButton) stopButton.disabled = !state.running;
    if (clearButton) clearButton.disabled = state.running;
  }

  function installStyles() {
    if (document.querySelector("link[data-prompt-quality-style]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.promptQualityStyle = "1";
    link.href = window.FPL_ASSET_MANIFEST?.url?.("promptQualityAnalyserCssV1") || "admin-prompt-quality-analyser.css?v=1.0.0";
    document.head.appendChild(link);
  }

  function render() {
    const mount = document.getElementById("promptQualityMount");
    if (!mount) return false;
    installStyles();
    const available = availableEntries().length;
    mount.innerHTML = `<section class="prompt-quality-analyser" aria-labelledby="promptQualityHeading">
      <div class="prompt-library-browser-head">
        <div>
          <p class="eyebrow">Quality Analyser · v1</p>
          <h3 id="promptQualityHeading">Keep the biggest good library possible</h3>
          <p>Reject structural failures and exact duplicates, score evidence, and tag close threshold relatives into stable variant groups. Similar £5.0m / £5.5m / £6.0m style variants are deliberately kept for later weekly rotation.</p>
        </div>
        <span class="phase-chip">${VERSION}</span>
      </div>

      <div class="prompt-quality-policy">
        <strong>Maximum-library policy</strong>
        <span>Review candidates are retained, not deleted. Variant groups are metadata for the future Weekly Generator, not a reason to remove useful prompts.</span>
      </div>

      <div class="prompt-quality-summary-grid">
        <div class="prompt-clean-status-card"><span>Analysed</span><strong id="promptQualityAnalysed">0</strong></div>
        <div class="prompt-clean-status-card"><span>Quality pass</span><strong id="promptQualityPass">0</strong></div>
        <div class="prompt-clean-status-card"><span>Review · kept</span><strong id="promptQualityReview">0</strong></div>
        <div class="prompt-clean-status-card"><span>Rejected</span><strong id="promptQualityRejected">0</strong></div>
        <div class="prompt-clean-status-card"><span>Variant groups</span><strong id="promptQualityVariantGroups">0</strong></div>
      </div>

      <div class="prompt-quality-controls">
        <label>Auto-pass score<input id="qualityMinScore" type="number" min="0" max="100" value="${state.criteria.minQualityScore}"></label>
        <label>Min coverage %<input id="qualityMinCoverage" type="number" min="0" max="100" value="${state.criteria.minCoverage}"></label>
        <label>Min players<input id="qualityMinPlayers" type="number" min="1" value="${state.criteria.minPlayers}"></label>
        <label>Max players<input id="qualityMaxPlayers" type="number" min="1" value="${state.criteria.maxPlayers}"></label>
      </div>

      <div class="prompt-quality-actions">
        <button id="promptQualityRunAll" class="button" type="button">Analyse all Factory survivors</button>
        <button id="promptQualityStop" class="button secondary" type="button" disabled>Stop</button>
        <button id="promptQualityClear" class="button secondary" type="button">Clear quality results</button>
        <span id="promptQualityStatus">${available.toLocaleString("en-GB")} Factory survivors currently available.</span>
      </div>

      <div class="prompt-quality-family-head" aria-hidden="true"><span>Family</span><b>Pass</b><b>Review</b><b>Rejected</b><em>Groups</em></div>
      <div id="promptQualityFamilyTable" class="prompt-quality-family-table"></div>

      <section class="prompt-quality-preview">
        <div class="prompt-library-browser-head">
          <div><p class="eyebrow">Quality evidence</p><h3 id="promptQualityPreviewHeading">Quality evidence</h3><p id="promptQualityPreviewSummary">Analyse the current Factory survivors to see quality evidence.</p></div>
        </div>
        <div id="promptQualityCandidateList" class="prompt-quality-candidate-list"></div>
      </section>
    </section>`;

    document.getElementById("promptQualityRunAll")?.addEventListener("click", analyseAll);
    document.getElementById("promptQualityStop")?.addEventListener("click", stop);
    document.getElementById("promptQualityClear")?.addEventListener("click", clear);
    renderFamilyTable();
    renderPreview();
    updateButtons();
    return true;
  }

  function install() {
    render();
    window.addEventListener("fpl:prompt-studio-clean-rendered", render);
    window.addEventListener("fpl:prompt-studio-clean-ready", render);
    window.addEventListener("fpl:prompt-factory-results-changed", invalidateFromFactory);
    document.documentElement.dataset.promptQualityAnalyser = "v1";
    window.dispatchEvent(new CustomEvent("fpl:prompt-quality-analyser-ready", { detail: { version: VERSION } }));
  }

  window.FPL_PROMPT_QUALITY_ANALYSER_V1 = Object.freeze({
    ready: true,
    version: VERSION,
    analyseAll,
    clear,
    render,
    getSummary: summary,
    getQualityCandidates: options => getCandidates(options),
    getMeta: candidate => {
      const meta = state.meta.get(candidate);
      return meta ? { ...meta, reasons: meta.reasons.slice() } : null;
    },
    variantGroupFor: candidate => variantGroup(candidate),
    exactSignatureFor: candidate => exactSignature(candidate)
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
