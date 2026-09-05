/* FPL Draft Challenge — Prompt Studio V4 simple generate → quality → library workflow v4.0.0.
   V4 is a fresh browser-only library. The frozen legacy production pool remains untouched.
   V3 stays hidden as a parser-safe candidate-generation engine only. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_V4?.ready) return;

  const VERSION = "4.0.0";
  const STORAGE_KEY = "fplPromptStudioV4Library";
  const MAX_BATCH = 50;
  const DEFAULT_BATCH = 20;
  const POSITIONS = Object.freeze(["GK", "DEF", "MID", "FWD"]);
  const RANGES = Object.freeze({
    ANY:{ narrow:12, idealLow:25, idealHigh:120, broad:220 },
    GK:{ narrow:5, idealLow:8, idealHigh:35, broad:70 },
    DEF:{ narrow:8, idealLow:18, idealHigh:90, broad:165 },
    MID:{ narrow:8, idealLow:18, idealHigh:90, broad:165 },
    FWD:{ narrow:6, idealLow:12, idealHigh:60, broad:110 }
  });
  const POLL_MS = 120;
  const FAMILY_TIMEOUT_MS = 180000;

  let installed = false;
  let running = false;
  let state = readState();

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const clone = value => JSON.parse(JSON.stringify(value));
  const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const normalise = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
  const pct = value => Math.round(clamp(Number(value) || 0,0,1) * 100);

  function emptyState() {
    return { schema:1, version:VERSION, prompts:[] };
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.schema !== 1 || !Array.isArray(parsed.prompts)) return emptyState();
      return {
        schema:1,
        version:VERSION,
        prompts:parsed.prompts.map(prompt => ({
          id:String(prompt?.id || ""),
          label:String(prompt?.label || ""),
          position:String(prompt?.position || "ANY"),
          difficulty:String(prompt?.difficulty || "medium"),
          family:String(prompt?.family || ""),
          enabled:prompt?.enabled !== false,
          rules:Array.isArray(prompt?.rules) ? prompt.rules : [],
          quality:prompt?.quality && typeof prompt.quality === "object" ? prompt.quality : null,
          createdAt:String(prompt?.createdAt || new Date().toISOString()),
          updatedAt:String(prompt?.updatedAt || prompt?.createdAt || new Date().toISOString()),
          disabledAt:prompt?.disabledAt ? String(prompt.disabledAt) : null
        })).filter(prompt => prompt.id && prompt.label)
      };
    } catch (_) {
      return emptyState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v4-changed", { detail:census() }));
  }

  function census() {
    const total = state.prompts.length;
    const enabled = state.prompts.filter(prompt => prompt.enabled).length;
    const disabled = total - enabled;
    const rated = state.prompts.filter(prompt => Number(prompt.quality?.rating) > 0);
    const average = rated.length ? rated.reduce((sum,prompt) => sum + Number(prompt.quality.rating || 0),0) / rated.length : 0;
    return Object.freeze({
      total, enabled, disabled,
      averageQuality:average,
      families:new Set(state.prompts.map(prompt => prompt.family).filter(Boolean)).size
    });
  }

  function deliberate() { return window.FPL_PROMPT_STUDIO_V3_CANDIDATE_GENERATOR || null; }
  function engine() { return window.ValidationEngine || null; }
  function players() { return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : []; }
  function familyRegistry() { return window.FPL_PROMPT_FAMILY_REGISTRY_V3?.families || []; }
  function hiddenV3Root() { return document.getElementById("promptStudioV3"); }

  function familyLabel(id) {
    return familyRegistry().find(item => item.id === id)?.name || id || "Unassigned";
  }

  function legacyProductionCount() {
    const value = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.getState?.();
    return value?.ready ? Number(value.total || 0) : 851;
  }

  function allEntries() {
    const rows = [];
    for (const player of players()) for (const record of player.seasons || []) rows.push({ player, season:record.season });
    return rows;
  }

  function existingKeys() {
    const ids = new Set();
    const labels = new Set();
    for (const prompt of state.prompts) {
      ids.add(prompt.id);
      labels.add(normalise(prompt.label));
    }
    return { ids, labels };
  }

  function familyCounts() {
    const counts = new Map();
    for (const prompt of state.prompts) counts.set(prompt.family,(counts.get(prompt.family) || 0) + 1);
    return counts;
  }

  function positionCounts() {
    const counts = new Map();
    for (const prompt of state.prompts) counts.set(prompt.position,(counts.get(prompt.position) || 0) + 1);
    return counts;
  }

  function comboPlan() {
    const supported = deliberate()?.supportedFamilies || [];
    const familyUse = familyCounts();
    const positionUse = positionCounts();
    const combos = [];
    for (const family of supported) for (const position of POSITIONS) {
      combos.push({
        family,
        position,
        score:(familyUse.get(family) || 0) * 8 + (positionUse.get(position) || 0) * 3 + Math.random()
      });
    }
    return combos.sort((left,right) => left.score - right.score);
  }

  function deliberateNodes() {
    const root = hiddenV3Root();
    const form = root?.querySelector("[data-v3-candidate-generator-form]");
    return {
      root,
      form,
      button:form?.querySelector("[data-v3-generate-candidates]") || null,
      status:root?.querySelector("[data-v3-candidate-status]") || null
    };
  }

  async function generateFamilyCandidates(settings) {
    const api = deliberate();
    const nodes = deliberateNodes();
    if (!api?.ready || !nodes.root || !nodes.form || !nodes.button) throw new Error("The parser-safe family generator is not ready yet.");

    nodes.form.elements.family.value = settings.family;
    nodes.form.elements.position.value = settings.position;
    nodes.form.elements.minAnswers.value = String(settings.minAnswers);
    nodes.form.elements.maxAnswers.value = String(settings.maxAnswers);
    nodes.form.elements.limit.value = String(settings.limit);

    const before = nodes.status?.textContent || "";
    nodes.form.requestSubmit();
    const started = Date.now();
    let sawRunning = nodes.button.disabled;

    while (Date.now() - started < FAMILY_TIMEOUT_MS) {
      if (nodes.button.disabled) sawRunning = true;
      const statusText = nodes.status?.textContent || "";
      if (sawRunning && !nodes.button.disabled) break;
      if (!sawRunning && statusText !== before && !/Testing candidate/i.test(statusText)) break;
      await delay(POLL_MS);
    }

    if (nodes.button.disabled) throw new Error(`Timed out while generating ${settings.family} prompts.`);
    return api.getCandidates?.() || [];
  }

  function overlap(leftIds,rightIds) {
    const left = new Set(leftIds || []);
    const right = new Set(rightIds || []);
    if (!left.size || !right.size) return 0;
    const smaller = left.size <= right.size ? left : right;
    const larger = smaller === left ? right : left;
    let common = 0;
    for (const id of smaller) if (larger.has(id)) common += 1;
    return common / smaller.size;
  }

  function maxShare(counts,total) {
    if (!total || !counts.size) return { value:0, key:"", count:0 };
    let key = "";
    let count = 0;
    for (const [candidate,value] of counts) if (value > count) { key = candidate; count = value; }
    return { value:count / total, key, count };
  }

  function compatiblePosition(left,right) {
    return left === "ANY" || right === "ANY" || left === right;
  }

  function qualityRating(score) {
    if (score >= 85) return 5;
    if (score >= 70) return 4;
    if (score >= 55) return 3;
    if (score >= 40) return 2;
    return 1;
  }

  async function analyseCandidate(candidate,onProgress) {
    const validation = engine();
    if (!validation?.evaluatePrompt) throw new Error("Validation Engine is not ready.");
    const rows = allEntries();
    const byPlayer = new Map();
    const seasonCounts = new Map();
    const clubCounts = new Map();
    const bigSix = new Set(validation.BIG_SIX || []);
    let runtimeErrors = 0;
    let zeroMinuteAccepted = 0;
    let index = 0;

    await new Promise(resolve => {
      const chunk = () => {
        const end = Math.min(index + 350, rows.length);
        for (; index < end; index += 1) {
          const entry = rows[index];
          let result;
          try { result = validation.evaluatePrompt(entry.player,entry.season,candidate.wording); }
          catch (_) { runtimeErrors += 1; continue; }
          if (!result?.ok) { runtimeErrors += 1; continue; }
          if (!result.passed) continue;
          if (!(Number(result.record?.minutes) > 0)) { zeroMinuteAccepted += 1; continue; }
          const current = byPlayer.get(entry.player.playerId);
          if (!current || Number(result.record?.points || 0) > Number(current.record?.points || 0)) byPlayer.set(entry.player.playerId,result);
        }
        onProgress?.(rows.length ? index / rows.length : 1);
        if (index < rows.length) window.setTimeout(chunk,0); else resolve();
      };
      chunk();
    });

    for (const result of byPlayer.values()) {
      const season = String(result.record?.season || "Unknown");
      const club = String(result.record?.club || "Unknown");
      seasonCounts.set(season,(seasonCounts.get(season) || 0) + 1);
      clubCounts.set(club,(clubCounts.get(club) || 0) + 1);
    }

    const ids = [...byPlayer.keys()];
    const total = ids.length;
    const topSeason = maxShare(seasonCounts,total);
    const topClub = maxShare(clubCounts,total);
    let bigSixCount = 0;
    for (const result of byPlayer.values()) if (bigSix.has(String(result.record?.club || ""))) bigSixCount += 1;
    const bigSixShare = total ? bigSixCount / total : 0;

    let highestOverlap = 0;
    let overlapPrompt = "";
    for (const existing of state.prompts) {
      if (!compatiblePosition(candidate.position,existing.position)) continue;
      const value = overlap(ids,existing.quality?.answerIds || []);
      if (value > highestOverlap) { highestOverlap = value; overlapPrompt = existing.label; }
    }

    let score = 100;
    const issues = [];
    const range = RANGES[candidate.position] || RANGES.ANY;

    if (runtimeErrors > 0) { score -= 60; issues.push(`${runtimeErrors} runtime error${runtimeErrors === 1 ? "" : "s"}.`); }
    if (zeroMinuteAccepted > 0) { score -= 60; issues.push(`${zeroMinuteAccepted} zero-minute answer${zeroMinuteAccepted === 1 ? "" : "s"} accepted.`); }
    if (total === 0) { score = 0; issues.push("No valid players."); }
    else if (total < range.narrow) { score -= 25; issues.push(`Very narrow answer pool (${total}).`); }
    else if (total < range.idealLow) { score -= 10; issues.push(`Narrow answer pool (${total}).`); }
    else if (total > range.broad) { score -= 25; issues.push(`Very broad answer pool (${total}).`); }
    else if (total > range.idealHigh) { score -= 10; issues.push(`Broad answer pool (${total}).`); }

    if (seasonCounts.size <= 1) { score -= 12; issues.push("Only one season represented."); }
    else if (seasonCounts.size <= 2) { score -= 6; issues.push("Low season variety."); }
    if (clubCounts.size <= 2) { score -= 15; issues.push("Very low club variety."); }
    else if (clubCounts.size <= 4) { score -= 7; issues.push("Low club variety."); }

    if (topClub.value >= 0.60) { score -= 18; issues.push(`${pct(topClub.value)}% of answers come from ${topClub.key}.`); }
    else if (topClub.value >= 0.45) { score -= 10; issues.push(`${pct(topClub.value)}% club concentration.`); }
    else if (topClub.value >= 0.35) { score -= 5; issues.push(`${pct(topClub.value)}% club concentration worth reviewing.`); }

    if (topSeason.value >= 0.50) { score -= 12; issues.push(`${pct(topSeason.value)}% of answers come from ${topSeason.key}.`); }
    else if (topSeason.value >= 0.35) { score -= 7; issues.push(`${pct(topSeason.value)}% season concentration.`); }

    if (bigSixShare >= 0.80) { score -= 15; issues.push(`${pct(bigSixShare)}% Big Six answers.`); }
    else if (bigSixShare >= 0.65) { score -= 8; issues.push(`${pct(bigSixShare)}% Big Six answers.`); }

    if (highestOverlap >= 0.90) { score -= 30; issues.push(`${pct(highestOverlap)}% overlap with an existing library prompt.`); }
    else if (highestOverlap >= 0.75) { score -= 18; issues.push(`${pct(highestOverlap)}% overlap with an existing library prompt.`); }
    else if (highestOverlap >= 0.60) { score -= 10; issues.push(`${pct(highestOverlap)}% overlap with an existing library prompt.`); }

    score = clamp(Math.round(score),0,100);
    const technicalPass = runtimeErrors === 0 && zeroMinuteAccepted === 0 && total > 0;
    const rating = technicalPass ? qualityRating(score) : 1;
    if (!issues.length) issues.push("No significant quality warning detected.");

    return {
      score,
      rating,
      technicalPass,
      playerCount:total,
      seasonCount:seasonCounts.size,
      clubCount:clubCounts.size,
      bigSixShare,
      topClub,
      topSeason,
      highestOverlap,
      overlapPrompt,
      runtimeErrors,
      zeroMinuteAccepted,
      issues,
      answerIds:ids,
      analysedAt:new Date().toISOString()
    };
  }

  function pickDiverse(pool,count) {
    const candidates = [...pool];
    const selected = [];
    const familyUse = familyCounts();
    const positionUse = positionCounts();
    const difficultyUse = new Map();
    while (selected.length < count && candidates.length) {
      let bestIndex = 0;
      let bestScore = Infinity;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const score = (familyUse.get(candidate.family) || 0) * 5
          + (positionUse.get(candidate.position) || 0) * 3
          + (difficultyUse.get(candidate.difficulty) || 0) * 2
          + Math.random();
        if (score < bestScore) { bestScore = score; bestIndex = index; }
      }
      const [candidate] = candidates.splice(bestIndex,1);
      selected.push(candidate);
      familyUse.set(candidate.family,(familyUse.get(candidate.family) || 0) + 1);
      positionUse.set(candidate.position,(positionUse.get(candidate.position) || 0) + 1);
      difficultyUse.set(candidate.difficulty,(difficultyUse.get(candidate.difficulty) || 0) + 1);
    }
    return selected;
  }

  async function generateBatch(root) {
    if (running) return;
    const form = root.querySelector("[data-v4-generate-form]");
    const status = root.querySelector("[data-v4-status]");
    const progress = root.querySelector("[data-v4-progress] i");
    const button = form?.querySelector("[data-v4-generate]");
    if (!form || !button) return;
    const requested = clamp(Number(form.elements.count.value || DEFAULT_BATCH),1,MAX_BATCH);
    if (!deliberate()?.ready || !engine()?.evaluatePrompt || !players().length) {
      status.textContent = "The player database and generation engine are still loading.";
      return;
    }

    running = true;
    button.disabled = true;
    progress.style.width = "0%";
    const seen = existingKeys();
    const pool = [];
    const combos = comboPlan();
    const desiredPool = requested + Math.max(8,Math.ceil(requested * 0.4));
    const maxAttempts = Math.min(combos.length,Math.max(8,Math.ceil(requested / 3) + 5));

    try {
      for (let attempt = 0; attempt < maxAttempts && pool.length < desiredPool; attempt += 1) {
        const combo = combos[attempt];
        status.textContent = `Creating candidates from ${familyLabel(combo.family)} · ${combo.position} (${attempt + 1}/${maxAttempts})…`;
        progress.style.width = `${Math.round((attempt / Math.max(1,maxAttempts)) * 45)}%`;
        const candidates = await generateFamilyCandidates({
          family:combo.family,
          position:combo.position,
          minAnswers:6,
          maxAnswers:100,
          limit:Math.max(5,Math.min(12,Math.ceil(requested / 4)))
        });
        for (const candidate of candidates) {
          const labelKey = normalise(candidate.wording);
          if (!candidate?.id || seen.ids.has(candidate.id) || seen.labels.has(labelKey)) continue;
          seen.ids.add(candidate.id);
          seen.labels.add(labelKey);
          pool.push(candidate);
        }
      }

      const selected = pickDiverse(pool,requested);
      if (!selected.length) {
        status.textContent = "No new prompts could be created without repeating the V4 library. Try again after more family recipes are available.";
        return;
      }

      let added = 0;
      for (let index = 0; index < selected.length; index += 1) {
        const candidate = selected[index];
        status.textContent = `Quality checking ${index + 1}/${selected.length}: ${candidate.wording}`;
        progress.style.width = `${45 + Math.round(((index + 0.2) / selected.length) * 55)}%`;
        const quality = await analyseCandidate(candidate,fraction => {
          progress.style.width = `${45 + Math.round(((index + fraction) / selected.length) * 55)}%`;
        });
        const now = new Date().toISOString();
        state.prompts.push({
          id:candidate.id,
          label:candidate.wording,
          position:candidate.position,
          difficulty:candidate.difficulty,
          family:candidate.family,
          enabled:true,
          rules:Array.isArray(candidate.rules) ? clone(candidate.rules) : [],
          quality,
          createdAt:now,
          updatedAt:now,
          disabledAt:null
        });
        saveState();
        added += 1;
      }

      progress.style.width = "100%";
      status.textContent = `${added} new prompt${added === 1 ? "" : "s"} created, quality checked and added to the V4 library. Disable anything you do not want to keep enabled.`;
    } catch (error) {
      status.textContent = `Generation stopped: ${error?.message || error}`;
    } finally {
      running = false;
      button.disabled = false;
      render(root);
    }
  }

  function togglePrompt(id,enabled) {
    const prompt = state.prompts.find(item => item.id === id);
    if (!prompt) return;
    prompt.enabled = Boolean(enabled);
    prompt.updatedAt = new Date().toISOString();
    prompt.disabledAt = prompt.enabled ? null : prompt.updatedAt;
    saveState();
  }

  function bulkDisable(root) {
    const select = root.querySelector("[data-v4-disable-threshold]");
    const threshold = clamp(Number(select?.value || 2),1,5);
    const matching = state.prompts.filter(prompt => prompt.enabled && Number(prompt.quality?.rating || 0) <= threshold);
    if (!matching.length) return window.alert(`No enabled prompts are rated ${threshold}★ or below.`);
    if (!window.confirm(`Disable ${matching.length} prompt${matching.length === 1 ? "" : "s"} rated ${threshold}★ or below?\n\nThey will stay in the V4 library and continue blocking duplicates.`)) return;
    const now = new Date().toISOString();
    for (const prompt of matching) {
      prompt.enabled = false;
      prompt.updatedAt = now;
      prompt.disabledAt = now;
    }
    saveState();
    render(root);
  }

  function filteredPrompts(root) {
    const search = normalise(root.querySelector("[data-v4-search]")?.value || "");
    const status = root.querySelector("[data-v4-status-filter]")?.value || "all";
    const rating = root.querySelector("[data-v4-rating-filter]")?.value || "all";
    const family = root.querySelector("[data-v4-family-filter]")?.value || "all";
    const sort = root.querySelector("[data-v4-sort]")?.value || "quality-asc";
    let rows = state.prompts.filter(prompt => {
      if (search && !normalise(`${prompt.label} ${prompt.id} ${familyLabel(prompt.family)}`).includes(search)) return false;
      if (status === "enabled" && !prompt.enabled) return false;
      if (status === "disabled" && prompt.enabled) return false;
      if (rating !== "all" && Number(prompt.quality?.rating || 0) !== Number(rating)) return false;
      if (family !== "all" && prompt.family !== family) return false;
      return true;
    });
    rows = rows.sort((left,right) => {
      if (sort === "quality-desc") return Number(right.quality?.score || 0) - Number(left.quality?.score || 0);
      if (sort === "newest") return String(right.createdAt).localeCompare(String(left.createdAt));
      if (sort === "family") return familyLabel(left.family).localeCompare(familyLabel(right.family)) || left.label.localeCompare(right.label);
      return Number(left.quality?.score || 0) - Number(right.quality?.score || 0);
    });
    return rows;
  }

  function renderSummary(root) {
    const c = census();
    const host = root.querySelector("[data-v4-summary]");
    if (!host) return;
    host.innerHTML = [
      ["Total",c.total],["Enabled",c.enabled],["Disabled",c.disabled],["Average quality",c.averageQuality ? `${c.averageQuality.toFixed(1)}★` : "—"],["Families",c.families]
    ].map(([label,value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
  }

  function renderFamilyFilter(root) {
    const select = root.querySelector("[data-v4-family-filter]");
    if (!select) return;
    const current = select.value || "all";
    const used = [...new Set(state.prompts.map(prompt => prompt.family).filter(Boolean))].sort((a,b) => familyLabel(a).localeCompare(familyLabel(b)));
    select.innerHTML = `<option value="all">All families</option>${used.map(id => `<option value="${esc(id)}">${esc(familyLabel(id))}</option>`).join("")}`;
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function stars(rating) {
    const value = clamp(Number(rating || 0),0,5);
    return `${"★".repeat(value)}${"☆".repeat(5-value)}`;
  }

  function renderLibrary(root) {
    const host = root.querySelector("[data-v4-library]");
    const count = root.querySelector("[data-v4-library-count]");
    if (!host) return;
    const rows = filteredPrompts(root);
    if (count) count.textContent = `${rows.length} shown · ${state.prompts.length} remembered`;
    if (!rows.length) {
      host.innerHTML = '<div class="prompt-v4-empty">No prompts match the current filters. Generate a batch to start the new library.</div>';
      return;
    }
    host.innerHTML = rows.map(prompt => {
      const q = prompt.quality || {};
      const issues = Array.isArray(q.issues) ? q.issues : [];
      return `<article class="prompt-v4-row ${prompt.enabled ? "" : "disabled"}">
        <div class="prompt-v4-main">
          <div class="prompt-v4-title"><h4>${esc(prompt.label)}</h4><span class="prompt-v4-stars" title="${Number(q.score || 0)}/100">${stars(q.rating)}</span></div>
          <div class="prompt-v4-meta"><span>${esc(familyLabel(prompt.family))}</span><span>${esc(prompt.position)}</span><span>${esc(prompt.difficulty)}</span><span>${Number(q.playerCount || 0)} answers</span><span>${Number(q.seasonCount || 0)} seasons</span><span>${Number(q.clubCount || 0)} clubs</span><span>${Number(q.score || 0)}/100</span><span>${prompt.enabled ? "Enabled in V4" : "Disabled · remembered"}</span></div>
          <details><summary>${issues.length} quality note${issues.length === 1 ? "" : "s"}</summary><ul>${issues.map(issue => `<li>${esc(issue)}</li>`).join("")}</ul>${q.highestOverlap ? `<p>Highest overlap: ${pct(q.highestOverlap)}%${q.overlapPrompt ? ` with “${esc(q.overlapPrompt)}”` : ""}</p>` : ""}<p>Big Six share: ${pct(q.bigSixShare)}% · Technical: ${q.technicalPass ? "PASS" : "FAIL"}</p></details>
        </div>
        <button type="button" class="prompt-v4-toggle ${prompt.enabled ? "danger" : ""}" data-v4-toggle="${esc(prompt.id)}" data-v4-enable="${prompt.enabled ? "0" : "1"}">${prompt.enabled ? "Disable" : "Re-enable"}</button>
      </article>`;
    }).join("");
  }

  function render(root) {
    renderSummary(root);
    renderFamilyFilter(root);
    renderLibrary(root);
  }

  function installStyles() {
    if (document.getElementById("promptStudioV4Styles")) return;
    const style = document.createElement("style");
    style.id = "promptStudioV4Styles";
    style.textContent = `
      .prompt-v4{display:grid;gap:16px}.prompt-v4-hero,.prompt-v4-card{border:1px solid rgba(114,239,136,.2);border-radius:18px;background:rgba(5,24,17,.86);padding:17px}.prompt-v4-hero{display:grid;gap:10px}.prompt-v4-hero h2,.prompt-v4-hero p,.prompt-v4-card h3,.prompt-v4-card p{margin:0}.prompt-v4-badges{display:flex;flex-wrap:wrap;gap:7px}.prompt-v4-badge{padding:6px 9px;border-radius:999px;background:rgba(114,239,136,.08);border:1px solid rgba(114,239,136,.16);font-size:.76rem}
      .prompt-v4-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.prompt-v4-summary article{padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(5,20,14,.72)}.prompt-v4-summary span{display:block;color:#9eb4a7;font-size:.72rem}.prompt-v4-summary strong{font-size:1.35rem}
      .prompt-v4-generator{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end;margin-top:13px}.prompt-v4-generator label{display:grid;gap:6px;max-width:260px;font-size:.8rem}.prompt-v4-generator input,.prompt-v4-toolbar input,.prompt-v4-toolbar select,.prompt-v4-bulk select{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#06150d;color:#f2fff6}.prompt-v4-button,.prompt-v4-toggle{padding:10px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#0d281a;color:#effff4}.prompt-v4-button.primary{background:#72ef88;color:#07150f;font-weight:800}.prompt-v4-toggle.danger{border-color:rgba(255,109,130,.45);color:#ff9bad}.prompt-v4-button:disabled{opacity:.45}.prompt-v4-progress{height:8px;margin-top:12px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,.08)}.prompt-v4-progress i{display:block;width:0;height:100%;background:#72ef88;transition:width .15s linear}.prompt-v4-status{margin-top:9px!important;color:#b8cabf}
      .prompt-v4-toolbar{display:grid;grid-template-columns:1.5fr .8fr .8fr 1fr 1fr;gap:8px;margin:13px 0}.prompt-v4-toolbar label,.prompt-v4-bulk label{display:grid;gap:5px;font-size:.75rem}.prompt-v4-bulk{display:flex;gap:8px;align-items:end;margin-bottom:12px}.prompt-v4-bulk label{min-width:220px}.prompt-v4-library{display:grid;gap:8px}.prompt-v4-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:12px}.prompt-v4-row.disabled{opacity:.67}.prompt-v4-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.prompt-v4-title h4{margin:0}.prompt-v4-stars{white-space:nowrap;color:#ffd56a}.prompt-v4-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.prompt-v4-meta span{padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.055);font-size:.7rem}.prompt-v4-row details{margin-top:8px;color:#b7c8be;font-size:.78rem}.prompt-v4-row details ul{margin:6px 0 0 18px;padding:0}.prompt-v4-empty{padding:24px;text-align:center;border:1px dashed rgba(255,255,255,.16);border-radius:13px;color:#9eb4a7}.prompt-v4-count{color:#9eb4a7;font-size:.78rem}
      @media(max-width:900px){.prompt-v4-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.prompt-v4-generator{grid-template-columns:1fr}.prompt-v4-toolbar{grid-template-columns:1fr 1fr}.prompt-v4-toolbar label:first-child{grid-column:1/-1}.prompt-v4-row{grid-template-columns:1fr}.prompt-v4-title{display:grid}.prompt-v4-bulk{display:grid}}
    `;
    document.head.appendChild(style);
  }

  function createRoot() {
    const root = document.createElement("section");
    root.id = "promptStudioV4";
    root.className = "prompt-v4";
    root.innerHTML = `
      <div class="prompt-v4-hero">
        <div><p class="eyebrow">Fresh rebuild</p><h2>Prompt Studio</h2><p>Choose how many prompts you want. The Studio creates them across the prompt families, quality-checks them automatically and adds them straight to this new library. Disable anything you do not want; disabled prompts stay remembered so they are not made again.</p></div>
        <div class="prompt-v4-badges"><span class="prompt-v4-badge">New V4 library</span><span class="prompt-v4-badge">Automatic quality checks</span><span class="prompt-v4-badge">Disabled prompts block duplicates</span><span class="prompt-v4-badge">Live production unchanged: ${legacyProductionCount()} prompts</span></div>
      </div>
      <div class="prompt-v4-summary" data-v4-summary></div>
      <section class="prompt-v4-card">
        <h3>Generate prompts</h3>
        <p>Generation automatically balances the currently supported families, positions and difficulty levels. Every new prompt is checked before it enters the library.</p>
        <form class="prompt-v4-generator" data-v4-generate-form>
          <label>How many prompts?<input name="count" type="number" min="1" max="${MAX_BATCH}" value="${DEFAULT_BATCH}"></label>
          <button class="prompt-v4-button primary" type="submit" data-v4-generate>Generate and quality-check</button>
        </form>
        <div class="prompt-v4-progress" data-v4-progress><i></i></div>
        <p class="prompt-v4-status" data-v4-status>Ready. Nothing is added until you press Generate.</p>
      </section>
      <section class="prompt-v4-card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:end"><div><h3>Prompt library</h3><p>Enabled/disabled here is V4 library status only. It does not change the current live game.</p></div><span class="prompt-v4-count" data-v4-library-count></span></div>
        <div class="prompt-v4-toolbar">
          <label>Search<input type="search" data-v4-search placeholder="Prompt, family or ID"></label>
          <label>Status<select data-v4-status-filter><option value="all">All</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
          <label>Quality<select data-v4-rating-filter><option value="all">All ratings</option><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option><option value="2">2★</option><option value="1">1★</option></select></label>
          <label>Family<select data-v4-family-filter><option value="all">All families</option></select></label>
          <label>Sort<select data-v4-sort><option value="quality-asc">Lowest quality first</option><option value="quality-desc">Highest quality first</option><option value="newest">Newest first</option><option value="family">Family</option></select></label>
        </div>
        <div class="prompt-v4-bulk"><label>Bulk disable<select data-v4-disable-threshold><option value="1">1★ only</option><option value="2" selected>2★ and below</option><option value="3">3★ and below</option></select></label><button type="button" class="prompt-v4-button" data-v4-bulk-disable>Disable matching</button></div>
        <div class="prompt-v4-library" data-v4-library></div>
      </section>
    `;
    return root;
  }

  function bind(root) {
    root.querySelector("[data-v4-generate-form]").addEventListener("submit",event => {
      event.preventDefault();
      generateBatch(root);
    });
    root.addEventListener("click",event => {
      const toggle = event.target.closest("[data-v4-toggle]");
      if (toggle) {
        togglePrompt(toggle.dataset.v4Toggle,toggle.dataset.v4Enable === "1");
        render(root);
        return;
      }
      if (event.target.closest("[data-v4-bulk-disable]")) bulkDisable(root);
    });
    root.querySelectorAll("[data-v4-search],[data-v4-status-filter],[data-v4-rating-filter],[data-v4-family-filter],[data-v4-sort]").forEach(node => {
      node.addEventListener("input",() => renderLibrary(root));
      node.addEventListener("change",() => renderLibrary(root));
    });
    window.addEventListener("fpl:prompt-studio-v4-changed",() => render(root));
  }

  function install() {
    if (installed) return true;
    const workspace = document.getElementById("workspace-prompts");
    const v3Root = hiddenV3Root();
    if (!workspace || !v3Root || !deliberate()?.ready) return false;
    if (document.getElementById("promptStudioV4")) { installed = true; return true; }
    installStyles();
    v3Root.hidden = true;
    v3Root.setAttribute("aria-hidden","true");
    v3Root.dataset.v4EngineOnly = "true";
    const root = createRoot();
    workspace.appendChild(root);
    bind(root);
    render(root);
    installed = true;
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v4-ready",{ detail:{ version:VERSION, storageKey:STORAGE_KEY } }));
    return true;
  }

  window.FPL_PROMPT_STUDIO_V4 = Object.freeze({
    ready:true,
    version:VERSION,
    storageKey:STORAGE_KEY,
    install,
    getState:() => clone(state),
    getCensus:census
  });

  const boot = () => {
    if (install()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (install() || attempts > 160) window.clearInterval(timer);
    },100);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot,{ once:true }); else boot();
})();
