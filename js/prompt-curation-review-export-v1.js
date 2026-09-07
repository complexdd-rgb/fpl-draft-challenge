/* FPL Draft Challenge — Prompt Curation Review Export v1.1.0
   Read-only Studio utility. Builds a deterministic 144-record calibration batch as
   48 same-variant-group triads: anchor + material contrast + redundant sibling. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_CURATION_REVIEW_EXPORT_V1?.ready) return;

  const VERSION = "1.1.0";
  const FAMILIES = ["season-stats","position-stat","exact-stats","combined-stats","club-stat","league-position","promoted-clubs","relegated-clubs","champions","nationality","career-longevity","club-count","manager","anti-meta","value","minutes-role","composite-story"];
  const TARGETS = {
    "season-stats":185, champions:200, "promoted-clubs":225, "relegated-clubs":225, "club-count":250,
    "anti-meta":300, "exact-stats":300, "position-stat":325, "league-position":325, "career-longevity":350,
    value:400, "club-stat":400, nationality:400, manager:400, "minutes-role":400, "composite-story":450, "combined-stats":450
  };
  const DECISIONS = ["CERTIFY","RESCUE","REJECT"];
  const ANSWER_BANDS = ["2","3-5","6-15","16-40","41-80","81-150","151+"];
  const SIZE_BANDS = [["1",1,1],["2",2,2],["3",3,3],["4-5",4,5],["6-10",6,10],["11-20",11,20],["21-50",21,50],["51-100",51,100],["101-250",101,250],["251+",251,Infinity]];
  const ENTITY_FIELDS = new Set(["club","manager","nationality"]);
  const state = { busy: false, lastError: "", lastPayload: null, observer: null, queued: false };

  const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
  const pct = (value, total) => total ? value / total * 100 : 0;
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const countBy = (items, key, seed = []) => {
    const out = Object.fromEntries(seed.map(value => [value, 0]));
    for (const item of items) { const value = key(item); out[value] = (out[value] || 0) + 1; }
    return out;
  };
  const quantile = (values, q) => {
    if (!values.length) return 0;
    const x = (values.length - 1) * q, index = Math.floor(x), remainder = x - index;
    return values[index + 1] == null ? values[index] : values[index] + remainder * (values[index + 1] - values[index]);
  };
  const answerBand = value => value <= 2 ? "2" : value <= 5 ? "3-5" : value <= 15 ? "6-15" : value <= 40 ? "16-40" : value <= 80 ? "41-80" : value <= 150 ? "81-150" : "151+";
  const sizeBand = value => SIZE_BANDS.find(([, low, high]) => value >= low && value <= high)?.[0] || "unknown";
  const groupOf = record => String(record?.variantGroup || "").trim() || `missing:${record?.family}:${record?.position}:${JSON.stringify(record?.conditions || [])}`;
  const operatorOf = condition => String(condition?.operator ?? condition?.op ?? "").trim();
  const fieldOf = condition => String(condition?.field ?? "").trim();
  const conditionKey = condition => `${fieldOf(condition)}|${operatorOf(condition)}`;

  function inspect(payload) {
    if (payload?.kind !== "fpl-prompt-library-family-shards" || !payload.manifest || !Array.isArray(payload.shards)) throw new Error("Saved data is not a Prompt Library family-shard package.");
    const errors = [], ids = new Set(), groups = new Map(), byFamily = new Map(FAMILIES.map(family => [family, []]));
    const shardFamilies = payload.shards.map(shard => String(shard?.family || ""));
    const missing = FAMILIES.filter(family => !shardFamilies.includes(family));
    const extra = shardFamilies.filter(family => !FAMILIES.includes(family));
    if (missing.length) errors.push(`Missing families: ${missing.join(", ")}`);
    if (extra.length) errors.push(`Unexpected families: ${extra.join(", ")}`);
    if (new Set(shardFamilies).size !== shardFamilies.length) errors.push("Duplicate family shards found.");
    const manifestCounts = new Map((payload.manifest.familyShards || []).map(item => [String(item?.family || ""), n(item?.count, -1)]));
    let pass = 0, review = 0, total = 0, duplicates = 0;
    for (const shard of payload.shards) {
      const family = String(shard?.family || ""), records = Array.isArray(shard?.records) ? shard.records : [];
      if (n(shard?.count, -1) !== records.length) errors.push(`Shard ${family} count ${shard?.count} does not match ${records.length} records.`);
      if (manifestCounts.has(family) && manifestCounts.get(family) !== records.length) errors.push(`Manifest family shard ${family} count mismatch.`);
      total += records.length;
      for (const raw of records) {
        const record = { ...raw, family }, id = String(record?.id || "").trim(), group = groupOf(record);
        if (!id) errors.push(`Record in ${family} is missing ID.`); else if (ids.has(id)) duplicates += 1; else ids.add(id);
        if (String(raw?.family || "") !== family) errors.push(`Record ${id || "(missing id)"} has wrong family.`);
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(record);
        byFamily.get(family)?.push(record);
        if (record.qualityStatus === "pass") pass += 1; else if (record.qualityStatus === "review") review += 1;
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
      if (stored.size && (stored.size !== 1 || !stored.has(records.length))) errors.push(`Variant group ${group} stores size(s) ${[...stored].join(", ")} but contains ${records.length} records.`);
    }
    if (errors.length) throw new Error(`Curation audit input failed validation: ${errors.slice(0, 8).join(" | ")}${errors.length > 8 ? ` | +${errors.length - 8} more` : ""}`);
    return { records: [...byFamily.values()].flat(), byFamily, groups };
  }

  function score(record) {
    const evidence = record?.qualityEvidence || {}, answers = n(evidence.answerPlayers);
    const answerUtility = answers >= 6 && answers <= 80 ? 12 : answers >= 3 && answers <= 150 ? 7 : 2;
    return n(record?.qualityScore) * 10 + n(evidence.coverage) + Math.min(20, n(evidence.seasons)) + Math.min(20, n(evidence.clubs)) + answerUtility;
  }
  const compare = (a, b) => score(b) - score(a) || String(a?.id || "").localeCompare(String(b?.id || ""));

  function conditionMap(record) {
    const map = new Map();
    for (const condition of record?.conditions || []) map.set(conditionKey(condition), condition?.value);
    return map;
  }

  function conditionDistance(anchor, candidate) {
    const a = conditionMap(anchor), b = conditionMap(candidate), keys = new Set([...a.keys(), ...b.keys()]);
    let distance = 0;
    for (const key of keys) {
      if (!a.has(key) || !b.has(key)) { distance += 3; continue; }
      const av = a.get(key), bv = b.get(key);
      if (Number.isFinite(Number(av)) && Number.isFinite(Number(bv))) {
        const x = Number(av), y = Number(bv), ratio = Math.abs(x - y) / Math.max(1, Math.abs(x), Math.abs(y));
        if (!ratio) continue;
        distance += ratio < 0.1 ? 1 : ratio < 0.25 ? 2 : 3;
      } else if (String(av) !== String(bv)) distance += 3;
    }
    return distance;
  }

  function nestedRelation(anchor, candidate) {
    const aConditions = anchor?.conditions || [], bConditions = candidate?.conditions || [];
    if (aConditions.length !== bConditions.length) return 0;
    const b = new Map(bConditions.map(condition => [conditionKey(condition), condition]));
    let direction = 0;
    for (const aCondition of aConditions) {
      const key = conditionKey(aCondition), bCondition = b.get(key);
      if (!bCondition) return 0;
      const av = aCondition?.value, bv = bCondition?.value, op = operatorOf(aCondition).toLowerCase();
      if (!Number.isFinite(Number(av)) || !Number.isFinite(Number(bv))) {
        if (String(av) !== String(bv)) return 0;
        continue;
      }
      const x = Number(av), y = Number(bv);
      if (x === y) continue;
      let local = 0;
      if (["gte","gt",">=",">"].includes(op)) local = y > x ? 1 : -1;
      else if (["lte","lt","<=","<"].includes(op)) local = y < x ? 1 : -1;
      else return 0;
      if (direction && local !== direction) return 0;
      direction = local;
    }
    return direction;
  }

  const nestedEquivalent = (anchor, candidate) => nestedRelation(anchor, candidate) !== 0 && n(anchor?.qualityEvidence?.answerPlayers) === n(candidate?.qualityEvidence?.answerPlayers);

  function materialDistance(anchor, candidate) {
    const anchorAnswers = n(anchor?.qualityEvidence?.answerPlayers), candidateAnswers = n(candidate?.qualityEvidence?.answerPlayers);
    const base = (answerBand(anchorAnswers) !== answerBand(candidateAnswers) ? 3 : 0)
      + (String(anchor?.difficulty || "") !== String(candidate?.difficulty || "") ? 2 : 0)
      + (anchorAnswers && Math.abs(anchorAnswers - candidateAnswers) >= Math.max(3, Math.ceil(anchorAnswers * 0.2)) ? 2 : 0)
      + (Math.abs(n(anchor?.qualityScore) - n(candidate?.qualityScore)) >= 10 ? 1 : 0);
    const vector = conditionDistance(anchor, candidate);
    return base + (vector >= 6 ? 4 : vector >= 3 ? 2 : vector > 0 ? 1 : 0);
  }

  function redundancyScore(anchor, candidate) {
    if (nestedEquivalent(anchor, candidate)) return 100;
    const aa = n(anchor?.qualityEvidence?.answerPlayers), ca = n(candidate?.qualityEvidence?.answerPlayers);
    const relative = aa ? Math.abs(aa - ca) / aa : 1;
    let value = 0;
    if (String(anchor?.difficulty || "") === String(candidate?.difficulty || "")) value += 4;
    if (answerBand(aa) === answerBand(ca)) value += 4;
    value += relative <= 0.1 ? 4 : relative <= 0.2 ? 2 : 0;
    const vector = conditionDistance(anchor, candidate);
    value += vector === 0 ? 4 : vector <= 2 ? 3 : vector <= 4 ? 1 : 0;
    if (Math.abs(n(anchor?.qualityScore) - n(candidate?.qualityScore)) <= 5) value += 2;
    return value;
  }

  function familyMetric(family, records) {
    const local = new Map();
    for (const record of records) { const group = groupOf(record); if (!local.has(group)) local.set(group, []); local.get(group).push(record); }
    const sizes = [...local.values()].map(recordsInGroup => recordsInGroup.length).sort((a, b) => a - b);
    const effectiveTarget = Math.min(records.length, TARGETS[family]);
    return {
      family, prompts: records.length, target: TARGETS[family], effectiveTarget,
      targetCompressionPct: round(100 - pct(effectiveTarget, records.length)),
      variantGroups: local.size, promptsPerGroup: round(records.length / Math.max(1, local.size)),
      groupMedian: round(quantile(sizes, 0.5), 1), groupP90: round(quantile(sizes, 0.9), 1), groupMax: sizes.at(-1) || 0,
      positions: countBy(records, record => String(record?.position || "OTHER"), ["ANY","GK","DEF","MID","FWD","OTHER"]),
      difficulties: countBy(records, record => ["easy","medium","hard"].includes(String(record?.difficulty || "").toLowerCase()) ? String(record.difficulty).toLowerCase() : "unknown", ["easy","medium","hard","unknown"]),
      answerBands: countBy(records, record => answerBand(n(record?.qualityEvidence?.answerPlayers)), ANSWER_BANDS)
    };
  }

  function entityKey(record) {
    const parts = [];
    for (const condition of record?.conditions || []) {
      const field = fieldOf(condition);
      if (ENTITY_FIELDS.has(field) && condition?.value != null) parts.push(`${field}:${String(condition.value)}`);
    }
    return parts.sort().join("|") || `position:${String(record?.position || "ANY")}`;
  }

  function triadFor(group, members) {
    if (members.length < 3) return null;
    const ordered = [...members].sort(compare), anchor = ordered[0], siblings = ordered.slice(1);
    const rescuePool = siblings.filter(record => !nestedEquivalent(anchor, record) && n(record?.qualityScore) >= 45 && n(record?.qualityEvidence?.answerPlayers) >= 3)
      .sort((a, b) => materialDistance(anchor, b) - materialDistance(anchor, a) || conditionDistance(anchor, b) - conditionDistance(anchor, a) || compare(a, b));
    const rescue = rescuePool[0];
    if (!rescue) return null;
    const rejectPool = siblings.filter(record => record.id !== rescue.id)
      .sort((a, b) => redundancyScore(anchor, b) - redundancyScore(anchor, a) || conditionDistance(anchor, a) - conditionDistance(anchor, b) || compare(a, b));
    const reject = rejectPool[0];
    if (!reject) return null;
    return {
      group, members: ordered, anchor, rescue, reject,
      entityKey: entityKey(anchor), position: String(anchor?.position || "ANY"),
      baseScore: score(anchor) + Math.min(200, members.length) + materialDistance(anchor, rescue) * 20 + redundancyScore(anchor, reject) * 5
    };
  }

  function triadQuotas(familyRows) {
    const smallest = new Set([...familyRows].sort((a, b) => a.prompts - b.prompts || a.family.localeCompare(b.family)).slice(0, 3).map(row => row.family));
    return Object.fromEntries(FAMILIES.map(family => [family, smallest.has(family) ? 2 : 3]));
  }

  function chooseFamilyTriads(family, records, groups, quota) {
    const localGroups = new Map();
    for (const record of records) { const group = groupOf(record); if (!localGroups.has(group)) localGroups.set(group, groups.get(group) || []); }
    const candidates = [...localGroups].map(([group, members]) => triadFor(group, members)).filter(Boolean);
    const picked = [], usedGroups = new Set(), entityCounts = new Map(), positionCounts = new Map();
    while (picked.length < quota) {
      let best = null, bestScore = -Infinity;
      for (const candidate of candidates) {
        if (usedGroups.has(candidate.group)) continue;
        const entityCount = entityCounts.get(candidate.entityKey) || 0, positionCount = positionCounts.get(candidate.position) || 0;
        const diversityBonus = (entityCount === 0 ? 500 : -entityCount * 120) + (positionCount === 0 ? 100 : -positionCount * 20);
        const candidateScore = candidate.baseScore + diversityBonus;
        if (candidateScore > bestScore || (candidateScore === bestScore && candidate.group.localeCompare(best?.group || "") < 0)) { best = candidate; bestScore = candidateScore; }
      }
      if (!best) break;
      picked.push(best); usedGroups.add(best.group);
      entityCounts.set(best.entityKey, (entityCounts.get(best.entityKey) || 0) + 1);
      positionCounts.set(best.position, (positionCounts.get(best.position) || 0) + 1);
    }
    if (picked.length !== quota) throw new Error(`Could not build ${quota} same-group curation triads for ${family}; only ${picked.length} were available.`);
    return picked;
  }

  function reviewBatch(index, familyRows) {
    const quotas = triadQuotas(familyRows), rows = [], familyQuotas = {};
    let triadIndex = 0;
    for (const family of FAMILIES) {
      const quota = quotas[family], triads = chooseFamilyTriads(family, index.byFamily.get(family) || [], index.groups, quota);
      familyQuotas[family] = { triads: quota, CERTIFY: quota, RESCUE: quota, REJECT: quota };
      for (const triad of triads) {
        triadIndex += 1;
        const anchorId = String(triad.anchor?.id || "");
        const entries = [
          ["CERTIFY", "anchor", triad.anchor, 0, 0, false, "Group anchor; strongest representative shown beside its comparison siblings."],
          ["RESCUE", "material-contrast", triad.rescue, materialDistance(triad.anchor, triad.rescue), redundancyScore(triad.anchor, triad.rescue), nestedEquivalent(triad.anchor, triad.rescue), "Same-group sibling selected for a materially different difficulty, answer pool or threshold vector."],
          ["REJECT", "redundant-sibling", triad.reject, materialDistance(triad.anchor, triad.reject), redundancyScore(triad.anchor, triad.reject), nestedEquivalent(triad.anchor, triad.reject), nestedEquivalent(triad.anchor, triad.reject) ? "Monotonic sibling with the same answer count; nested answer set is equivalent." : "Same-group sibling selected as the closest redundancy challenge to the anchor."]
        ];
        for (const [decision, role, record, distance, redundancy, nested, rationale] of entries) {
          rows.push({
            reviewIndex: 0, triadIndex, triadId: `triad_${String(triadIndex).padStart(2, "0")}`, triadRole: role, anchorId,
            proposedDecision: decision, family, id: String(record?.id || ""), label: String(record?.label || ""),
            position: String(record?.position || ""), difficulty: String(record?.difficulty || "unknown"), qualityScore: n(record?.qualityScore),
            answerPlayers: n(record?.qualityEvidence?.answerPlayers), seasons: n(record?.qualityEvidence?.seasons), clubs: n(record?.qualityEvidence?.clubs), coverage: n(record?.qualityEvidence?.coverage),
            variantGroup: triad.group, variantGroupSize: triad.members.length, siblingRank: triad.members.findIndex(item => item.id === record.id) + 1,
            materialDistance: distance, conditionDistance: conditionDistance(triad.anchor, record), redundancyScore: redundancy, nestedEquivalent: nested,
            entityKey: triad.entityKey, conditions: record?.conditions || [], rationale
          });
        }
      }
    }
    rows.sort((a, b) => FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || a.triadIndex - b.triadIndex || DECISIONS.indexOf(a.proposedDecision) - DECISIONS.indexOf(b.proposedDecision));
    rows.forEach((row, indexValue) => { row.reviewIndex = indexValue + 1; });
    const decisionCounts = countBy(rows, row => row.proposedDecision, DECISIONS);
    if (triadIndex !== 48 || rows.length !== 144 || DECISIONS.some(decision => decisionCounts[decision] !== 48)) throw new Error(`Review batch invariant failed: ${triadIndex} triads / ${rows.length} records / ${JSON.stringify(decisionCounts)}.`);
    return { structure: "48-same-group-triads", triadCount: triadIndex, records: rows, familyQuotas, decisionCounts };
  }

  function buildReviewPayloadFromPackage(payload) {
    const index = inspect(payload);
    for (const members of index.groups.values()) members.sort(compare);
    const families = FAMILIES.map(family => familyMetric(family, index.byFamily.get(family) || []));
    const sizes = [...index.groups.values()].map(records => records.length).sort((a, b) => a - b);
    const buckets = Object.fromEntries(SIZE_BANDS.map(([key]) => [key, 0]));
    for (const size of sizes) buckets[sizeBand(size)] += 1;
    const ceilingTarget = Object.values(TARGETS).reduce((sum, value) => sum + value, 0);
    const effectiveTargets = Object.fromEntries(families.map(row => [row.family, row.effectiveTarget]));
    const effectiveTarget = Object.values(effectiveTargets).reduce((sum, value) => sum + value, 0);
    const top = [...families].sort((a, b) => b.prompts - a.prompts || a.family.localeCompare(b.family));
    const batch = reviewBatch(index, families);
    return {
      schemaVersion: 2, kind: "fpl-prompt-curation-review-batch", exportVersion: VERSION, generatedAt: new Date().toISOString(),
      source: {
        promotionFingerprint: String(payload.manifest.promotionFingerprint || ""), total: n(payload.manifest.total), families: n(payload.manifest.families), variantGroups: n(payload.manifest.variantGroups),
        qualityPass: n(payload.manifest.qualityPass), qualityReview: n(payload.manifest.qualityReview), savedAt: String(payload.manifest.savedAt || "")
      },
      policy: {
        survivorTargets: TARGETS, effectiveSurvivorTargets: effectiveTargets, survivorTargetCeilingTotal: ceilingTarget, survivorTargetTotal: effectiveTarget,
        variantGroupPolicy: "semantic-shape-with-material-cells", defaultVariantGroupTarget: null, hardVariantGroupCap: null, materialCellCap: 1,
        reviewBatchSize: 144, reviewTriads: 48, reviewRecordsPerTriad: 3, reviewDecisionTargets: { CERTIFY: 48, RESCUE: 48, REJECT: 48 }
      },
      audit: {
        compression: {
          sourcePrompts: index.records.length, variantGroups: index.groups.size, averagePromptsPerGroup: round(index.records.length / Math.max(1, index.groups.size)),
          medianGroupSize: round(quantile(sizes, 0.5), 1), p90GroupSize: round(quantile(sizes, 0.9), 1), p95GroupSize: round(quantile(sizes, 0.95), 1), p99GroupSize: round(quantile(sizes, 0.99), 1), maxGroupSize: sizes.at(-1) || 0,
          groupBuckets: buckets, capOne: index.groups.size, capTwo: sizes.reduce((sum, size) => sum + Math.min(2, size), 0), capThree: sizes.reduce((sum, size) => sum + Math.min(3, size), 0),
          survivorTargetCeiling: ceilingTarget, survivorTarget: effectiveTarget, survivorTargetPerGroup: round(effectiveTarget / Math.max(1, index.groups.size)), survivorCompressionPct: round(100 - pct(effectiveTarget, index.records.length))
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
    return buildReviewPayloadFromPackage(await shards.buildRepositoryPackage());
  }

  async function downloadReviewExport() {
    if (state.busy) return false;
    state.busy = true; state.lastError = ""; render();
    try {
      const payload = await buildReviewExport(); state.lastPayload = payload;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = `fpl-prompt-curation-review-144-triads-${payload.source.promotionFingerprint || "snapshot"}.json`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 0); return true;
    } catch (error) { state.lastError = String(error?.message || error); return false; }
    finally { state.busy = false; render(); }
  }

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot"); if (!root) return false;
    let mount = document.getElementById("promptCurationReviewExportMount");
    if (!mount) {
      mount = document.createElement("div"); mount.id = "promptCurationReviewExportMount"; mount.dataset.promptCurationReviewExport = "v1";
      const shardsMount = document.getElementById("promptLibraryShardsMount"), roadmap = root.querySelector(".prompt-clean-roadmap");
      if (shardsMount?.parentNode === root) shardsMount.insertAdjacentElement("afterend", mount); else if (roadmap) root.insertBefore(mount, roadmap); else root.appendChild(mount);
    }
    render(); return true;
  }

  function render() {
    const mount = document.getElementById("promptCurationReviewExportMount"); if (!mount) return false;
    const manifest = window.FPL_PROMPT_LIBRARY_SHARDS_V1?.getSavedManifest?.(), available = Boolean(manifest?.total && manifest?.families === 17), last = state.lastPayload;
    mount.innerHTML = `<section class="prompt-library-shards" aria-labelledby="promptCurationReviewExportHeading">
      <div class="prompt-library-browser-head"><div><p class="eyebrow">Refinement Incubator · Phase 1</p><h3 id="promptCurationReviewExportHeading">Generate the paired 144-prompt curation review</h3><p>Exports 48 same-group triads. Every anchor is shown beside one material contrast and one redundant sibling, so CERTIFY / RESCUE / REJECT decisions are directly comparable.</p></div><span class="phase-chip">${VERSION}</span></div>
      <div class="prompt-shard-summary-grid">
        <div class="prompt-clean-status-card"><span>Saved prompts</span><strong>${Number(manifest?.total || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Families</span><strong>${Number(manifest?.families || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Variant groups</span><strong>${Number(manifest?.variantGroups || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Review export</span><strong>${last ? "48 triads ready" : "Not built"}</strong></div>
      </div>
      <div class="prompt-shard-actions"><button id="promptCurationReviewDownload" class="button" type="button"${available && !state.busy ? "" : " disabled"}>${state.busy ? "Building paired 144…" : "Generate & download paired 144"}</button><span id="promptCurationReviewStatus">${state.lastError ? `Curation export error: ${esc(state.lastError)}` : state.busy ? "Validating all saved shards and selecting 48 comparable triads…" : last ? `Ready: ${last.reviewBatch.triadCount} triads · ${last.reviewBatch.records.length} prompts · ${last.reviewBatch.decisionCounts.CERTIFY}/${last.reviewBatch.decisionCounts.RESCUE}/${last.reviewBatch.decisionCounts.REJECT}.` : available ? `Ready to read ${Number(manifest.total).toLocaleString("en-GB")} saved prompts without altering the source package.` : "Restore the saved Prompt Library snapshot above first."}</span></div>
      <div class="prompt-shard-boundary"><strong>Read-only boundary</strong><span>This does not alter Promotion, the saved source snapshot, Daily generation, publishing or the production-certified prompt pool. It only creates a paired calibration review file.</span></div>
    </section>`;
    document.getElementById("promptCurationReviewDownload")?.addEventListener("click", downloadReviewExport); return true;
  }

  function queueEnsure() { if (state.queued) return; state.queued = true; queueMicrotask(() => { state.queued = false; ensureMount(); }); }
  function observe() {
    if (state.observer) return;
    const workspace = document.getElementById("workspace-prompts") || document.querySelector('[data-workspace="prompts"]'); if (!workspace) return;
    state.observer = new MutationObserver(() => { if (!document.getElementById("promptCurationReviewExportMount")) queueEnsure(); });
    state.observer.observe(workspace, { childList: true, subtree: true });
  }
  function install() {
    ensureMount(); observe(); requestAnimationFrame(ensureMount); setTimeout(ensureMount, 220);
    window.addEventListener("fpl:prompt-studio-clean-ready", queueEnsure); window.addEventListener("fpl:prompt-studio-clean-rendered", queueEnsure);
    window.addEventListener("fpl:prompt-library-shards-ready", queueEnsure); window.addEventListener("fpl:prompt-library-shards-saved", render);
    window.addEventListener("fpl:prompt-library-shards-restored", render); window.addEventListener("fpl:prompt-library-shards-cleared", render);
    document.documentElement.dataset.promptCurationReviewExport = "v1";
    window.dispatchEvent(new CustomEvent("fpl:prompt-curation-review-export-ready", { detail: { version: VERSION } }));
  }

  window.FPL_PROMPT_CURATION_REVIEW_EXPORT_V1 = Object.freeze({ ready: true, version: VERSION, buildReviewPayloadFromPackage, buildReviewExport, downloadReviewExport, render });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})();