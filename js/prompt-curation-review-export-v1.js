/* FPL Draft Challenge — Prompt Curation Review Export v1.0.0
   Read-only Studio utility. Builds the deterministic 144-prompt curation calibration batch
   directly from the durable Prompt Library shard snapshot already stored in IndexedDB. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_CURATION_REVIEW_EXPORT_V1?.ready) return;

  const VERSION = "1.0.0";
  const FAMILIES = ["season-stats","position-stat","exact-stats","combined-stats","club-stat","league-position","promoted-clubs","relegated-clubs","champions","nationality","career-longevity","club-count","manager","anti-meta","value","minutes-role","composite-story"];
  const TARGETS = {
    "season-stats":185, champions:200, "promoted-clubs":225, "relegated-clubs":225, "club-count":250,
    "anti-meta":300, "exact-stats":300, "position-stat":325, "league-position":325, "career-longevity":350,
    value:400, "club-stat":400, nationality:400, manager:400, "minutes-role":400, "composite-story":450, "combined-stats":450
  };
  const DECISIONS = ["CERTIFY","RESCUE","REJECT"];
  const ANSWER_BANDS = ["2","3-5","6-15","16-40","41-80","81-150","151+"];
  const SIZE_BANDS = [["1",1,1],["2",2,2],["3",3,3],["4-5",4,5],["6-10",6,10],["11-20",11,20],["21-50",21,50],["51-100",51,100],["101-250",101,250],["251+",251,Infinity]];
  const state = { busy: false, lastError: "", lastPayload: null, observer: null, queued: false };

  const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
  const pct = (value, total) => total ? value / total * 100 : 0;
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const countBy = (items, key, seed = []) => {
    const out = Object.fromEntries(seed.map(value => [value, 0]));
    for (const item of items) {
      const value = key(item);
      out[value] = (out[value] || 0) + 1;
    }
    return out;
  };

  const quantile = (values, q) => {
    if (!values.length) return 0;
    const x = (values.length - 1) * q;
    const index = Math.floor(x);
    const remainder = x - index;
    return values[index + 1] == null ? values[index] : values[index] + remainder * (values[index + 1] - values[index]);
  };

  const answerBand = value => value <= 2 ? "2" : value <= 5 ? "3-5" : value <= 15 ? "6-15" : value <= 40 ? "16-40" : value <= 80 ? "41-80" : value <= 150 ? "81-150" : "151+";
  const sizeBand = value => SIZE_BANDS.find(([, low, high]) => value >= low && value <= high)?.[0] || "unknown";
  const groupOf = record => String(record?.variantGroup || "").trim() || `missing:${record?.family}:${record?.position}:${JSON.stringify(record?.conditions || [])}`;

  function inspect(payload) {
    if (payload?.kind !== "fpl-prompt-library-family-shards" || !payload.manifest || !Array.isArray(payload.shards)) {
      throw new Error("Saved data is not a Prompt Library family-shard package.");
    }

    const errors = [];
    const ids = new Set();
    const groups = new Map();
    const byFamily = new Map(FAMILIES.map(family => [family, []]));
    const shardFamilies = payload.shards.map(shard => String(shard?.family || ""));
    const missing = FAMILIES.filter(family => !shardFamilies.includes(family));
    const extra = shardFamilies.filter(family => !FAMILIES.includes(family));
    if (missing.length) errors.push(`Missing families: ${missing.join(", ")}`);
    if (extra.length) errors.push(`Unexpected families: ${extra.join(", ")}`);
    if (new Set(shardFamilies).size !== shardFamilies.length) errors.push("Duplicate family shards found.");

    const manifestCounts = new Map((payload.manifest.familyShards || []).map(item => [String(item?.family || ""), n(item?.count, -1)]));
    let pass = 0;
    let review = 0;
    let total = 0;
    let duplicates = 0;

    for (const shard of payload.shards) {
      const family = String(shard?.family || "");
      const records = Array.isArray(shard?.records) ? shard.records : [];
      if (n(shard?.count, -1) !== records.length) errors.push(`Shard ${family} count ${shard?.count} does not match ${records.length} records.`);
      if (manifestCounts.has(family) && manifestCounts.get(family) !== records.length) errors.push(`Manifest family shard ${family} count mismatch.`);
      total += records.length;

      for (const raw of records) {
        const record = { ...raw, family };
        const id = String(record?.id || "").trim();
        const group = groupOf(record);
        if (!id) errors.push(`Record in ${family} is missing ID.`);
        else if (ids.has(id)) duplicates += 1;
        else ids.add(id);
        if (String(raw?.family || "") !== family) errors.push(`Record ${id || "(missing id)"} has wrong family.`);
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(record);
        byFamily.get(family)?.push(record);
        if (record.qualityStatus === "pass") pass += 1;
        else if (record.qualityStatus === "review") review += 1;
      }
    }

    if (duplicates) errors.push(`${duplicates} duplicate prompt IDs found.`);
    if (n(payload.manifest.total) !== total) errors.push(`Manifest total ${payload.manifest.total} does not match ${total}.`);
    if (n(payload.manifest.families) !== FAMILIES.length) errors.push(`Manifest family count is ${payload.manifest.families}; expected ${FAMILIES.length}.`);
    if (n(payload.manifest.variantGroups) !== groups.size) errors.push(`Manifest variant-group count ${payload.manifest.variantGroups} does not match ${groups.size}.`);
    if (n(payload.manifest.qualityPass) !== pass) errors.push(`Manifest pass count ${payload.manifest.qualityPass} does not match ${pass}.`);
    if (n(payload.manifest.qualityReview) !== review) errors.push(`Manifest review count ${payload.manifest.qualityReview} does not match ${review}.`);

    for (const [group, records] of groups) {
      const stored = new Set(records.map(record => n(record?.qualityEvidence?.variantGroupSize, -1)).filter(value => value >= 0));
      if (stored.size && (stored.size !== 1 || !stored.has(records.length))) {
        errors.push(`Variant group ${group} stores size(s) ${[...stored].join(", ")} but contains ${records.length} records.`);
      }
    }

    if (errors.length) throw new Error(`Curation audit input failed validation: ${errors.slice(0, 8).join(" | ")}${errors.length > 8 ? ` | +${errors.length - 8} more` : ""}`);
    return { records: [...byFamily.values()].flat(), byFamily, groups };
  }

  function score(record) {
    const evidence = record?.qualityEvidence || {};
    const answers = n(evidence.answerPlayers);
    const answerUtility = answers >= 6 && answers <= 80 ? 12 : answers >= 3 && answers <= 150 ? 7 : 2;
    return n(record?.qualityScore) * 10 + n(evidence.coverage) + Math.min(20, n(evidence.seasons)) + Math.min(20, n(evidence.clubs)) + answerUtility;
  }

  const compare = (a, b) => score(b) - score(a) || String(a?.id || "").localeCompare(String(b?.id || ""));

  function distance(anchor, candidate) {
    const anchorAnswers = n(anchor?.qualityEvidence?.answerPlayers);
    const candidateAnswers = n(candidate?.qualityEvidence?.answerPlayers);
    return (answerBand(anchorAnswers) !== answerBand(candidateAnswers) ? 3 : 0)
      + (String(anchor?.difficulty || "") !== String(candidate?.difficulty || "") ? 2 : 0)
      + (anchorAnswers && Math.abs(anchorAnswers - candidateAnswers) >= Math.max(3, Math.ceil(anchorAnswers * 0.2)) ? 2 : 0)
      + (Math.abs(n(anchor?.qualityScore) - n(candidate?.qualityScore)) >= 10 ? 1 : 0);
  }

  function familyMetric(family, records) {
    const local = new Map();
    for (const record of records) {
      const group = groupOf(record);
      if (!local.has(group)) local.set(group, []);
      local.get(group).push(record);
    }
    const sizes = [...local.values()].map(recordsInGroup => recordsInGroup.length).sort((a, b) => a - b);
    return {
      family,
      prompts: records.length,
      target: TARGETS[family],
      targetCompressionPct: round(100 - pct(Math.min(records.length, TARGETS[family]), records.length)),
      variantGroups: local.size,
      promptsPerGroup: round(records.length / Math.max(1, local.size)),
      groupMedian: round(quantile(sizes, 0.5), 1),
      groupP90: round(quantile(sizes, 0.9), 1),
      groupMax: sizes.at(-1) || 0,
      positions: countBy(records, record => String(record?.position || "OTHER"), ["ANY","GK","DEF","MID","FWD","OTHER"]),
      difficulties: countBy(records, record => ["easy","medium","hard"].includes(String(record?.difficulty || "").toLowerCase()) ? String(record.difficulty).toLowerCase() : "unknown", ["easy","medium","hard","unknown"]),
      answerBands: countBy(records, record => answerBand(n(record?.qualityEvidence?.answerPlayers)), ANSWER_BANDS)
    };
  }

  function quotas(family, extras, smallIndex) {
    if (extras.has(family)) return { CERTIFY: 3, RESCUE: 3, REJECT: 3 };
    const missing = DECISIONS[smallIndex % 3];
    return Object.fromEntries(DECISIONS.map(decision => [decision, decision === missing ? 2 : 3]));
  }

  function annotated(records, groups) {
    return records.map(record => {
      const group = groupOf(record);
      const members = [...(groups.get(group) || [record])].sort(compare);
      const rank = members.findIndex(item => item.id === record.id);
      const anchor = members[0];
      return { record, group, members, rank, distance: rank > 0 ? distance(anchor, record) : 0 };
    });
  }

  function pool(decision, items) {
    const preferred = items.filter(item => decision === "CERTIFY"
      ? item.rank === 0 && n(item.record?.qualityScore) >= 65 && n(item.record?.qualityEvidence?.answerPlayers) >= 3
      : decision === "RESCUE"
        ? item.rank > 0 && item.rank <= 2 && n(item.record?.qualityScore) >= 45 && item.distance >= 2
        : item.rank >= 2 && (item.members.length >= 6 || item.distance <= 2));
    const fallback = items.filter(item => decision === "CERTIFY" ? item.rank === 0 : decision === "RESCUE" ? item.rank > 0 : item.rank >= 1)
      .filter(item => !preferred.includes(item));
    return [...preferred, ...fallback].sort((a, b) => decision === "CERTIFY"
      ? compare(a.record, b.record) || b.members.length - a.members.length
      : decision === "RESCUE"
        ? b.distance - a.distance || compare(a.record, b.record)
        : b.members.length - a.members.length || a.distance - b.distance || compare(a.record, b.record));
  }

  function reviewBatch(index, familyRows) {
    const extras = new Set([...familyRows].sort((a, b) => b.prompts - a.prompts || a.family.localeCompare(b.family)).slice(0, 8).map(row => row.family));
    const small = FAMILIES.filter(family => !extras.has(family));
    const selected = new Set();
    const rows = [];
    const familyQuotas = {};

    for (const family of FAMILIES) {
      const quota = quotas(family, extras, small.indexOf(family));
      familyQuotas[family] = quota;
      const items = annotated(index.byFamily.get(family) || [], index.groups);
      for (const decision of DECISIONS) {
        let need = quota[decision];
        for (const item of pool(decision, items)) {
          if (!need) break;
          const id = String(item.record?.id || "");
          if (!id || selected.has(id)) continue;
          selected.add(id);
          rows.push({
            reviewIndex: 0,
            proposedDecision: decision,
            family,
            id,
            label: String(item.record?.label || ""),
            position: String(item.record?.position || ""),
            difficulty: String(item.record?.difficulty || "unknown"),
            qualityScore: n(item.record?.qualityScore),
            answerPlayers: n(item.record?.qualityEvidence?.answerPlayers),
            seasons: n(item.record?.qualityEvidence?.seasons),
            clubs: n(item.record?.qualityEvidence?.clubs),
            coverage: n(item.record?.qualityEvidence?.coverage),
            variantGroup: item.group,
            variantGroupSize: item.members.length,
            siblingRank: item.rank + 1,
            materialDistance: item.distance,
            conditions: item.record?.conditions || [],
            rationale: decision === "CERTIFY"
              ? "Group anchor; strongest representative for this variant group."
              : decision === "RESCUE"
                ? `Sibling adds material answer-pool/difficulty contrast (distance ${item.distance}).`
                : `Threshold sibling ${item.rank + 1}/${item.members.length}; review for redundant numeric variation.`
          });
          need -= 1;
        }
        if (need) throw new Error(`Could not fill ${decision} quota for ${family}; ${need} slots remain.`);
      }
    }

    rows.sort((a, b) => a.family.localeCompare(b.family) || DECISIONS.indexOf(a.proposedDecision) - DECISIONS.indexOf(b.proposedDecision) || a.id.localeCompare(b.id));
    rows.forEach((row, indexValue) => { row.reviewIndex = indexValue + 1; });
    const decisionCounts = countBy(rows, row => row.proposedDecision, DECISIONS);
    if (rows.length !== 144 || DECISIONS.some(decision => decisionCounts[decision] !== 48)) {
      throw new Error(`Review batch invariant failed: ${rows.length} / ${JSON.stringify(decisionCounts)}.`);
    }
    return { records: rows, familyQuotas, extraFamilies: [...extras], decisionCounts };
  }

  function buildReviewPayloadFromPackage(payload) {
    const index = inspect(payload);
    for (const members of index.groups.values()) members.sort(compare);
    const families = FAMILIES.map(family => familyMetric(family, index.byFamily.get(family) || []));
    const sizes = [...index.groups.values()].map(records => records.length).sort((a, b) => a - b);
    const buckets = Object.fromEntries(SIZE_BANDS.map(([key]) => [key, 0]));
    for (const size of sizes) buckets[sizeBand(size)] += 1;
    const totalTarget = Object.values(TARGETS).reduce((sum, value) => sum + value, 0);
    const top = [...families].sort((a, b) => b.prompts - a.prompts || a.family.localeCompare(b.family));
    const batch = reviewBatch(index, families);

    return {
      schemaVersion: 1,
      kind: "fpl-prompt-curation-review-batch",
      exportVersion: VERSION,
      generatedAt: new Date().toISOString(),
      source: {
        promotionFingerprint: String(payload.manifest.promotionFingerprint || ""),
        total: n(payload.manifest.total),
        families: n(payload.manifest.families),
        variantGroups: n(payload.manifest.variantGroups),
        qualityPass: n(payload.manifest.qualityPass),
        qualityReview: n(payload.manifest.qualityReview),
        savedAt: String(payload.manifest.savedAt || "")
      },
      policy: {
        survivorTargets: TARGETS,
        survivorTargetTotal: totalTarget,
        defaultVariantGroupTarget: 2,
        hardVariantGroupCap: 3,
        reviewBatchSize: 144,
        reviewDecisionTargets: { CERTIFY: 48, RESCUE: 48, REJECT: 48 }
      },
      audit: {
        compression: {
          sourcePrompts: index.records.length,
          variantGroups: index.groups.size,
          averagePromptsPerGroup: round(index.records.length / Math.max(1, index.groups.size)),
          medianGroupSize: round(quantile(sizes, 0.5), 1),
          p90GroupSize: round(quantile(sizes, 0.9), 1),
          p95GroupSize: round(quantile(sizes, 0.95), 1),
          p99GroupSize: round(quantile(sizes, 0.99), 1),
          maxGroupSize: sizes.at(-1) || 0,
          groupBuckets: buckets,
          capOne: index.groups.size,
          capTwo: sizes.reduce((sum, size) => sum + Math.min(2, size), 0),
          capThree: sizes.reduce((sum, size) => sum + Math.min(3, size), 0),
          survivorTarget: totalTarget,
          survivorTargetPerGroup: round(totalTarget / Math.max(1, index.groups.size)),
          survivorCompressionPct: round(100 - pct(totalTarget, index.records.length))
        },
        concentration: {
          topFiveSharePct: round(pct(top.slice(0, 5).reduce((sum, row) => sum + row.prompts, 0), index.records.length)),
          topSixSharePct: round(pct(top.slice(0, 6).reduce((sum, row) => sum + row.prompts, 0), index.records.length))
        },
        families
      },
      reviewBatch: batch
    };
  }

  async function buildReviewExport() {
    const shards = window.FPL_PROMPT_LIBRARY_SHARDS_V1;
    if (!shards?.buildRepositoryPackage) throw new Error("Prompt Library shard storage is not ready yet.");
    const payload = await shards.buildRepositoryPackage();
    return buildReviewPayloadFromPackage(payload);
  }

  async function downloadReviewExport() {
    if (state.busy) return false;
    state.busy = true;
    state.lastError = "";
    render();
    try {
      const payload = await buildReviewExport();
      state.lastPayload = payload;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `fpl-prompt-curation-review-144-${payload.source.promotionFingerprint || "snapshot"}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      return true;
    } catch (error) {
      state.lastError = String(error?.message || error);
      return false;
    } finally {
      state.busy = false;
      render();
    }
  }

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot");
    if (!root) return false;
    let mount = document.getElementById("promptCurationReviewExportMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "promptCurationReviewExportMount";
      mount.dataset.promptCurationReviewExport = "v1";
      const shardsMount = document.getElementById("promptLibraryShardsMount");
      const roadmap = root.querySelector(".prompt-clean-roadmap");
      if (shardsMount?.parentNode === root) shardsMount.insertAdjacentElement("afterend", mount);
      else if (roadmap) root.insertBefore(mount, roadmap);
      else root.appendChild(mount);
    }
    render();
    return true;
  }

  function render() {
    const mount = document.getElementById("promptCurationReviewExportMount");
    if (!mount) return false;
    const manifest = window.FPL_PROMPT_LIBRARY_SHARDS_V1?.getSavedManifest?.();
    const available = Boolean(manifest?.total && manifest?.families === 17);
    const last = state.lastPayload;

    mount.innerHTML = `<section class="prompt-library-shards" aria-labelledby="promptCurationReviewExportHeading">
      <div class="prompt-library-browser-head">
        <div>
          <p class="eyebrow">Refinement Incubator · Phase 1</p>
          <h3 id="promptCurationReviewExportHeading">Generate the real 144-prompt curation review</h3>
          <p>Reads the saved family shards already in this browser, validates the complete promoted pool, then exports only the balanced 48 CERTIFY / 48 RESCUE / 48 REJECT calibration batch plus its audit summary.</p>
        </div>
        <span class="phase-chip">${VERSION}</span>
      </div>

      <div class="prompt-shard-summary-grid">
        <div class="prompt-clean-status-card"><span>Saved prompts</span><strong>${Number(manifest?.total || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Families</span><strong>${Number(manifest?.families || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Variant groups</span><strong>${Number(manifest?.variantGroups || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Review export</span><strong>${last ? "144 ready" : "Not built"}</strong></div>
      </div>

      <div class="prompt-shard-actions">
        <button id="promptCurationReviewDownload" class="button" type="button"${available && !state.busy ? "" : " disabled"}>${state.busy ? "Building real 144…" : "Generate & download real 144"}</button>
        <span id="promptCurationReviewStatus">${state.lastError ? `Curation export error: ${esc(state.lastError)}` : state.busy ? "Validating all saved shards and selecting the deterministic review batch…" : last ? `Ready: ${last.reviewBatch.records.length} real prompts · ${last.reviewBatch.decisionCounts.CERTIFY}/${last.reviewBatch.decisionCounts.RESCUE}/${last.reviewBatch.decisionCounts.REJECT}.` : available ? `Ready to read ${Number(manifest.total).toLocaleString("en-GB")} saved prompts without downloading the full package.` : "Restore the saved Prompt Library snapshot above first."}</span>
      </div>

      <div class="prompt-shard-boundary">
        <strong>Read-only boundary</strong>
        <span>This does not alter Promotion, the saved source snapshot, Daily generation, publishing or the production-certified prompt pool. It only creates a small review file that can be uploaded for curation.</span>
      </div>
    </section>`;

    document.getElementById("promptCurationReviewDownload")?.addEventListener("click", downloadReviewExport);
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
      if (!document.getElementById("promptCurationReviewExportMount")) queueEnsure();
    });
    state.observer.observe(workspace, { childList: true, subtree: true });
  }

  function install() {
    ensureMount();
    observe();
    requestAnimationFrame(ensureMount);
    setTimeout(ensureMount, 220);
    window.addEventListener("fpl:prompt-studio-clean-ready", queueEnsure);
    window.addEventListener("fpl:prompt-studio-clean-rendered", queueEnsure);
    window.addEventListener("fpl:prompt-library-shards-ready", queueEnsure);
    window.addEventListener("fpl:prompt-library-shards-saved", render);
    window.addEventListener("fpl:prompt-library-shards-restored", render);
    window.addEventListener("fpl:prompt-library-shards-cleared", render);
    document.documentElement.dataset.promptCurationReviewExport = "v1";
    window.dispatchEvent(new CustomEvent("fpl:prompt-curation-review-export-ready", { detail: { version: VERSION } }));
  }

  window.FPL_PROMPT_CURATION_REVIEW_EXPORT_V1 = Object.freeze({
    ready: true,
    version: VERSION,
    buildReviewPayloadFromPackage,
    buildReviewExport,
    downloadReviewExport,
    render
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();