/* FPL Draft Challenge — Prompt Curation Survivor Builder v1.0.0
   Read-only Phase 1 proposal builder. Consumes the durable promoted shard package plus the
   full-library curation evidence, performs only evidence-backed hard collapse first, then makes
   a family-balanced survivor proposal. It never writes Promotion, saved shards or Daily. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_CURATION_SURVIVOR_BUILDER_V1?.ready) return;

  const VERSION = "1.0.0";
  const FAMILIES = ["season-stats","position-stat","exact-stats","combined-stats","club-stat","league-position","promoted-clubs","relegated-clubs","champions","nationality","career-longevity","club-count","manager","anti-meta","value","minutes-role","composite-story"];
  const TARGETS = {
    "season-stats":185, champions:200, "promoted-clubs":225, "relegated-clubs":225, "club-count":250,
    "anti-meta":300, "exact-stats":300, "position-stat":325, "league-position":325, "career-longevity":350,
    value:400, "club-stat":400, nationality:400, manager:400, "minutes-role":400, "composite-story":450, "combined-stats":450
  };
  const ENTITY_FIELDS = new Set(["club","manager","nationality"]);
  const state = { busy: false, lastPayload: null, lastError: "", status: "" };

  const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const fieldOf = condition => String(condition?.field || "").trim();
  const operatorOf = condition => String(condition?.operator ?? condition?.op ?? "").trim();
  const answerBand = value => value <= 2 ? "2" : value <= 5 ? "3-5" : value <= 15 ? "6-15" : value <= 40 ? "16-40" : value <= 80 ? "41-80" : value <= 150 ? "81-150" : "151+";
  const difficultyOf = record => ["easy","medium","hard"].includes(String(record?.difficulty || "").toLowerCase()) ? String(record.difficulty).toLowerCase() : "unknown";

  function validateInputs(source, evidence) {
    if (source?.kind !== "fpl-prompt-library-family-shards" || !source?.manifest || !Array.isArray(source?.shards)) throw new Error("Saved source is not a Prompt Library family-shard package.");
    if (evidence?.kind !== "fpl-prompt-curation-evidence" || !evidence?.source || !Array.isArray(evidence?.evidenceShards)) throw new Error("Full-library curation evidence is unavailable or invalid.");
    const sourceFingerprint = String(source.manifest.promotionFingerprint || "");
    const evidenceFingerprint = String(evidence.source.promotionFingerprint || "");
    if (!sourceFingerprint || sourceFingerprint !== evidenceFingerprint) throw new Error(`Evidence fingerprint ${evidenceFingerprint || "(missing)"} does not match saved Promotion fingerprint ${sourceFingerprint || "(missing)"}.`);
    if (n(source.manifest.total, -1) !== n(evidence.source.total, -2)) throw new Error("Evidence total does not match the saved promoted source total.");
    if (n(evidence.summary?.storedAnswerCountMismatches, 0) > 0) throw new Error("Evidence contains stored answer-count mismatches. Survivor selection is blocked until those are resolved.");
  }

  function entityKey(record) {
    const parts = [];
    for (const condition of record?.conditions || []) {
      const field = fieldOf(condition);
      if (ENTITY_FIELDS.has(field) && condition?.value != null) parts.push(`${field}:${String(condition.value)}`);
    }
    return parts.sort().join("|") || `position:${String(record?.position || "ANY")}`;
  }

  function thresholdStep(field) {
    return ({
      points:25, minutes:500, startingPrice:1, finalPrice:1, goals:5, assists:3,
      cleanSheets:3, bonus:5, saves:25, goalInvolvements:5, careerSeasonCount:2,
      careerClubCount:1, leaguePosition:3
    })[field] || 5;
  }

  function thresholdCell(record) {
    const parts = [];
    for (const condition of record?.conditions || []) {
      const value = Number(condition?.value);
      if (!Number.isFinite(value)) continue;
      const field = fieldOf(condition), step = thresholdStep(field);
      parts.push(`${field}:${operatorOf(condition)}:${Math.floor(value / step)}`);
      const value2 = Number(condition?.value2);
      if (Number.isFinite(value2)) parts.push(`${field}:upper:${Math.floor(value2 / step)}`);
    }
    return parts.join("|") || "non-numeric";
  }

  function thresholdNiceness(record) {
    const numeric = [];
    for (const condition of record?.conditions || []) {
      for (const raw of [condition?.value, condition?.value2]) {
        if (raw == null || raw === "" || !Number.isFinite(Number(raw))) continue;
        const value = Number(raw), field = fieldOf(condition);
        let score = 0;
        if (field === "startingPrice" || field === "finalPrice") score = Number.isInteger(value * 2) ? 1 : 0;
        else if (Number.isInteger(value) && value % 10 === 0) score = 1;
        else if (Number.isInteger(value) && value % 5 === 0) score = 0.85;
        else if (Number.isInteger(value)) score = 0.55;
        else score = 0.25;
        numeric.push(score);
      }
    }
    return numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : 0.5;
  }

  function minMarginalPct(evidence) {
    const rows = Array.isArray(evidence?.conditionMarginality) ? evidence.conditionMarginality : [];
    if (!rows.length) return 100;
    return Math.min(...rows.map(item => n(item?.marginalPctOfWithout, 0)));
  }

  function answerUtility(value) {
    const answers = n(value);
    if (answers >= 6 && answers <= 80) return 10;
    if (answers >= 3 && answers <= 150) return 7;
    if (answers === 2 || answers <= 250) return 4;
    return 1;
  }

  function representativeScore(record, evidence) {
    const quality = n(record?.qualityScore);
    const qe = record?.qualityEvidence || {};
    const marginal = minMarginalPct(evidence);
    return quality * 0.45
      + n(qe.coverage) * 0.10
      + Math.min(15, n(qe.seasons)) * 0.40
      + Math.min(25, n(qe.clubs)) * 0.18
      + answerUtility(evidence?.answerPlayers)
      + marginal * 0.14
      + thresholdNiceness(record) * 6;
  }

  function compareRepresentative(a, b) {
    return representativeScore(b.record, b.evidence) - representativeScore(a.record, a.evidence)
      || n(b.record?.qualityScore) - n(a.record?.qualityScore)
      || minMarginalPct(b.evidence) - minMarginalPct(a.evidence)
      || String(a.record?.id || "").localeCompare(String(b.record?.id || ""));
  }

  function classKey(evidence) {
    const representative = String(evidence?.exactEquivalentRepresentativeId || evidence?.id || "");
    return `${String(evidence?.family || "")}|${String(evidence?.variantGroup || "")}|${representative}`;
  }

  function dimensions(candidate) {
    const { record, evidence } = candidate;
    return {
      group: String(record?.variantGroup || evidence?.variantGroup || ""),
      position: String(record?.position || evidence?.position || "ANY"),
      difficulty: difficultyOf(record),
      answerBand: answerBand(n(evidence?.answerPlayers)),
      entity: entityKey(record),
      material: `${String(record?.variantGroup || "")}|${difficultyOf(record)}|${answerBand(n(evidence?.answerPlayers))}|${thresholdCell(record)}`
    };
  }

  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  const count = (map, key) => map.get(key) || 0;

  function dynamicSelectionScore(candidate, selectedIds, counts) {
    const d = candidate.dimensions;
    let score = representativeScore(candidate.record, candidate.evidence);
    score += 30 / Math.sqrt(1 + count(counts.group, d.group));
    score += 18 / Math.sqrt(1 + count(counts.material, d.material));
    score += 10 / Math.sqrt(1 + count(counts.position, d.position));
    score += 10 / Math.sqrt(1 + count(counts.difficulty, d.difficulty));
    score += 12 / Math.sqrt(1 + count(counts.answerBand, d.answerBand));
    score += 12 / Math.sqrt(1 + count(counts.entity, d.entity));

    const neighbour = candidate.evidence?.axisNeighbor;
    if (neighbour?.id && selectedIds.has(String(neighbour.id))) {
      const j = n(neighbour.jaccard);
      if (j >= 0.995) score -= 26;
      else if (j >= 0.98) score -= 16;
      else if (j >= 0.95) score -= 9;
      else if (j >= 0.90) score -= 3;
    }

    const minAdded = n(candidate.evidence?.minConditionAddedPlayers, 0);
    const minPct = minMarginalPct(candidate.evidence);
    if (minAdded <= 2) score -= 7;
    if (minPct <= 5) score -= 6;
    return score;
  }

  function selectFamily(candidates, target) {
    const remaining = [...candidates];
    const selected = [], selectedIds = new Set();
    const counts = {
      group:new Map(), material:new Map(), position:new Map(), difficulty:new Map(), answerBand:new Map(), entity:new Map()
    };
    const limit = Math.min(target, remaining.length);

    while (selected.length < limit && remaining.length) {
      let bestIndex = 0, bestScore = -Infinity;
      for (let index = 0; index < remaining.length; index += 1) {
        const score = dynamicSelectionScore(remaining[index], selectedIds, counts);
        if (score > bestScore || (score === bestScore && String(remaining[index].record.id).localeCompare(String(remaining[bestIndex]?.record?.id || "")) < 0)) {
          bestScore = score;
          bestIndex = index;
        }
      }
      const candidate = remaining.splice(bestIndex, 1)[0];
      candidate.selectionScore = round(bestScore, 3);
      candidate.selectionRank = selected.length + 1;
      selected.push(candidate);
      selectedIds.add(String(candidate.record.id));
      const d = candidate.dimensions;
      bump(counts.group, d.group); bump(counts.material, d.material); bump(counts.position, d.position);
      bump(counts.difficulty, d.difficulty); bump(counts.answerBand, d.answerBand); bump(counts.entity, d.entity);
    }
    return { selected, deferred: remaining };
  }

  function countBy(items, key) {
    const out = {};
    for (const item of items) { const value = key(item); out[value] = (out[value] || 0) + 1; }
    return out;
  }

  function buildProposalFromData(source, evidence, { targets = TARGETS } = {}) {
    validateInputs(source, evidence);
    const sourceRecords = source.shards.flatMap(shard => (shard?.records || []).map(record => ({ ...record, family: String(shard?.family || record?.family || "") })));
    const evidenceRecords = evidence.evidenceShards.flatMap(shard => shard?.records || []);
    const sourceById = new Map(sourceRecords.map(record => [String(record?.id || ""), record]));
    const evidenceById = new Map(evidenceRecords.map(item => [String(item?.id || ""), item]));
    const decisions = new Map();
    const classBuckets = new Map();

    for (const record of sourceRecords) {
      const id = String(record?.id || ""), item = evidenceById.get(id);
      if (!item) {
        decisions.set(id, { id, family: record.family, status:"DEFER", reason:"evidence-missing" });
        continue;
      }
      if (item.answerCountMatchesStored === false) {
        decisions.set(id, { id, family: record.family, status:"HARD_REJECT", reason:"stored-answer-mismatch" });
        continue;
      }
      if (n(item.decorativeConditionCount) > 0) {
        decisions.set(id, { id, family: record.family, status:"HARD_REJECT", reason:"decorative-condition", decorativeConditionCount:n(item.decorativeConditionCount) });
        continue;
      }
      const key = classKey(item);
      if (!classBuckets.has(key)) classBuckets.set(key, []);
      classBuckets.get(key).push({ record, evidence:item });
    }

    const candidatesByFamily = new Map(FAMILIES.map(family => [family, []]));
    for (const [key, members] of classBuckets) {
      const ordered = [...members].sort(compareRepresentative), representative = ordered[0];
      representative.classKey = key;
      representative.dimensions = dimensions(representative);
      representative.exactClassCleanSize = ordered.length;
      representative.exactClassReportedSize = n(representative.evidence?.exactEquivalentClassSize, ordered.length);
      candidatesByFamily.get(representative.record.family)?.push(representative);
      for (const member of ordered.slice(1)) {
        decisions.set(String(member.record.id), {
          id:String(member.record.id), family:member.record.family, status:"COLLAPSE", reason:"exact-equivalent-sibling",
          representativeId:String(representative.record.id), answerFingerprint:String(member.evidence?.answerFingerprint || "")
        });
      }
    }

    const selectedAll = [], familyMetrics = [];
    for (const family of FAMILIES) {
      const candidates = (candidatesByFamily.get(family) || []).sort(compareRepresentative);
      const target = n(targets[family], candidates.length), result = selectFamily(candidates, target);
      for (const candidate of result.selected) {
        selectedAll.push(candidate);
        decisions.set(String(candidate.record.id), {
          id:String(candidate.record.id), family, status:"SELECT", reason:"balanced-clean-exact-representative",
          selectionRank:candidate.selectionRank, selectionScore:candidate.selectionScore,
          answerPlayers:n(candidate.evidence?.answerPlayers), answerFingerprint:String(candidate.evidence?.answerFingerprint || ""),
          minConditionAddedPlayers:n(candidate.evidence?.minConditionAddedPlayers), minConditionMarginalPct:round(minMarginalPct(candidate.evidence),2)
        });
      }
      for (const candidate of result.deferred) {
        decisions.set(String(candidate.record.id), {
          id:String(candidate.record.id), family, status:"DEFER", reason:"outside-family-envelope",
          answerPlayers:n(candidate.evidence?.answerPlayers), answerFingerprint:String(candidate.evidence?.answerFingerprint || "")
        });
      }
      familyMetrics.push({
        family,
        sourcePrompts: sourceRecords.filter(record => record.family === family).length,
        maximumEnvelope: target,
        cleanExactClasses: candidates.length,
        selected: result.selected.length,
        deferredCleanClasses: result.deferred.length,
        positions: countBy(result.selected, candidate => candidate.dimensions.position),
        difficulties: countBy(result.selected, candidate => candidate.dimensions.difficulty),
        answerBands: countBy(result.selected, candidate => candidate.dimensions.answerBand),
        variantGroups: new Set(result.selected.map(candidate => candidate.dimensions.group)).size,
        entities: new Set(result.selected.map(candidate => candidate.dimensions.entity)).size
      });
    }

    const selectedIds = new Set(selectedAll.map(candidate => String(candidate.record.id)));
    const survivorShards = source.shards.map(shard => ({
      family:String(shard?.family || ""),
      count:(shard?.records || []).filter(record => selectedIds.has(String(record?.id || ""))).length,
      records:(shard?.records || []).filter(record => selectedIds.has(String(record?.id || "")))
    }));
    const survivorEvidenceShards = evidence.evidenceShards.map(shard => ({
      family:String(shard?.family || ""),
      count:(shard?.records || []).filter(item => selectedIds.has(String(item?.id || ""))).length,
      records:(shard?.records || []).filter(item => selectedIds.has(String(item?.id || "")))
    }));
    const decisionShards = source.shards.map(shard => ({
      family:String(shard?.family || ""),
      count:Array.isArray(shard?.records) ? shard.records.length : 0,
      records:(shard?.records || []).map(record => decisions.get(String(record?.id || "")) || { id:String(record?.id || ""), family:String(shard?.family || ""), status:"DEFER", reason:"unclassified" })
    }));
    const allDecisions = [...decisions.values()];
    const effectiveCleanCeiling = familyMetrics.reduce((sum, row) => sum + Math.min(row.cleanExactClasses, row.maximumEnvelope), 0);

    return {
      schemaVersion:1,
      kind:"fpl-prompt-curation-survivor-proposal",
      builderVersion:VERSION,
      generatedAt:new Date().toISOString(),
      source:{
        promotionFingerprint:String(source.manifest.promotionFingerprint || ""),
        total:n(source.manifest.total), families:n(source.manifest.families), variantGroups:n(source.manifest.variantGroups)
      },
      evidence:{
        evidenceVersion:String(evidence.evidenceVersion || ""), generatedAt:evidence.generatedAt || null,
        promotionFingerprint:String(evidence.source.promotionFingerprint || ""), summary:{ ...(evidence.summary || {}) }
      },
      policy:{
        authority:"proposal-only",
        hardRules:["stored-answer-mismatch blocks selection","decorative conditions cannot survive","exact-equivalent answer sets collapse to the strongest clean member"],
        softRules:["family maximum envelope","variant-group spread","position spread","difficulty spread","answer-band spread","entity spread","coarse threshold-cell spread","nearest one-axis Jaccard penalty","threshold recognisability tie-break"],
        dailyAuthorityChanged:false,
        maximumEnvelopeTotal:Object.values(targets).reduce((sum, value) => sum + n(value), 0),
        effectiveCleanCeiling
      },
      summary:{
        sourcePrompts:sourceRecords.length,
        evidencePrompts:evidenceRecords.length,
        selected:selectedAll.length,
        effectiveCleanCeiling,
        hardRejectedDecorative:allDecisions.filter(item => item.status === "HARD_REJECT" && item.reason === "decorative-condition").length,
        hardRejectedMismatch:allDecisions.filter(item => item.status === "HARD_REJECT" && item.reason === "stored-answer-mismatch").length,
        collapsedExactEquivalentSiblings:allDecisions.filter(item => item.status === "COLLAPSE").length,
        deferred:allDecisions.filter(item => item.status === "DEFER").length,
        cleanExactRepresentatives:familyMetrics.reduce((sum, row) => sum + row.cleanExactClasses, 0)
      },
      familyMetrics,
      survivorShards,
      survivorEvidenceShards,
      decisionShards
    };
  }

  async function runSavedProposal({ download = false } = {}) {
    if (state.busy) return state.lastPayload;
    const shards = window.FPL_PROMPT_LIBRARY_SHARDS_V1;
    const evidenceApi = window.FPL_PROMPT_CURATION_EVIDENCE_V1;
    if (!shards?.buildRepositoryPackage) throw new Error("Prompt Library shard storage is not ready yet.");
    if (!evidenceApi?.runSavedPackage) throw new Error("Full-library curation evidence is not ready yet.");
    state.busy = true; state.lastError = ""; state.status = "Reading saved source…"; render();
    try {
      const source = await shards.buildRepositoryPackage();
      let evidence = evidenceApi.getLastPayload?.();
      const fingerprint = String(source?.manifest?.promotionFingerprint || "");
      if (!evidence || String(evidence?.source?.promotionFingerprint || "") !== fingerprint) {
        state.status = "Rebuilding full-library evidence for the current saved snapshot…"; render();
        evidence = await evidenceApi.runSavedPackage();
      }
      state.status = "Selecting balanced clean representatives…"; render();
      const payload = buildProposalFromData(source, evidence);
      state.lastPayload = payload; state.status = "";
      window.dispatchEvent(new CustomEvent("fpl:prompt-curation-survivor-proposal-ready", { detail:{ version:VERSION, source:payload.source, summary:payload.summary } }));
      if (download) downloadPayload(payload);
      return payload;
    } catch (error) {
      state.lastError = error?.message || String(error);
      throw error;
    } finally {
      state.busy = false; render();
    }
  }

  function downloadPayload(payload = state.lastPayload) {
    if (!payload) return false;
    const fingerprint = String(payload?.source?.promotionFingerprint || "unknown").replace(/[^a-z0-9_-]+/gi, "_");
    const blob = new Blob([JSON.stringify(payload)], { type:"application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fpl-prompt-curation-survivor-proposal-${fingerprint}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    return true;
  }

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot");
    if (!root) return null;
    let mount = document.getElementById("promptCurationSurvivorBuilderMount");
    if (mount) return mount;
    mount = document.createElement("div");
    mount.id = "promptCurationSurvivorBuilderMount";
    mount.dataset.promptCurationSurvivorBuilder = "v1";
    const evidence = document.getElementById("promptCurationEvidenceMount"), review = document.getElementById("promptCurationReviewExportMount"), roadmap = root.querySelector(".prompt-clean-roadmap");
    if (evidence) evidence.after(mount); else if (review) review.after(mount); else if (roadmap) roadmap.before(mount); else root.appendChild(mount);
    return mount;
  }

  function render() {
    const mount = ensureMount();
    if (!mount) return false;
    const manifest = window.FPL_PROMPT_LIBRARY_SHARDS_V1?.getSavedManifest?.();
    const available = Boolean(manifest?.total && manifest?.families === 17 && window.FPL_PROMPT_CURATION_EVIDENCE_V1?.ready);
    const last = state.lastPayload;
    const summary = last
      ? `${n(last.summary.selected).toLocaleString("en-GB")} proposed survivors · ${n(last.summary.hardRejectedDecorative).toLocaleString("en-GB")} decorative rejects · ${n(last.summary.collapsedExactEquivalentSiblings).toLocaleString("en-GB")} exact siblings collapsed · ${n(last.summary.deferred).toLocaleString("en-GB")} clean candidates deferred`
      : "No survivor proposal has been built in this page yet.";
    mount.innerHTML = `<section class="prompt-library-shards" aria-labelledby="promptCurationSurvivorBuilderHeading">
      <div class="prompt-library-shards-head"><div><p class="eyebrow">Curation proposal</p><h3 id="promptCurationSurvivorBuilderHeading">Full-library survivor builder</h3><p>Build the first evidence-backed survivor proposal from the saved promoted library. Hard collapse is deterministic; family-envelope selection remains a reviewable proposal. This does not alter Promotion, saved shards, Daily generation or publishing.</p></div><span class="phase-chip">v${esc(VERSION)}</span></div>
      <div class="prompt-library-shards-summary"><strong>${available ? `${n(manifest.total).toLocaleString("en-GB")} prompts ready` : "Source/evidence unavailable"}</strong><span>${esc(summary)}</span></div>
      <div class="button-row"><button id="promptCurationSurvivorBuild" class="button primary" type="button" ${!available || state.busy ? "disabled" : ""}>${state.busy ? "Building survivor proposal…" : "Build survivor proposal"}</button><button id="promptCurationSurvivorDownload" class="button secondary" type="button" ${last && !state.busy ? "" : "disabled"}>Download survivor proposal JSON</button></div>
      <p class="action-status" role="status">${esc(state.lastError || state.status || "SELECT means proposed survivor; COLLAPSE is evidence-safe redundancy removal; DEFER is a clean candidate outside the current family envelope, not a final rejection.")}</p>
    </section>`;
    mount.querySelector("#promptCurationSurvivorBuild")?.addEventListener("click", () => runSavedProposal().catch(() => {}));
    mount.querySelector("#promptCurationSurvivorDownload")?.addEventListener("click", () => downloadPayload());
    return true;
  }

  function install() {
    render();
    window.addEventListener("fpl:prompt-studio-clean-rendered", render);
    window.addEventListener("fpl:prompt-studio-clean-ready", render);
    window.addEventListener("fpl:prompt-library-shards-saved", render);
    window.addEventListener("fpl:prompt-curation-evidence-ready", render);
    window.dispatchEvent(new CustomEvent("fpl:prompt-curation-survivor-builder-installed", { detail:{ version:VERSION } }));
  }

  window.FPL_PROMPT_CURATION_SURVIVOR_BUILDER_V1 = Object.freeze({
    ready:true,
    version:VERSION,
    targets:{ ...TARGETS },
    buildProposalFromData,
    runSavedProposal,
    getLastPayload:() => state.lastPayload,
    downloadLast:() => downloadPayload(),
    render
  });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once:true });
    else install();
  }
})();
