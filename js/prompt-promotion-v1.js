/* FPL Draft Challenge — Prompt Promotion v1.0.0
   Verifies Factory/Quality run identity, shows family shares, and promotes the maximum kept
   quality pool into the clean Studio canonical array for the current admin session only. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_PROMOTION_V1?.ready) return;

  const VERSION = "1.0.0";
  const CHUNK_SIZE = 2000;
  const state = {
    includeReview: true,
    promotedAt: null,
    promotedCount: 0,
    promotedFingerprint: "",
    cachedAudit: null,
    cachedFactorySignature: "",
    cachedQualityStamp: "",
    resultTokens: new WeakMap(),
    nextResultToken: 1,
    observer: null,
    queued: false
  };

  const factory = () => window.FPL_PROMPT_FACTORY_V1 || null;
  const quality = () => window.FPL_PROMPT_QUALITY_ANALYSER_V1 || null;
  const cleanStudio = () => window.FPL_PROMPT_STUDIO_CLEAN || null;
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function hashStep(hash, value) {
    let out = hash >>> 0;
    for (const char of String(value ?? "")) {
      out ^= char.charCodeAt(0);
      out = Math.imul(out, 16777619);
    }
    return out >>> 0;
  }

  function familyDefinitions() {
    return Array.isArray(factory()?.families) ? factory().families : [];
  }

  function factoryResults() {
    const results = factory()?.getResults?.();
    return results && typeof results === "object" ? results : {};
  }

  function tokenFor(result) {
    if (!result || typeof result !== "object") return 0;
    let token = state.resultTokens.get(result);
    if (!token) {
      token = state.nextResultToken++;
      state.resultTokens.set(result, token);
    }
    return token;
  }

  function factorySignature() {
    const results = factoryResults();
    return familyDefinitions().map(definition => {
      const result = results[definition.id];
      if (!result) return `${definition.id}:none`;
      const list = Array.isArray(result.survivorCandidates) ? result.survivorCandidates : [];
      return `${definition.id}:${tokenFor(result)}:${list.length}:${result.survivors ?? ""}:${result.criteria?.minPlayers ?? ""}:${result.criteria?.maxPlayers ?? ""}:${result.criteria?.minCoverage ?? ""}`;
    }).join("|");
  }

  function currentEntries() {
    const results = factoryResults();
    const entries = [];
    for (const definition of familyDefinitions()) {
      const result = results[definition.id];
      if (!result || !Array.isArray(result.survivorCandidates)) continue;
      for (const candidate of result.survivorCandidates) entries.push({ definition, family: definition.id, candidate });
    }
    return entries;
  }

  function buildAudit() {
    const q = quality();
    const qSummary = q?.getSummary?.() || { analysed: 0, pass: 0, review: 0, rejected: 0, variantGroups: 0, families: 0, analysedAt: null };
    const entries = currentEntries();
    const familyMap = new Map();
    const globalGroups = new Set();
    let currentAnalysed = 0;
    let pass = 0;
    let review = 0;
    let rejected = 0;

    for (const definition of familyDefinitions()) {
      familyMap.set(definition.id, {
        id: definition.id,
        label: definition.label,
        factory: 0,
        analysed: 0,
        pass: 0,
        review: 0,
        rejected: 0,
        kept: 0,
        variantGroups: new Set()
      });
    }

    for (const entry of entries) {
      const row = familyMap.get(entry.family) || {
        id: entry.family, label: entry.family, factory: 0, analysed: 0, pass: 0, review: 0, rejected: 0, kept: 0, variantGroups: new Set()
      };
      row.factory += 1;
      const meta = q?.getMeta?.(entry.candidate) || null;
      if (meta) {
        currentAnalysed += 1;
        row.analysed += 1;
        if (meta.status === "pass") { pass += 1; row.pass += 1; }
        else if (meta.status === "review") { review += 1; row.review += 1; }
        else { rejected += 1; row.rejected += 1; }
        if (meta.status !== "rejected") {
          row.kept += 1;
          if (meta.variantGroup) {
            row.variantGroups.add(meta.variantGroup);
            globalGroups.add(meta.variantGroup);
          }
        }
      }
      familyMap.set(entry.family, row);
    }

    const currentFactory = entries.length;
    const promotable = pass + review;
    const currentMatch = currentFactory > 0 &&
      currentAnalysed === currentFactory &&
      Number(qSummary.analysed || 0) === currentFactory &&
      Boolean(qSummary.analysedAt);

    const families = [...familyMap.values()]
      .filter(row => row.factory > 0)
      .map(row => ({
        ...row,
        variantGroups: row.variantGroups.size,
        share: promotable ? row.kept / promotable * 100 : 0
      }));

    return {
      currentFactory,
      currentAnalysed,
      qualitySummaryAnalysed: Number(qSummary.analysed || 0),
      qualityAnalysedAt: qSummary.analysedAt || null,
      pass,
      review,
      rejected,
      promotable,
      variantGroups: globalGroups.size,
      currentMatch,
      delta: currentFactory - currentAnalysed,
      families
    };
  }

  function audit({ force = false } = {}) {
    const signature = factorySignature();
    const qualityStamp = String(quality()?.getSummary?.()?.analysedAt || "");
    if (!force && state.cachedAudit && signature === state.cachedFactorySignature && qualityStamp === state.cachedQualityStamp) return state.cachedAudit;
    state.cachedFactorySignature = signature;
    state.cachedQualityStamp = qualityStamp;
    state.cachedAudit = buildAudit();
    return state.cachedAudit;
  }

  function compactCondition(condition) {
    const out = { field: condition.field, operator: condition.operator };
    if (condition.value !== undefined) out.value = condition.value;
    if (condition.value2 !== undefined) out.value2 = condition.value2;
    return out;
  }

  function compactPrompt(candidate, meta) {
    const evidence = candidate?.evidence || {};
    const qualityEvidence = {
      answerPlayers: Number(evidence.answerPlayers || 0),
      seasons: Number(evidence.seasons || 0),
      clubs: Number(evidence.clubs || 0),
      coverage: Number(evidence.coverage || 0),
      variantGroupSize: Number(meta?.variantGroupSize || 1)
    };
    return {
      schemaVersion: 1,
      id: String(candidate.id),
      label: String(candidate.label),
      position: String(candidate.position || "ANY"),
      family: String(candidate.family || "uncategorised"),
      conditions: (candidate.conditions || []).map(compactCondition),
      variantGroup: String(meta.variantGroup || ""),
      qualityStatus: meta.status,
      qualityScore: Number(meta.score || 0),
      qualityVersion: quality()?.version || "1.0.0",
      difficulty: String(evidence.difficulty || candidate.difficulty || ""),
      qualityEvidence,
      tags: [
        `family:${String(candidate.family || "uncategorised")}`,
        meta.variantGroup ? `variant:${meta.variantGroup}` : "",
        `quality:${meta.status}`
      ].filter(Boolean),
      enabled: true,
      source: "prompt-promotion-v1"
    };
  }

  function promotionFingerprint(records) {
    let hash = 2166136261;
    for (const record of records) {
      hash = hashStep(hash, record.id);
      hash = hashStep(hash, record.variantGroup);
      hash = hashStep(hash, record.qualityStatus);
    }
    return `promotion_${records.length}_${hash.toString(36)}`;
  }

  function buildPromotionRecords() {
    const q = quality();
    const records = [];
    const seenIds = new Set();
    for (const { candidate } of currentEntries()) {
      const meta = q?.getMeta?.(candidate);
      if (!meta || meta.status === "rejected") continue;
      if (!state.includeReview && meta.status === "review") continue;
      const id = String(candidate.id || "");
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      records.push(compactPrompt(candidate, meta));
    }
    return records;
  }

  function installCanonicalRecords(records) {
    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
    window.FPL_PROMPT_LIBRARY = library;
    library.length = 0;
    for (let index = 0; index < records.length; index += CHUNK_SIZE) {
      library.push(...records.slice(index, index + CHUNK_SIZE));
    }
    cleanStudio()?.renderLibraryBrowser?.();
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", {
      detail: {
        source: "prompt-promotion-v1",
        version: VERSION,
        total: library.length,
        persistent: false
      }
    }));
  }

  function promote() {
    const current = audit({ force: true });
    if (!current.currentMatch) {
      setStatus("Promotion blocked: current Factory survivors do not exactly match the candidates analysed by Quality Analyser. Run Quality Analysis again.");
      render();
      return null;
    }
    const records = buildPromotionRecords();
    if (!records.length) {
      setStatus("Promotion blocked: there are no kept quality candidates under the selected policy.");
      return null;
    }
    installCanonicalRecords(records);
    state.promotedAt = new Date().toISOString();
    state.promotedCount = records.length;
    state.promotedFingerprint = promotionFingerprint(records);
    setStatus(`${records.length.toLocaleString("en-GB")} prompts promoted into the clean canonical library for this Studio session.`);
    render();
    return { total: records.length, fingerprint: state.promotedFingerprint, promotedAt: state.promotedAt };
  }

  function clearSessionPromotion() {
    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
    library.length = 0;
    state.promotedAt = null;
    state.promotedCount = 0;
    state.promotedFingerprint = "";
    cleanStudio()?.renderLibraryBrowser?.();
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", {
      detail: { source: "prompt-promotion-v1", version: VERSION, total: 0, persistent: false }
    }));
    setStatus("Session promotion cleared. Factory and Quality results are unchanged.");
    render();
  }

  function familyRow(row) {
    return `<div class="prompt-promotion-family-row">
      <span><strong>${esc(row.label)}</strong><small>${row.factory.toLocaleString("en-GB")} Factory survivors</small></span>
      <b>${row.kept.toLocaleString("en-GB")}</b>
      <b>${row.share.toFixed(2)}%</b>
      <b>${row.pass.toLocaleString("en-GB")}</b>
      <b>${row.review.toLocaleString("en-GB")}</b>
      <em>${row.variantGroups.toLocaleString("en-GB")}</em>
    </div>`;
  }

  function setStatus(message) {
    const node = document.getElementById("promptPromotionStatus");
    if (node) node.textContent = message;
  }

  function installStyles() {
    if (document.querySelector("link[data-prompt-promotion-style]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.promptPromotionStyle = "1";
    link.href = window.FPL_ASSET_MANIFEST?.url?.("promptPromotionCssV1") || "admin-prompt-promotion-v1.css?v=1.0.0";
    document.head.appendChild(link);
  }

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot");
    if (!root) return false;
    let mount = document.getElementById("promptPromotionMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "promptPromotionMount";
      mount.dataset.promptPromotionMount = "v1";
      const qualityMount = document.getElementById("promptQualityMount");
      const roadmap = root.querySelector(".prompt-clean-roadmap");
      if (qualityMount?.parentNode === root) qualityMount.insertAdjacentElement("afterend", mount);
      else if (roadmap) root.insertBefore(mount, roadmap);
      else root.appendChild(mount);
    }
    render();
    return true;
  }

  function queueEnsure() {
    if (state.queued) return;
    state.queued = true;
    queueMicrotask(() => {
      state.queued = false;
      ensureMount();
    });
  }

  function observe() {
    if (state.observer) return;
    const workspace = document.getElementById("workspace-prompts") || document.querySelector('[data-workspace="prompts"]');
    if (!workspace) return;
    state.observer = new MutationObserver(() => {
      if (!document.getElementById("promptPromotionMount")) queueEnsure();
    });
    state.observer.observe(workspace, { childList: true, subtree: true });
  }

  function render() {
    const mount = document.getElementById("promptPromotionMount");
    if (!mount) return false;
    installStyles();
    const current = audit();
    const canonicalCount = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY.length : 0;
    const policyCount = state.includeReview ? current.promotable : current.pass;
    const matchLabel = current.currentMatch ? "Verified" : "Blocked";
    const matchClass = current.currentMatch ? "pass" : "blocked";

    mount.innerHTML = `<section class="prompt-promotion" aria-labelledby="promptPromotionHeading">
      <div class="prompt-library-browser-head">
        <div>
          <p class="eyebrow">Promotion Layer · v1</p>
          <h3 id="promptPromotionHeading">Verify the run, balance the families, then promote</h3>
          <p>The promotion gate only accepts the exact Factory candidate objects scored by the current Quality Analysis. Pass and Review prompts can both be kept so the library stays as large as possible.</p>
        </div>
        <span class="phase-chip">${VERSION}</span>
      </div>

      <div class="prompt-promotion-audit ${matchClass}">
        <div><span>Current Factory survivors</span><strong>${current.currentFactory.toLocaleString("en-GB")}</strong></div>
        <div><span>Current survivors with Quality evidence</span><strong>${current.currentAnalysed.toLocaleString("en-GB")}</strong></div>
        <div><span>Quality run analysed</span><strong>${current.qualitySummaryAnalysed.toLocaleString("en-GB")}</strong></div>
        <div><span>Source reconciliation</span><strong>${matchLabel}</strong></div>
      </div>

      <div class="prompt-promotion-note ${matchClass}">
        <strong>${current.currentMatch ? "Input pool verified" : "Promotion is blocked"}</strong>
        <span>${current.currentMatch ? `All ${current.currentFactory.toLocaleString("en-GB")} current Factory survivors are the exact objects scored by this Quality run.` : `Factory/Quality delta: ${current.delta.toLocaleString("en-GB")}. Run Quality Analysis again after the latest Factory run.`}</span>
      </div>

      <div class="prompt-promotion-summary-grid">
        <div class="prompt-clean-status-card"><span>Pass</span><strong>${current.pass.toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Review · kept</span><strong>${current.review.toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Promotable</span><strong>${current.promotable.toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Rejected</span><strong>${current.rejected.toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Variant groups</span><strong>${current.variantGroups.toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Session canonical</span><strong>${canonicalCount.toLocaleString("en-GB")}</strong></div>
      </div>

      <div class="prompt-promotion-policy">
        <label><input id="promptPromotionIncludeReview" type="checkbox"${state.includeReview ? " checked" : ""}> Include Review · kept candidates</label>
        <span>Current policy would promote <strong>${policyCount.toLocaleString("en-GB")}</strong> prompts.</span>
      </div>

      <div class="prompt-promotion-actions">
        <button id="promptPromotionPromote" class="button" type="button"${current.currentMatch && policyCount ? "" : " disabled"}>Promote current quality pool</button>
        <button id="promptPromotionRefresh" class="button secondary" type="button">Refresh source audit</button>
        <button id="promptPromotionClear" class="button secondary" type="button"${canonicalCount ? "" : " disabled"}>Clear session canonical</button>
        <span id="promptPromotionStatus">${state.promotedAt ? `${state.promotedCount.toLocaleString("en-GB")} promoted · ${esc(state.promotedFingerprint)}` : "Nothing has been promoted yet."}</span>
      </div>

      <div class="prompt-promotion-session-warning">
        <strong>Session-only in v1</strong>
        <span>The promoted pool is deliberately not written into localStorage: a 100k+ prompt library is too large for safe browser storage. Repository-backed family shards are the next publishing step.</span>
      </div>

      <div class="prompt-promotion-family-head" aria-hidden="true"><span>Family</span><b>Kept</b><b>Library share</b><b>Pass</b><b>Review</b><em>Groups</em></div>
      <div class="prompt-promotion-family-table">${current.families.length ? current.families.map(familyRow).join("") : `<div class="prompt-library-empty"><strong>No reconciled family totals yet</strong><span>Run Prompt Factory, then Quality Analysis.</span></div>`}</div>

      <div class="prompt-promotion-share-note">
        <strong>Weekly Generator input</strong>
        <span>Library share is the starting percentage for proportional weekly allocation. Later, the generator will recalculate from each family’s remaining unused eligible prompts so families approach cycle exhaustion together.</span>
      </div>
    </section>`;

    document.getElementById("promptPromotionIncludeReview")?.addEventListener("change", event => {
      state.includeReview = Boolean(event.target.checked);
      render();
    });
    document.getElementById("promptPromotionPromote")?.addEventListener("click", promote);
    document.getElementById("promptPromotionRefresh")?.addEventListener("click", () => {
      state.cachedAudit = null;
      audit({ force: true });
      render();
    });
    document.getElementById("promptPromotionClear")?.addEventListener("click", clearSessionPromotion);
    return true;
  }

  function invalidate() {
    state.cachedAudit = null;
    state.promotedAt = null;
    state.promotedCount = 0;
    state.promotedFingerprint = "";
    render();
  }

  function install() {
    ensureMount();
    observe();
    requestAnimationFrame(ensureMount);
    setTimeout(ensureMount, 180);
    window.addEventListener("fpl:prompt-studio-clean-ready", queueEnsure);
    window.addEventListener("fpl:prompt-studio-clean-rendered", queueEnsure);
    window.addEventListener("fpl:prompt-quality-analysis-complete", invalidate);
    document.documentElement.dataset.promptPromotion = "v1";
    window.dispatchEvent(new CustomEvent("fpl:prompt-promotion-ready", { detail: { version: VERSION } }));
  }

  window.FPL_PROMPT_PROMOTION_V1 = Object.freeze({
    ready: true,
    version: VERSION,
    audit: options => audit(options),
    promote,
    clearSessionPromotion,
    render,
    getState: () => ({
      includeReview: state.includeReview,
      promotedAt: state.promotedAt,
      promotedCount: state.promotedCount,
      promotedFingerprint: state.promotedFingerprint
    })
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
