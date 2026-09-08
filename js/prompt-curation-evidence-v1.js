/* FPL Draft Challenge — Prompt Curation Evidence v1.0.0
   Read-only full-library evidence engine. Evaluates the durable promoted shard package against
   positive-minute player-season rows, measures per-condition marginality, fingerprints exact
   answer sets and records nearest one-axis sibling overlap. It never writes Promotion or Daily. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_CURATION_EVIDENCE_V1?.ready) return;

  const VERSION = "1.0.0";
  const POSITION_ORDER = ["ANY", "GK", "DEF", "MID", "FWD"];
  const BIG_SIX = new Set(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"]);
  const NUMERIC_AXIS_OPERATORS = new Set(["gte", "gt", "lte", "lt", "eq"]);
  const state = { busy: false, progress: null, lastPayload: null, lastError: "", observer: null };

  const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
  const slug = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const fieldOf = condition => String(condition?.field || "").trim();
  const operatorOf = condition => String(condition?.operator ?? condition?.op ?? "").trim();
  const conditionKey = condition => JSON.stringify([fieldOf(condition), operatorOf(condition), condition?.value ?? null, condition?.value2 ?? null]);
  const groupOf = record => String(record?.variantGroup || "").trim() || `missing:${record?.family || ""}:${record?.position || "ANY"}:${JSON.stringify(record?.conditions || [])}`;
  const nextTurn = () => new Promise(resolve => setTimeout(resolve, 0));

  function canonicalCountry(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const aliases = {
      cote_d_ivoire: "Ivory Coast", ivory_coast: "Ivory Coast",
      korea_republic: "South Korea", republic_of_korea: "South Korea", south_korea: "South Korea",
      united_states: "USA", united_states_of_america: "USA", usa: "USA",
      republic_of_ireland: "Ireland", trinidad_tobago: "Trinidad and Tobago",
      bosnia_and_herzegovina: "Bosnia-Herzegovina", czechia: "Czech Republic",
      democratic_republic_of_the_congo: "DR Congo", congo_dr: "DR Congo"
    };
    return aliases[slug(raw)] || raw.replace(/\s+/g, " ");
  }

  function numberValue(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function buildRows(players) {
    const rows = [], playerIds = [], playerIndex = new Map();
    for (const player of Array.isArray(players) ? players : []) {
      const eligible = (player?.seasons || []).filter(record => Number(record?.minutes) > 0);
      if (!eligible.length) continue;
      const id = String(player?.playerId || player?.id || "").trim();
      if (!id) continue;
      if (!playerIndex.has(id)) {
        playerIndex.set(id, playerIds.length);
        playerIds.push(id);
      }
      const pIndex = playerIndex.get(id);
      const careerSeasonCount = new Set(eligible.map(record => String(record?.season || "")).filter(Boolean)).size;
      const careerClubCount = new Set(eligible.map(record => String(record?.club || "")).filter(Boolean)).size;
      const nationality = canonicalCountry(player?.bio?.nationality);
      for (const record of eligible) rows.push({ playerId: id, playerIndex: pIndex, record, careerSeasonCount, careerClubCount, nationality });
    }
    return { rows, playerIds };
  }

  function fieldValue(row, field) {
    const record = row.record || {};
    if (field === "goalInvolvements") {
      const goals = numberValue(record.goals), assists = numberValue(record.assists);
      return goals == null || assists == null ? null : goals + assists;
    }
    if (field === "careerSeasonCount") return row.careerSeasonCount;
    if (field === "careerClubCount") return row.careerClubCount;
    if (field === "nationality") return row.nationality || null;
    if (field === "outsideBigSix") return record.club ? !BIG_SIX.has(record.club) : null;
    if (field === "champions") return typeof record.champions === "boolean" ? record.champions : numberValue(record.leaguePosition) === 1;
    if (field === "topFour") {
      if (typeof record.topFour === "boolean") return record.topFour;
      const finish = numberValue(record.leaguePosition);
      return finish == null ? null : finish >= 1 && finish <= 4;
    }
    if (field === "bottomHalf") return typeof record.bottomHalf === "boolean" ? record.bottomHalf : null;
    if (field === "relegated") return typeof record.relegated === "boolean" ? record.relegated : null;
    if (field === "promoted") return typeof record.promoted === "boolean" ? record.promoted : null;
    if (field === "manager") return Array.isArray(record.managers) ? record.managers : [];
    return record[field] ?? null;
  }

  function matches(row, condition) {
    const actual = fieldValue(row, fieldOf(condition));
    const operator = operatorOf(condition);
    if (operator === "isTrue") return actual === true;
    if (operator === "isFalse") return actual === false;
    if (operator === "eqText") return String(actual || "").trim().toLowerCase() === String(condition?.value || "").trim().toLowerCase();
    if (operator === "contains") return Array.isArray(actual) && actual.some(item => String(item).trim().toLowerCase() === String(condition?.value || "").trim().toLowerCase());
    const actualNumber = numberValue(actual), wanted = numberValue(condition?.value);
    if (actualNumber == null || wanted == null) return false;
    if (operator === "eq") return actualNumber === wanted;
    if (operator === "gte") return actualNumber >= wanted;
    if (operator === "lte") return actualNumber <= wanted;
    if (operator === "gt") return actualNumber > wanted;
    if (operator === "lt") return actualNumber < wanted;
    if (operator === "between") {
      const upper = numberValue(condition?.value2);
      return upper != null && actualNumber >= wanted && actualNumber <= upper;
    }
    return false;
  }

  const wordsFor = size => Math.ceil(size / 32);
  const bitSet = (bits, index) => { bits[index >>> 5] |= (1 << (index & 31)); };
  const cloneBits = bits => new Uint32Array(bits);
  const andInto = (target, other) => { for (let i = 0; i < target.length; i += 1) target[i] &= other[i]; return target; };
  const equalBits = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

  function popcount32(value) {
    let x = value >>> 0;
    x -= (x >>> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
  const countBits = bits => bits.reduce((sum, word) => sum + popcount32(word), 0);

  function answerFingerprint(bits, count = countBits(bits)) {
    let h1 = 0x811c9dc5 >>> 0, h2 = 0x9e3779b9 >>> 0;
    for (const raw of bits) {
      const word = raw >>> 0;
      h1 = Math.imul((h1 ^ word) >>> 0, 0x01000193) >>> 0;
      h2 ^= (word + 0x9e3779b9 + ((h2 << 6) >>> 0) + (h2 >>> 2)) >>> 0;
      h2 >>>= 0;
    }
    return `${count}:${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
  }

  function jaccardBits(a, b) {
    let intersection = 0, union = 0;
    for (let i = 0; i < a.length; i += 1) {
      intersection += popcount32(a[i] & b[i]);
      union += popcount32(a[i] | b[i]);
    }
    return union ? intersection / union : 1;
  }

  function createEvaluator(players) {
    const built = buildRows(players), rows = built.rows, playerIds = built.playerIds;
    if (!rows.length || !playerIds.length) throw new Error("No positive-minute player-season rows are available for curation evidence.");
    const rowWords = wordsFor(rows.length), playerWords = wordsFor(playerIds.length);
    const conditionCache = new Map(), positionMasks = new Map();

    for (const position of POSITION_ORDER) positionMasks.set(position, new Uint32Array(rowWords));
    rows.forEach((row, index) => {
      bitSet(positionMasks.get("ANY"), index);
      const position = String(row.record?.position || "");
      if (positionMasks.has(position)) bitSet(positionMasks.get(position), index);
    });

    function conditionBits(condition) {
      const key = conditionKey(condition);
      if (conditionCache.has(key)) return conditionCache.get(key);
      const bits = new Uint32Array(rowWords);
      for (let index = 0; index < rows.length; index += 1) if (matches(rows[index], condition)) bitSet(bits, index);
      conditionCache.set(key, bits);
      return bits;
    }

    function rowIntersection(record, omittedIndex = -1) {
      const position = POSITION_ORDER.includes(String(record?.position || "ANY")) ? String(record.position || "ANY") : "ANY";
      const result = cloneBits(positionMasks.get(position) || positionMasks.get("ANY"));
      (record?.conditions || []).forEach((condition, index) => {
        if (index === omittedIndex) return;
        andInto(result, conditionBits(condition));
      });
      return result;
    }

    function projectPlayers(rowBits) {
      const out = new Uint32Array(playerWords);
      for (let wordIndex = 0; wordIndex < rowBits.length; wordIndex += 1) {
        let word = rowBits[wordIndex] >>> 0;
        while (word) {
          const bit = 31 - Math.clz32(word & -word);
          const rowIndex = wordIndex * 32 + bit;
          if (rowIndex < rows.length) bitSet(out, rows[rowIndex].playerIndex);
          word = (word & (word - 1)) >>> 0;
        }
      }
      return out;
    }

    function evaluate(record) {
      const fullRows = rowIntersection(record), playerBits = projectPlayers(fullRows), answerPlayers = countBits(playerBits);
      const conditions = (record?.conditions || []).map((condition, index) => {
        const withoutBits = projectPlayers(rowIntersection(record, index));
        const withoutConditionPlayers = countBits(withoutBits);
        const addedPlayers = Math.max(0, withoutConditionPlayers - answerPlayers);
        return {
          index,
          field: fieldOf(condition),
          operator: operatorOf(condition),
          value: condition?.value ?? null,
          ...(condition?.value2 == null ? {} : { value2: condition.value2 }),
          withoutConditionPlayers,
          addedPlayers,
          marginalPctOfWithout: withoutConditionPlayers ? round(addedPlayers / withoutConditionPlayers * 100, 2) : 0,
          decorative: addedPlayers === 0
        };
      });
      const storedAnswerPlayers = n(record?.qualityEvidence?.answerPlayers, -1);
      const numericConditionCount = (record?.conditions || []).filter(condition => Number.isFinite(Number(condition?.value)) && NUMERIC_AXIS_OPERATORS.has(operatorOf(condition))).length;
      const added = conditions.map(item => item.addedPlayers);
      return {
        summary: {
          id: String(record?.id || ""),
          family: String(record?.family || ""),
          variantGroup: groupOf(record),
          position: String(record?.position || "ANY"),
          conditionCount: conditions.length,
          numericConditionCount,
          answerPlayers,
          storedAnswerPlayers,
          answerCountMatchesStored: storedAnswerPlayers < 0 ? null : storedAnswerPlayers === answerPlayers,
          answerFingerprint: answerFingerprint(playerBits, answerPlayers),
          conditionMarginality: conditions,
          decorativeConditionCount: conditions.filter(item => item.decorative).length,
          minConditionAddedPlayers: added.length ? Math.min(...added) : 0,
          exactEquivalentClassSize: 1,
          exactEquivalentRepresentativeId: String(record?.id || ""),
          exactEquivalentRank: 1,
          axisNeighbor: null
        },
        playerBits
      };
    }

    return {
      rows,
      playerIds,
      conditionCache,
      evaluate,
      compareEvaluated: (a, b) => ({
        jaccard: jaccardBits(a.playerBits, b.playerBits),
        identical: equalBits(a.playerBits, b.playerBits)
      })
    };
  }

  function conditionToken(condition) {
    return `${fieldOf(condition)}|${operatorOf(condition)}|${String(condition?.value ?? "")}|${String(condition?.value2 ?? "")}`;
  }

  function addExactEquivalence(evaluated) {
    const buckets = new Map();
    evaluated.forEach((item, index) => {
      const fingerprint = item.summary.answerFingerprint;
      if (!buckets.has(fingerprint)) buckets.set(fingerprint, []);
      buckets.get(fingerprint).push(index);
    });
    for (const indexes of buckets.values()) {
      const classes = [];
      for (const index of indexes) {
        const found = classes.find(group => equalBits(evaluated[group[0]].playerBits, evaluated[index].playerBits));
        if (found) found.push(index); else classes.push([index]);
      }
      for (const group of classes) {
        const ordered = [...group].sort((a, b) => evaluated[a].summary.id.localeCompare(evaluated[b].summary.id));
        const representative = evaluated[ordered[0]].summary.id;
        ordered.forEach((index, rank) => {
          evaluated[index].summary.exactEquivalentClassSize = ordered.length;
          evaluated[index].summary.exactEquivalentRepresentativeId = representative;
          evaluated[index].summary.exactEquivalentRank = rank + 1;
        });
      }
    }
  }

  function updateAxisNeighbor(item, sibling, conditionIndex, siblingConditionIndex) {
    const score = jaccardBits(item.playerBits, sibling.playerBits);
    const current = item.summary.axisNeighbor;
    if (current && current.jaccard > score) return;
    if (current && current.jaccard === score && String(current.id).localeCompare(sibling.summary.id) <= 0) return;
    item.summary.axisNeighbor = {
      id: sibling.summary.id,
      jaccard: round(score, 4),
      identicalAnswerSet: equalBits(item.playerBits, sibling.playerBits),
      conditionIndex,
      siblingConditionIndex
    };
  }

  function addAxisNeighbors(records, evaluated) {
    const buckets = new Map();
    records.forEach((record, recordIndex) => {
      const conditions = record?.conditions || [];
      conditions.forEach((condition, conditionIndex) => {
        const value = numberValue(condition?.value), operator = operatorOf(condition);
        if (value == null || !NUMERIC_AXIS_OPERATORS.has(operator)) return;
        const fixed = conditions.map((other, index) => index === conditionIndex ? null : conditionToken(other)).filter(Boolean).sort();
        const key = `${String(record?.position || "ANY")}::axis:${fieldOf(condition)}|${operator}::fixed:${fixed.join("&&")}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ recordIndex, conditionIndex, value });
      });
    });
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => a.value - b.value || records[a.recordIndex].id.localeCompare(records[b.recordIndex].id));
      for (let index = 1; index < bucket.length; index += 1) {
        const left = bucket[index - 1], right = bucket[index];
        updateAxisNeighbor(evaluated[left.recordIndex], evaluated[right.recordIndex], left.conditionIndex, right.conditionIndex);
        updateAxisNeighbor(evaluated[right.recordIndex], evaluated[left.recordIndex], right.conditionIndex, left.conditionIndex);
      }
    }
  }

  function validatePackage(payload) {
    if (payload?.kind !== "fpl-prompt-library-family-shards" || !payload?.manifest || !Array.isArray(payload?.shards)) throw new Error("Saved data is not a Prompt Library family-shard package.");
    const records = payload.shards.flatMap(shard => (Array.isArray(shard?.records) ? shard.records : []).map(record => ({ ...record, family: String(shard?.family || record?.family || "") })));
    if (n(payload.manifest.total, -1) !== records.length) throw new Error(`Saved shard manifest total ${payload.manifest.total} does not match ${records.length} records.`);
    return records;
  }

  async function analysePackage(payload, { players = window.FPL_PLAYERS, onProgress = null, yieldEveryGroups = 4 } = {}) {
    const records = validatePackage(payload), evaluator = createEvaluator(players);
    const groups = new Map();
    for (const record of records) {
      const group = groupOf(record);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(record);
    }
    const byId = new Map(), groupEntries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let processedPrompts = 0;
    for (let groupIndex = 0; groupIndex < groupEntries.length; groupIndex += 1) {
      const [, members] = groupEntries[groupIndex], evaluated = members.map(record => evaluator.evaluate(record));
      addExactEquivalence(evaluated);
      addAxisNeighbors(members, evaluated);
      evaluated.forEach(item => byId.set(item.summary.id, item.summary));
      processedPrompts += members.length;
      const progress = { group: groupIndex + 1, groups: groupEntries.length, prompts: processedPrompts, totalPrompts: records.length, atomicConditions: evaluator.conditionCache.size };
      onProgress?.(progress);
      if (yieldEveryGroups > 0 && (groupIndex + 1) % yieldEveryGroups === 0) await nextTurn();
    }

    const evidenceShards = payload.shards.map(shard => ({
      family: String(shard?.family || ""),
      count: Array.isArray(shard?.records) ? shard.records.length : 0,
      records: (shard?.records || []).map(record => byId.get(String(record?.id || ""))).filter(Boolean)
    }));
    const summaries = evidenceShards.flatMap(shard => shard.records);
    const mismatches = summaries.filter(item => item.answerCountMatchesStored === false);
    const decorative = summaries.filter(item => item.decorativeConditionCount > 0);
    const exactEquivalent = summaries.filter(item => item.exactEquivalentClassSize > 1);
    const highOverlap = summaries.filter(item => item.axisNeighbor && item.axisNeighbor.jaccard >= 0.95);
    return {
      schemaVersion: 1,
      kind: "fpl-prompt-curation-evidence",
      evidenceVersion: VERSION,
      generatedAt: new Date().toISOString(),
      source: {
        promotionFingerprint: String(payload?.manifest?.promotionFingerprint || ""),
        total: records.length,
        families: n(payload?.manifest?.families),
        variantGroups: groups.size,
        savedAt: payload?.manifest?.savedAt || null
      },
      population: { positiveMinuteRows: evaluator.rows.length, players: evaluator.playerIds.length, atomicConditions: evaluator.conditionCache.size },
      summary: {
        prompts: summaries.length,
        storedAnswerCountMismatches: mismatches.length,
        promptsWithDecorativeCondition: decorative.length,
        promptsWithExactEquivalentSibling: exactEquivalent.length,
        promptsWithAxisNeighborJaccard95Plus: highOverlap.length
      },
      evidenceShards
    };
  }

  async function runSavedPackage({ download = false } = {}) {
    if (state.busy) return state.lastPayload;
    const shards = window.FPL_PROMPT_LIBRARY_SHARDS_V1;
    if (!shards?.buildRepositoryPackage) throw new Error("Prompt Library shard storage is not ready yet.");
    state.busy = true; state.lastError = ""; state.progress = null; render();
    try {
      const packagePayload = await shards.buildRepositoryPackage();
      const payload = await analysePackage(packagePayload, {
        onProgress: progress => { state.progress = progress; if (progress.group % 8 === 0 || progress.group === progress.groups) render(); }
      });
      state.lastPayload = payload; state.progress = null;
      window.dispatchEvent(new CustomEvent("fpl:prompt-curation-evidence-ready", { detail: { version: VERSION, source: payload.source, summary: payload.summary } }));
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
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fpl-prompt-curation-evidence-${fingerprint}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    return true;
  }

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot");
    if (!root) return null;
    let mount = document.getElementById("promptCurationEvidenceMount");
    if (mount) return mount;
    mount = document.createElement("div");
    mount.id = "promptCurationEvidenceMount";
    mount.dataset.promptCurationEvidence = "v1";
    const review = document.getElementById("promptCurationReviewExportMount"), shards = document.getElementById("promptLibraryShardsMount"), roadmap = root.querySelector(".prompt-clean-roadmap");
    if (review) review.after(mount); else if (shards) shards.after(mount); else if (roadmap) roadmap.before(mount); else root.appendChild(mount);
    return mount;
  }

  function render() {
    const mount = ensureMount();
    if (!mount) return false;
    const manifest = window.FPL_PROMPT_LIBRARY_SHARDS_V1?.getSavedManifest?.();
    const available = Boolean(manifest?.total && manifest?.families === 17);
    const progress = state.progress;
    const progressText = progress ? `${progress.prompts.toLocaleString("en-GB")} / ${progress.totalPrompts.toLocaleString("en-GB")} prompts · ${progress.group.toLocaleString("en-GB")} / ${progress.groups.toLocaleString("en-GB")} groups · ${progress.atomicConditions.toLocaleString("en-GB")} atomic conditions cached` : "";
    const last = state.lastPayload;
    const summary = last ? `${last.summary.prompts.toLocaleString("en-GB")} measured · ${last.summary.promptsWithDecorativeCondition.toLocaleString("en-GB")} with a decorative condition · ${last.summary.promptsWithExactEquivalentSibling.toLocaleString("en-GB")} with an exact-equivalent sibling · ${last.summary.storedAnswerCountMismatches.toLocaleString("en-GB")} stored-count mismatches` : "No evidence scan has been run in this page yet.";
    mount.innerHTML = `<section class="prompt-library-shards" aria-labelledby="promptCurationEvidenceHeading">
      <div class="prompt-library-shards-head"><div><p class="eyebrow">Curation evidence</p><h3 id="promptCurationEvidenceHeading">Full-library evidence layer</h3><p>Measure all saved promoted prompts against the player database before survivor selection. This is read-only and does not alter Promotion, saved shards, Daily generation or publishing.</p></div><span class="phase-chip">v${esc(VERSION)}</span></div>
      <div class="prompt-library-shards-summary"><strong>${available ? `${n(manifest.total).toLocaleString("en-GB")} prompts ready` : "Saved library unavailable"}</strong><span>${esc(summary)}</span></div>
      <div class="button-row"><button id="promptCurationEvidenceRun" class="button primary" type="button" ${!available || state.busy ? "disabled" : ""}>${state.busy ? "Analysing full library…" : "Analyse full library"}</button><button id="promptCurationEvidenceDownload" class="button secondary" type="button" ${last && !state.busy ? "" : "disabled"}>Download evidence JSON</button></div>
      <p class="action-status" role="status">${esc(state.lastError || progressText || "Evidence includes exact answer fingerprints, per-condition marginal contribution and nearest one-axis sibling Jaccard overlap.")}</p>
    </section>`;
    mount.querySelector("#promptCurationEvidenceRun")?.addEventListener("click", () => runSavedPackage().catch(() => {}));
    mount.querySelector("#promptCurationEvidenceDownload")?.addEventListener("click", () => downloadPayload());
    return true;
  }

  function install() {
    render();
    window.addEventListener("fpl:prompt-studio-clean-rendered", render);
    window.addEventListener("fpl:prompt-studio-clean-ready", render);
    window.addEventListener("fpl:prompt-library-shards-saved", render);
    window.dispatchEvent(new CustomEvent("fpl:prompt-curation-evidence-installed", { detail: { version: VERSION } }));
  }

  window.FPL_PROMPT_CURATION_EVIDENCE_V1 = Object.freeze({
    ready: true,
    version: VERSION,
    createEvaluator,
    analysePackage,
    runSavedPackage,
    getLastPayload: () => state.lastPayload,
    downloadLast: () => downloadPayload(),
    render
  });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
  }
})();
