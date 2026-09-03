/* FPL Challenge Studio — Nationality Family Generator v1.1.1
   Uses bio.nationality when available and falls back to verified FPL regionId values.
   Generated prompt tests are self-contained player-id membership rules. */
(() => {
  "use strict";

  const STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const RANGES = {
    GK: { idealLow: 8, idealHigh: 35 },
    DEF: { idealLow: 18, idealHigh: 90 },
    MID: { idealLow: 18, idealHigh: 90 },
    FWD: { idealLow: 12, idealHigh: 60 }
  };
  const POINTS = {
    GK: [55, 70, 85, 100, 115],
    DEF: [65, 80, 95, 110, 125, 140],
    MID: [70, 85, 100, 115, 130, 145],
    FWD: [60, 75, 90, 105, 120, 135]
  };
  const BUDGETS = [4.5, 5, 5.5, 6, 6.5, 7];

  const REGIONS = Object.freeze([
    [241,"England"],[243,"Scotland"],[244,"Wales"],[242,"Northern Ireland"],[104,"Ireland"],
    [73,"France"],[80,"Germany"],[200,"Spain"],[173,"Portugal"],[152,"Netherlands"],[21,"Belgium"],
    [106,"Italy"],[58,"Denmark"],[161,"Norway"],[206,"Sweden"],[72,"Finland"],[99,"Iceland"],
    [172,"Poland"],[57,"Czech Republic"],[194,"Slovakia"],[195,"Slovenia"],[97,"Croatia"],
    [190,"Serbia"],[240,"Montenegro"],[27,"Bosnia-Herzegovina"],[83,"Greece"],[219,"Turkey"],
    [207,"Switzerland"],[14,"Austria"],[177,"Romania"],[34,"Bulgaria"],[225,"Ukraine"],[178,"Russia"],
    [30,"Brazil"],[10,"Argentina"],[230,"Uruguay"],[48,"Colombia"],[62,"Ecuador"],[44,"Chile"],
    [168,"Paraguay"],[169,"Peru"],[139,"Mexico"],[53,"Costa Rica"],[229,"USA"],[39,"Canada"],
    [107,"Jamaica"],[217,"Trinidad and Tobago"],[81,"Ghana"],[157,"Nigeria"],[38,"Cameroon"],
    [54,"Ivory Coast"],[189,"Senegal"],[132,"Mali"],[3,"Algeria"],[145,"Morocco"],[63,"Egypt"],
    [198,"South Africa"],[218,"Tunisia"],[50,"DR Congo"],[51,"Congo"],[77,"Gabon"],[89,"Guinea"],
    [78,"Gambia"],[111,"Kenya"],[108,"Japan"],[114,"South Korea"],[13,"Australia"],[154,"New Zealand"],[105,"Israel"]
  ]);
  const REGION_NAME = new Map(REGIONS.map(([id, name]) => [Number(id), name]));

  let installed = false;
  let currentBatch = [];
  let enrichmentReady = false;
  let enrichmentLoading = false;
  const enrichmentWaiters = [];

  const players = () => Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const library = () => { const api = window.FPL_STUDIO_API?.getPromptLibrary?.(); return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []); };
  const slug = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const hasNumber = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

  function canonicalCountry(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const key = slug(raw);
    const aliases = {
      cote_d_ivoire: "Ivory Coast", ivory_coast: "Ivory Coast",
      korea_republic: "South Korea", republic_of_korea: "South Korea", south_korea: "South Korea",
      united_states: "USA", united_states_of_america: "USA", usa: "USA",
      republic_of_ireland: "Ireland", ireland: "Ireland",
      trinidad_tobago: "Trinidad and Tobago", trinidad_and_tobago: "Trinidad and Tobago",
      bosnia_and_herzegovina: "Bosnia-Herzegovina", bosnia_herzegovina: "Bosnia-Herzegovina",
      czechia: "Czech Republic", czech_republic: "Czech Republic",
      democratic_republic_of_the_congo: "DR Congo", congo_dr: "DR Congo", dr_congo: "DR Congo"
    };
    return aliases[key] || raw.replace(/\s+/g, " ");
  }

  function countryForPlayer(player) {
    const stored = canonicalCountry(player?.bio?.nationality);
    if (stored) return stored;
    const regionId = player?.bio?.regionId;
    return hasNumber(regionId) ? (REGION_NAME.get(Number(regionId)) || "") : "";
  }

  function compile(source) {
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return null; }
  }

  function eligiblePlayer(player) {
    return (player?.seasons || []).some(record => Number(record?.minutes) > 0);
  }

  function coverage() {
    const eligible = players().filter(eligiblePlayer);
    const usable = eligible.filter(player => Boolean(countryForPlayer(player)));
    return {
      eligiblePlayers: eligible.length,
      withNationality: usable.length,
      missingNationality: eligible.length - usable.length,
      percentage: eligible.length ? Number((usable.length / eligible.length * 100).toFixed(1)) : 0,
      enrichedApplied: Number(window.FPL_NATIONALITY_ENRICHMENT?.applied || 0)
    };
  }

  function idsByCountry(position) {
    const map = new Map();
    for (const player of players()) {
      const country = countryForPlayer(player);
      if (!country) continue;
      if (!(player.seasons || []).some(record => record?.position === position && Number(record?.minutes) > 0)) continue;
      if (!map.has(country)) map.set(country, []);
      map.get(country).push(String(player.playerId));
    }
    return map;
  }

  function analyse(position, test) {
    const ids = new Set();
    let seasons = 0;
    for (const player of players()) {
      for (const record of player.seasons || []) {
        if (record?.position !== position || Number(record?.minutes) <= 0) continue;
        let passed = false;
        try { passed = Boolean(test(record)); } catch (_) {}
        if (!passed) continue;
        ids.add(player.playerId);
        seasons += 1;
      }
    }
    return { ids, playerCount: ids.size, seasonCount: seasons };
  }

  function overlap(left, right) {
    if (!left.size || !right.size) return 0;
    const smaller = left.size <= right.size ? left : right;
    const larger = smaller === left ? right : left;
    let common = 0;
    for (const id of smaller) if (larger.has(id)) common += 1;
    return common / smaller.size;
  }

  function difficulty(position, count) {
    if (position === "GK") return count <= 12 ? "hard" : count <= 25 ? "medium" : "easy";
    if (position === "FWD") return count <= 14 ? "hard" : count <= 35 ? "medium" : "easy";
    return count <= 20 ? "hard" : count <= 55 ? "medium" : "easy";
  }

  function candidate({ position, country, countrySlug, tail, label, fail, source, tags, novelty }) {
    const test = compile(source);
    if (!test) return null;
    const stats = analyse(position, test);
    const range = RANGES[position];
    if (!range || stats.playerCount < range.idealLow || stats.playerCount > range.idealHigh) return null;
    const midpoint = (range.idealLow + range.idealHigh) / 2;
    const score = 145 + novelty - Math.abs(stats.playerCount - midpoint) / Math.max(1, midpoint) * 24 - (country === "England" ? 4 : 0);
    return {
      id: `quality_factory_${position.toLowerCase()}_nationality_${countrySlug}_${tail}`,
      family: "quality-factory:nationality",
      position, label, fail, source, test, stats, score, country,
      difficulty: difficulty(position, stats.playerCount),
      tags: [...new Set(["auto-generated","quality-family","nationality",`country-${countrySlug}`,"approved-5-star",...tags])],
      rating: 5,
      cooldown: Math.max(0, Math.min(50, Number(document.getElementById("factoryCooldown")?.value) || 10)),
      enabled: document.getElementById("factoryEnablePrompts")?.checked !== false
    };
  }

  function addNationalityCandidates(position, out) {
    const lower = LOWER[position];
    const rawMinimum = RANGES[position]?.idealLow || 1;
    const countries = [...idsByCountry(position).entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [country, ids] of countries) {
      if (ids.length < rawMinimum) continue;
      const countrySlug = slug(country);
      const membership = `${JSON.stringify(ids)}.includes(String(p._career?.playerId))`;

      for (const points of POINTS[position]) {
        out.push(candidate({
          position, country, countrySlug, tail: `points_${points}`,
          label: `${country} ${lower} with ${points}+ FPL points`,
          fail: `That ${lower} must be from ${country} and score at least ${points} FPL points in the qualifying season.`,
          source: `p => (${membership} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,
          tags: ["nationality-points","points"], novelty: 18
        }));
      }

      for (const budget of BUDGETS) {
        out.push(candidate({
          position, country, countrySlug, tail: `budget_${String(budget).replace(".","_")}`,
          label: `${country} ${lower} who started at £${budget.toFixed(1)}m or less`,
          fail: `That ${lower} must be from ${country} and have a recorded starting price of £${budget.toFixed(1)}m or less.`,
          source: `p => (${membership} && p.startingPrice !== null && p.startingPrice !== undefined && p.startingPrice !== "" && Number.isFinite(Number(p.startingPrice)) && Number(p.startingPrice) <= ${budget} && Number(p.minutes) > 0)`,
          tags: ["nationality-budget","budget","starting-price"], novelty: 20
        }));
      }

      for (const points of POINTS[position].slice(0, 4)) {
        out.push(candidate({
          position, country, countrySlug, tail: `bottom_half_points_${points}`,
          label: `${country} ${lower} from a bottom-half club with ${points}+ FPL points`,
          fail: `That ${lower} must be from ${country}, play for a bottom-half club and score at least ${points} FPL points.`,
          source: `p => (${membership} && p.bottomHalf === true && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,
          tags: ["nationality-bottom-half","bottom-half","points","anti-meta"], novelty: 24
        }));
      }
    }
  }

  function buildBatch() {
    const requested = Math.max(1, Math.min(50, Math.round(Number(document.getElementById("factoryPromptCount")?.value) || 20)));
    const positionValue = document.getElementById("factoryPositionMix")?.value || "balanced";
    const difficultyValue = document.getElementById("factoryDifficultyMix")?.value || "balanced";
    const positions = POSITIONS.includes(positionValue) ? [positionValue] : POSITIONS;
    const existingIds = new Set(library().map(prompt => String(prompt?.id || "")));
    const existingLabels = new Set(library().map(prompt => String(prompt?.label || "").trim().toLowerCase()));
    const candidates = [];

    for (const position of positions) {
      const positionCandidates = [];
      addNationalityCandidates(position, positionCandidates);
      for (const item of positionCandidates.filter(Boolean)) {
        if (existingIds.has(item.id) || existingLabels.has(item.label.trim().toLowerCase())) continue;
        if (difficultyValue !== "balanced" && item.difficulty !== difficultyValue) continue;
        candidates.push(item);
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const chosen = [];
    while (chosen.length < requested && candidates.length) {
      let bestIndex = -1;
      let bestValue = -Infinity;
      for (let index = 0; index < candidates.length; index += 1) {
        const item = candidates[index];
        if (chosen.some(other => other.position === item.position && overlap(other.stats.ids, item.stats.ids) >= 0.86)) continue;
        const posUsed = chosen.filter(other => other.position === item.position).length;
        const countryUsed = chosen.filter(other => other.country === item.country).length;
        const value = item.score - posUsed * (positions.length > 1 ? 7 : 0) - countryUsed * 18;
        if (value > bestValue) { bestValue = value; bestIndex = index; }
      }
      if (bestIndex < 0) break;
      chosen.push(candidates.splice(bestIndex, 1)[0]);
    }
    return chosen;
  }

  function serialise(item) {
    return {
      id: item.id, family: item.family, position: item.position, label: item.label, fail: item.fail,
      difficulty: item.difficulty, tags: item.tags, rating: 5, cooldown: item.cooldown, enabled: item.enabled,
      studioRule: { kind: "source", source: item.source }, testSource: item.source
    };
  }

  function saveSelected(panel) {
    const selected = [...panel.querySelectorAll("[data-nationality-family-select]:checked")]
      .map(input => currentBatch[Number(input.dataset.nationalityFamilySelect)]).filter(Boolean);
    if (!selected.length) return;
    let state;
    try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) {}
    if (!state || typeof state !== "object") state = { version: 1, overrides: {}, customs: [], deletedIds: [] };
    if (!Array.isArray(state.customs)) state.customs = [];
    if (!state.overrides || typeof state.overrides !== "object") state.overrides = {};
    if (!Array.isArray(state.deletedIds)) state.deletedIds = [];
    const known = new Set(state.customs.map(prompt => String(prompt?.id || "")));
    let added = 0;
    for (const item of selected) {
      if (known.has(item.id)) continue;
      state.customs.push(serialise(item));
      known.add(item.id);
      added += 1;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    panel.querySelector("[data-nationality-family-status]").textContent = `${added} nationality prompt${added === 1 ? "" : "s"} saved to the browser library. Reloading Prompt Studio…`;
    setTimeout(() => location.reload(), 550);
  }

  function renderBatch(panel) {
    const preview = panel.querySelector("[data-nationality-family-preview]");
    const status = panel.querySelector("[data-nationality-family-status]");
    const add = panel.querySelector("[data-nationality-family-add]");
    if (!currentBatch.length) {
      preview.innerHTML = '<div class="nationality-family-empty">No new 5★ nationality prompts survived the current filters. Try Balanced difficulty or another position.</div>';
      status.textContent = "0 nationality prompts generated.";
      add.disabled = true;
      return;
    }
    status.textContent = `${currentBatch.length} checked 5★ nationality prompts ready for review.`;
    preview.innerHTML = currentBatch.map((item, index) => `<label class="nationality-family-card"><input type="checkbox" data-nationality-family-select="${index}" checked><span class="position-badge">${item.position}</span><span><strong>${esc(item.label)}</strong><small>${item.stats.playerCount} valid players · ${esc(item.difficulty)} · ${esc(item.country)}</small></span><b>5★</b></label>`).join("");
    add.disabled = false;
  }

  window.FPL_NATIONALITY_FAMILY_GENERATOR = Object.freeze({
    version: "1.1.0",
    buildBatch: () => buildBatch(),
    serialise: item => serialise(item)
  });

  function install() {
    if (installed) return;
    if (document.getElementById("factoryIncludeNationalityFamily")) { installed = true; return; }
    const factory = document.getElementById("automaticPromptFactory");
    if (!factory || !players().length) return;
    installed = true;
    const stats = coverage();
    const panel = document.createElement("details");
    panel.id = "nationalityFamilyGenerator";
    panel.className = "nationality-family-generator";
    const enrichedCopy = stats.enrichedApplied ? ` · ${stats.enrichedApplied.toLocaleString("en-GB")} enriched` : "";
    panel.innerHTML = `<summary><span><small>NATIONALITY FAMILY</small><strong>Generate nationality + stats prompts</strong></span><em>${stats.percentage}% coverage</em></summary><div class="nationality-family-body"><p>Uses verified nationality metadata plus FPL region IDs. The Automatic Creator's position, difficulty, count, cooldown and enabled settings still apply. Missing nationality only excludes that player from this family.</p><p class="nationality-coverage"><b>${stats.withNationality.toLocaleString("en-GB")}</b> of <b>${stats.eligiblePlayers.toLocaleString("en-GB")}</b> answer-eligible players have usable nationality data · <b>${stats.missingNationality.toLocaleString("en-GB")}</b> missing${enrichedCopy}.</p><div class="nationality-family-actions"><button type="button" class="button primary" data-nationality-family-generate>Generate nationality batch</button><button type="button" class="button secondary" data-nationality-family-add disabled>Add selected to browser library</button></div><p class="action-status" data-nationality-family-status>Ready. Nothing is saved until you approve a generated batch.</p><div class="nationality-family-preview" data-nationality-family-preview></div></div>`;
    const anchor = document.getElementById("qualityFamilyGenerator");
    if (anchor?.parentNode === factory) anchor.after(panel); else factory.appendChild(panel);
    panel.querySelector("[data-nationality-family-generate]").addEventListener("click", () => {
      panel.querySelector("[data-nationality-family-status]").textContent = "Checking nationality combinations against the full database…";
      setTimeout(() => { currentBatch = buildBatch(); renderBatch(panel); }, 20);
    });
    panel.querySelector("[data-nationality-family-add]").addEventListener("click", () => saveSelected(panel));
    panel.addEventListener("change", event => {
      if (!event.target.matches("[data-nationality-family-select]")) return;
      panel.querySelector("[data-nationality-family-add]").disabled = !panel.querySelector("[data-nationality-family-select]:checked");
    });
    const style = document.createElement("style");
    style.textContent = `.nationality-family-generator{margin:14px 0 0;border:1px solid rgba(167,139,250,.2);border-radius:14px;background:rgba(167,139,250,.035);overflow:hidden}.nationality-family-generator summary{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;cursor:pointer}.nationality-family-generator summary span{display:grid;gap:2px}.nationality-family-generator summary small{color:#c4b5fd;font-size:.62rem;font-weight:950;letter-spacing:.09em}.nationality-family-generator summary strong{color:#f4fff8;font-size:.88rem}.nationality-family-generator summary em{color:#63eaa1;font-size:.66rem;font-style:normal;font-weight:900}.nationality-family-body{padding:0 12px 12px}.nationality-family-body>p{color:#9bb7a8;font-size:.72rem;line-height:1.45}.nationality-coverage{padding:9px 10px;border:1px solid rgba(167,139,250,.13);border-radius:10px;background:rgba(0,0,0,.1)}.nationality-coverage b{color:#f4fff8}.nationality-family-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.nationality-family-preview{display:grid;gap:7px;margin-top:10px}.nationality-family-card{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid rgba(174,226,199,.1);border-radius:11px;background:rgba(0,0,0,.11);cursor:pointer}.nationality-family-card input{width:17px;height:17px}.nationality-family-card span:nth-child(3){min-width:0}.nationality-family-card strong,.nationality-family-card small{display:block}.nationality-family-card strong{color:#f4fff8;font-size:.74rem;line-height:1.35}.nationality-family-card small{margin-top:3px;color:#9bb7a8;font-size:.64rem}.nationality-family-card>b{color:#63eaa1;font-size:.7rem}.nationality-family-empty{padding:12px;border:1px dashed rgba(174,226,199,.13);border-radius:10px;color:#9bb7a8;font-size:.72rem}@media(max-width:520px){.nationality-family-actions{display:grid;grid-template-columns:1fr}.nationality-family-card{grid-template-columns:auto auto minmax(0,1fr)}.nationality-family-card>b{grid-column:3}}`;
    document.head.appendChild(style);
  }

  function flushEnrichmentWaiters() {
    enrichmentReady = true;
    enrichmentLoading = false;
    while (enrichmentWaiters.length) enrichmentWaiters.shift()();
  }

  function ensureEnrichment(callback) {
    if (enrichmentReady || window.FPL_NATIONALITY_ENRICHMENT) { enrichmentReady = true; callback(); return; }
    enrichmentWaiters.push(callback);
    if (enrichmentLoading) return;
    enrichmentLoading = true;
    const existing = document.querySelector('script[data-nationality-enrichment]');
    if (existing) {
      existing.addEventListener("load", flushEnrichmentWaiters, { once: true });
      existing.addEventListener("error", flushEnrichmentWaiters, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = new URL("nationality-enrichment.js?v=1.0.0", document.baseURI).toString();
    script.async = false;
    script.dataset.nationalityEnrichment = "1";
    script.addEventListener("load", flushEnrichmentWaiters, { once: true });
    script.addEventListener("error", flushEnrichmentWaiters, { once: true });
    document.head.appendChild(script);
  }

  function retryInstall() {
    if (installed) return;
    ensureEnrichment(() => {
      install();
      if (!installed) setTimeout(retryInstall, 150);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retryInstall, { once: true }); else retryInstall();
  window.addEventListener("fpl:prompt-tools-ready", retryInstall);
  window.addEventListener("fpl:quality-prompt-baseline-ready", retryInstall);

  window.FPL_NATIONALITY_FAMILY = Object.freeze({ version: "1.1.0", coverage, regions: REGIONS, countryForPlayer });
})();
