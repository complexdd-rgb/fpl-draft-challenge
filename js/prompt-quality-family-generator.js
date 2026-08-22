/* FPL Challenge Studio — Quality Family Generator v1.0.0
   Adds V1/V2/V3-style family generation inside the existing Automatic Creator.
   Every generated candidate is tested against the current database and only 5-star
   position-aware answer pools survive. No prompt is saved until the user approves it. */
(() => {
  "use strict";

  const STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const BIG_SIX = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"];
  const RANGES = {
    GK: { idealLow: 8, idealHigh: 35 },
    DEF: { idealLow: 18, idealHigh: 90 },
    MID: { idealLow: 18, idealHigh: 90 },
    FWD: { idealLow: 12, idealHigh: 60 }
  };
  const POINTS = {
    GK: [55, 70, 85, 100, 115], DEF: [65, 80, 95, 110, 125, 140],
    MID: [70, 85, 100, 115, 130, 145], FWD: [60, 75, 90, 105, 120, 135]
  };
  const MINUTES = [1200, 1800, 2200, 2600, 3000];
  const PRICES = [4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
  let currentBatch = [];
  let installed = false;

  const players = () => Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const library = () => Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const slug = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const yearOf = value => Number(String(value || "").slice(0, 4));

  function compile(source) {
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return null; }
  }

  function analyse(position, test) {
    const ids = new Set();
    let seasons = 0;
    for (const player of players()) {
      for (const record of player.seasons || []) {
        if (Number(record.minutes) <= 0 || record.position !== position) continue;
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

  function candidate(position, family, tail, label, fail, source, tags, novelty = 0) {
    const test = compile(source);
    if (!test) return null;
    const stats = analyse(position, test);
    const range = RANGES[position];
    if (!range || stats.playerCount < range.idealLow || stats.playerCount > range.idealHigh) return null;
    const midpoint = (range.idealLow + range.idealHigh) / 2;
    const score = 130 + novelty - Math.abs(stats.playerCount - midpoint) / Math.max(1, midpoint) * 24;
    return {
      id: `quality_factory_${position.toLowerCase()}_${tail}`.replace(/[^a-z0-9_]+/g, "_"),
      family: `quality-factory:${family}`,
      position, label, fail, source, test, stats, score,
      difficulty: difficulty(position, stats.playerCount),
      tags: [...new Set(["auto-generated", "quality-family", "quality-pack-style", "approved-5-star", "anti-meta", ...tags])],
      rating: 5,
      cooldown: Math.max(0, Math.min(50, Number(document.getElementById("factoryCooldown")?.value) || 10)),
      enabled: document.getElementById("factoryEnablePrompts")?.checked !== false
    };
  }

  function managersForPosition(position) {
    const counts = new Map();
    for (const player of players()) {
      for (const record of player.seasons || []) {
        if (record.position !== position || Number(record.minutes) <= 0) continue;
        for (const manager of Array.isArray(record.managers) ? record.managers : []) {
          const name = String(manager || "").trim();
          if (name) counts.set(name, (counts.get(name) || 0) + 1);
        }
      }
    }
    return [...counts.entries()].filter(([, count]) => count >= 10).sort((a,b) => b[1]-a[1]).slice(0, 24).map(([name]) => name);
  }

  function addV1(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    for (const seasons of [3,4,5,6,8,10]) for (const points of POINTS[position]) {
      out.push(candidate(position, "one-club-veteran", `one_club_s${seasons}_p${points}`,
        `${noun} with one recorded Premier League club, ${seasons}+ recorded seasons and ${points}+ FPL points`,
        `That ${lower} must have recorded Premier League minutes for exactly one club across at least ${seasons} seasons and score at least ${points} FPL points in the qualifying season.`,
        `p => (Number(p._career?.clubCount) === 1 && Number(p._career?.seasonCount) >= ${seasons} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,
        ["v1-family","career-total","one-club","points"], 9));
    }
    for (const clubs of [2,3,4,5]) for (const points of POINTS[position]) {
      out.push(candidate(position, "bottom-half-journeyman", `bottom_half_c${clubs}_p${points}`,
        `${noun} from a bottom-half club who represented ${clubs}+ recorded Premier League clubs and scored ${points}+ FPL points`,
        `That ${lower} must play for a bottom-half club, have recorded Premier League minutes for at least ${clubs} clubs and score at least ${points} FPL points.`,
        `p => (p.bottomHalf === true && Number(p._career?.clubCount) >= ${clubs} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,
        ["v1-family","bottom-half","career-clubs","points"], 8));
      out.push(candidate(position, "outside-big-six-journeyman", `outside_big_six_c${clubs}_p${points}`,
        `${noun} outside the traditional Big Six who represented ${clubs}+ recorded Premier League clubs and scored ${points}+ FPL points`,
        `That ${lower} must play outside the traditional Big Six, have recorded Premier League minutes for at least ${clubs} clubs and score at least ${points} FPL points.`,
        `p => (!${JSON.stringify(BIG_SIX)}.includes(p.club) && Number(p._career?.clubCount) >= ${clubs} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,
        ["v1-family","outside-big-six","career-clubs","points"], 8));
    }
  }

  function addV2(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    for (const price of PRICES) for (const points of POINTS[position]) {
      out.push(candidate(position, "budget-value", `budget_${String(price).replace(".","_")}_p${points}`,
        `${noun} who started at £${price.toFixed(1)}m or less and scored ${points}+ FPL points`,
        `That ${lower} must have a recorded starting price of £${price.toFixed(1)}m or less and score at least ${points} FPL points.`,
        `p => (Number.isFinite(Number(p.startingPrice)) && Number(p.startingPrice) <= ${price} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,
        ["v2-family","budget","starting-price","points"], 10));
    }
    for (const age of [21,22,23,24,25,30,31,32,33,34]) for (const points of POINTS[position]) {
      const young = age <= 25;
      out.push(candidate(position, young ? "young-performer" : "veteran-performer", `${young?"young":"veteran"}_${age}_p${points}`,
        `${noun} aged ${young ? `${age} or younger` : `${age} or older`} at season start with ${points}+ FPL points`,
        `That ${lower} must be aged ${young ? `${age} or younger` : `${age} or older`} at the start of the season and score at least ${points} FPL points.`,
        `p => (Number.isFinite(Number(p.ageAtSeasonStart)) && Number(p.ageAtSeasonStart) ${young?"<=":">="} ${age} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,
        ["v2-family","age","points",young?"young":"veteran"], 9));
    }
    for (const minutes of MINUTES) for (const cards of [0,1,2,3,4]) {
      out.push(candidate(position, "disciplined-workhorse", `disciplined_m${minutes}_yc${cards}`,
        `${noun} with ${minutes.toLocaleString("en-GB")}+ minutes and at most ${cards} yellow card${cards===1?"":"s"}`,
        `That ${lower} must play at least ${minutes.toLocaleString("en-GB")} minutes and receive no more than ${cards} yellow card${cards===1?"":"s"}.`,
        `p => (Number(p.minutes) >= ${minutes} && Number(p.yellowCards) <= ${cards})`,
        ["v2-family","minutes","discipline","yellow-cards"], 7));
    }
    if (position === "GK") for (const saves of [70,90,110,130]) for (const points of [70,85,100,115]) {
      out.push(candidate(position,"shot-stopper",`saves_${saves}_p${points}`,`Goalkeeper with ${saves}+ saves and ${points}+ FPL points`,`That goalkeeper must record at least ${saves} saves and ${points} FPL points.`,`p => (Number(p.saves) >= ${saves} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,["v2-family","saves","points"],9));
    }
    if (position === "DEF") for (const goals of [2,3,4,5]) for (const assists of [2,3,4,5]) {
      out.push(candidate(position,"attacking-defender",`g${goals}_a${assists}`,`Defender with ${goals}+ goals and ${assists}+ assists`,`That defender must score at least ${goals} goals and record at least ${assists} assists.`,`p => (Number(p.goals) >= ${goals} && Number(p.assists) >= ${assists} && Number(p.minutes) > 0)`,["v2-family","goals","assists"],10));
    }
    if (position === "MID") for (const assists of [6,8,10,12]) for (const points of [80,100,120,140]) {
      out.push(candidate(position,"creative-midfielder",`a${assists}_p${points}`,`Midfielder with ${assists}+ assists and ${points}+ FPL points`,`That midfielder must record at least ${assists} assists and ${points} FPL points.`,`p => (Number(p.assists) >= ${assists} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,["v2-family","assists","points"],9));
    }
    if (position === "FWD") for (const goals of [8,10,12,15]) for (const assists of [3,4,5,6]) {
      out.push(candidate(position,"complete-forward",`g${goals}_a${assists}`,`Forward with ${goals}+ goals and ${assists}+ assists`,`That forward must score at least ${goals} goals and record at least ${assists} assists.`,`p => (Number(p.goals) >= ${goals} && Number(p.assists) >= ${assists} && Number(p.minutes) > 0)`,["v2-family","goals","assists"],10));
    }
  }

  function addV3(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    const years = players().flatMap(player => (player.seasons || []).map(s => yearOf(s.season))).filter(Number.isFinite);
    const minYear = years.length ? Math.min(...years) : 2012;
    const maxYear = years.length ? Math.max(...years) : 2025;
    for (let start = minYear; start <= maxYear - 3; start += 3) {
      const end = Math.min(maxYear, start + 4);
      for (const points of POINTS[position]) {
        out.push(candidate(position,"era-performer",`era_${start}_${end}_p${points}`,`${noun} from the ${start}/${String(start+1).slice(-2)}–${end}/${String(end+1).slice(-2)} era with ${points}+ FPL points`,`That ${lower} must record Premier League minutes between ${start}/${String(start+1).slice(-2)} and ${end}/${String(end+1).slice(-2)} and score at least ${points} FPL points.`,`p => { const y = Number(String(p.season || "").slice(0,4)); return Number.isFinite(y) && y >= ${start} && y <= ${end} && Number(p.points) >= ${points} && Number(p.minutes) > 0; }`,["v3-family","era","points"],11));
      }
    }
    for (const manager of managersForPosition(position)) for (const points of POINTS[position]) {
      const q = JSON.stringify(manager.toLowerCase());
      out.push(candidate(position,"manager-story",`manager_${slug(manager)}_p${points}`,`${noun} managed by ${manager} with ${points}+ FPL points`,`That ${lower} must have ${manager} among the stored managers for the qualifying season and score at least ${points} FPL points.`,`p => (Array.isArray(p.managers) && p.managers.some(m => String(m).toLowerCase() === ${q}) && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,["v3-family","manager","points"],12));
    }
    for (const [low,high] of [[1,4],[5,8],[9,12],[13,17],[18,20]]) for (const points of POINTS[position]) {
      out.push(candidate(position,"table-band",`table_${low}_${high}_p${points}`,`${noun} from a club finishing ${low}${low===1?"st":low===2?"nd":low===3?"rd":"th"}–${high}${high===1?"st":high===2?"nd":high===3?"rd":"th"} with ${points}+ FPL points`,`That ${lower}'s club must finish between ${low} and ${high} and the player must score at least ${points} FPL points.`,`p => (Number(p.leaguePosition) >= ${low} && Number(p.leaguePosition) <= ${high} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`,["v3-family","league-position","points"],10));
    }
    const exacts = position === "GK" ? [["cleanSheets","clean sheets",[6,8,10,12]],["saves","saves",[70,90,110]]]
      : position === "DEF" ? [["goals","goals",[1,2,3,4]],["assists","assists",[2,3,4,5]]]
      : position === "MID" ? [["goals","goals",[3,4,5,6]],["assists","assists",[4,5,6,7]]]
      : [["goals","goals",[6,8,10,12]],["assists","assists",[2,3,4,5]]];
    for (const flag of ["promoted","relegated"]) for (const [field,word,values] of exacts) for (const value of values) {
      out.push(candidate(position,`${flag}-exact-stat`,`${flag}_${field}_${value}`,`${noun} from a ${flag} club with exactly ${value} ${word}`,`That ${lower} must play for a ${flag} club and record exactly ${value} ${word}.`,`p => (p.${flag} === true && Number(p.${field}) === ${value} && Number(p.minutes) > 0)`,["v3-family",flag,"exact-stat",field],14));
    }
  }

  const ANTI_META_INVERSE_POLICY_VERSION = 1;

  function addInverseAntiMeta(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    const pointCaps = position === "GK" ? [55, 65, 75, 85, 100]
      : position === "FWD" ? [60, 70, 80, 90, 100, 110]
      : [65, 75, 85, 100, 110, 120];
    const minuteFloors = position === "GK" ? [900, 1500, 2200]
      : [1000, 1600, 2200, 2600];

    for (const cap of pointCaps) for (const minutes of minuteFloors) {
      out.push(candidate(position, "inverse-points", `under_${cap}_m${minutes}`,
        `${noun} who scored under ${cap} FPL points despite playing ${minutes.toLocaleString("en-GB")}+ minutes`,
        `That ${lower} must play at least ${minutes.toLocaleString("en-GB")} minutes but score fewer than ${cap} FPL points.`,
        `p => (Number(p.minutes) >= ${minutes} && Number(p.points) < ${cap})`,
        ["inverse-stat","under-points","minutes","less-obvious"], 18));
    }

    const lowOutput = position === "GK"
      ? { field: "cleanSheets", word: "clean sheets", caps: [4,5,6,7,8], minutes: [1500,2200] }
      : position === "DEF"
        ? { field: "goals", word: "goals", caps: [0,1], minutes: [1600,2200,2600] }
        : position === "MID"
          ? { field: "goals", word: "goals", caps: [1,2,3,4], minutes: [1600,2200] }
          : { field: "goals", word: "goals", caps: [3,4,5,6,7], minutes: [1200,1800,2200] };

    for (const cap of lowOutput.caps) for (const minutes of lowOutput.minutes) {
      out.push(candidate(position, "low-output-workhorse", `low_${lowOutput.field}_${cap}_m${minutes}`,
        `${noun} with at most ${cap} ${lowOutput.word} despite playing ${minutes.toLocaleString("en-GB")}+ minutes`,
        `That ${lower} must play at least ${minutes.toLocaleString("en-GB")} minutes and record no more than ${cap} ${lowOutput.word}.`,
        `p => (Number(p.minutes) >= ${minutes} && Number(p.${lowOutput.field}) <= ${cap})`,
        ["inverse-stat","low-output","minutes",lowOutput.field,"less-obvious"], 16));
    }
  }

  function existingQualityPools(position) {
    const pools = [];
    for (const prompt of library()) {
      if (prompt.position !== position || typeof prompt.test !== "function") continue;
      const tags = Array.isArray(prompt.tags) ? prompt.tags : [];
      if (!tags.includes("quality-pack") && !tags.includes("quality-family")) continue;
      const stats = analyse(position, prompt.test);
      if (stats.ids.size) pools.push(stats.ids);
    }
    return pools;
  }

  function buildBatch() {
    const requested = Math.max(1, Math.min(50, Math.round(Number(document.getElementById("factoryPromptCount")?.value) || 20)));
    const positionValue = document.getElementById("factoryPositionMix")?.value || "balanced";
    const difficultyValue = document.getElementById("factoryDifficultyMix")?.value || "balanced";
    const positions = POSITIONS.includes(positionValue) ? [positionValue] : POSITIONS;
    const existingIds = new Set(library().map(p => String(p.id || "")));
    const existingLabels = new Set(library().map(p => String(p.label || "").trim().toLowerCase()));
    const candidates = [];

    for (const position of positions) {
      const positionCandidates = [];
      addV1(position, positionCandidates);
      addV2(position, positionCandidates);
      addV3(position, positionCandidates);
      addInverseAntiMeta(position, positionCandidates);
      const oldPools = existingQualityPools(position);
      const byFamily = new Map();
      for (const item of positionCandidates.filter(Boolean)) {
        if (existingIds.has(item.id) || existingLabels.has(item.label.trim().toLowerCase())) continue;
        if (difficultyValue !== "balanced" && item.difficulty !== difficultyValue) continue;
        if (oldPools.some(pool => overlap(pool, item.stats.ids) >= 0.90)) continue;
        const current = byFamily.get(item.family);
        if (!current || item.score > current.score || (item.score === current.score && item.id < current.id)) byFamily.set(item.family, item);
      }
      candidates.push(...byFamily.values());
    }

    candidates.sort((a,b) => b.score - a.score || a.id.localeCompare(b.id));
    const chosen = [];
    while (chosen.length < requested && candidates.length) {
      let bestIndex = -1, bestValue = -Infinity;
      for (let i=0;i<candidates.length;i+=1) {
        const item = candidates[i];
        if (chosen.some(other => other.position === item.position && overlap(other.stats.ids, item.stats.ids) >= 0.84)) continue;
        const posUsed = chosen.filter(other => other.position === item.position).length;
        const famUsed = chosen.filter(other => other.family === item.family).length;
        const value = item.score - posUsed * (positions.length > 1 ? 8 : 0) - famUsed * 14;
        if (value > bestValue) { bestValue = value; bestIndex = i; }
      }
      if (bestIndex < 0) break;
      chosen.push(candidates.splice(bestIndex,1)[0]);
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

  function renderBatch(panel) {
    const preview = panel.querySelector("[data-quality-family-preview]");
    const status = panel.querySelector("[data-quality-family-status]");
    const add = panel.querySelector("[data-quality-family-add]");
    if (!currentBatch.length) {
      preview.innerHTML = '<div class="quality-family-empty">No new 5★ family variations survived the current filters. Try Balanced difficulty or a different position.</div>';
      status.textContent = "0 quality-family prompts generated.";
      add.disabled = true;
      return;
    }
    const counts = Object.fromEntries(POSITIONS.map(position => [position,currentBatch.filter(item=>item.position===position).length]));
    status.textContent = `${currentBatch.length} checked 5★ prompts · GK ${counts.GK} · DEF ${counts.DEF} · MID ${counts.MID} · FWD ${counts.FWD}`;
    preview.innerHTML = currentBatch.map((item,index) => `<label class="quality-family-card"><input type="checkbox" data-quality-family-select="${index}" checked><span class="position-badge">${item.position}</span><span class="quality-family-copy"><strong>${esc(item.label)}</strong><small>${item.stats.playerCount} valid players · ${esc(item.difficulty)} · ${esc(item.family.replace("quality-factory:",""))}</small></span><b>5★</b></label>`).join("");
    add.disabled = false;
  }

  function saveSelected(panel) {
    const selected = [...panel.querySelectorAll("[data-quality-family-select]:checked")].map(input => currentBatch[Number(input.dataset.qualityFamilySelect)]).filter(Boolean);
    if (!selected.length) return;
    let state;
    try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) {}
    if (!state || typeof state !== "object") state = { version:1, overrides:{}, customs:[], deletedIds:[] };
    if (!Array.isArray(state.customs)) state.customs = [];
    if (!state.overrides || typeof state.overrides !== "object") state.overrides = {};
    if (!Array.isArray(state.deletedIds)) state.deletedIds = [];
    const known = new Set(state.customs.map(prompt => String(prompt.id || "")));
    let added = 0;
    for (const item of selected) {
      if (known.has(item.id)) continue;
      state.customs.push(serialise(item));
      known.add(item.id);
      added += 1;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const status = panel.querySelector("[data-quality-family-status]");
    status.textContent = `${added} quality-family prompt${added===1?"":"s"} saved to the browser library. Reloading Prompt Studio…`;
    setTimeout(() => location.reload(), 550);
  }

  function install() {
    if (installed) return;
    const factory = document.getElementById("automaticPromptFactory");
    if (!factory || !window.FPL_QUALITY_PROMPT_BASELINE?.ready) return;
    installed = true;

    const panel = document.createElement("details");
    panel.id = "qualityFamilyGenerator";
    panel.className = "quality-family-generator";
    panel.innerHTML = `<summary><span><small>QUALITY FAMILIES</small><strong>Generate V1 / V2 / V3 + inverse anti-meta prompts</strong></span><em>5★ gate only</em></summary><div class="quality-family-body"><p>Uses the Automatic Creator's count, position, difficulty, cooldown and enabled settings. New variants are tested against the full database, rejected if their answer pool falls outside the 5★ range, and checked against existing quality-pack answer pools.</p><div class="quality-family-actions"><button type="button" class="button primary" data-quality-family-generate>Generate quality-family batch</button><button type="button" class="button secondary" data-quality-family-add disabled>Add selected to browser library</button></div><p class="action-status" data-quality-family-status>Ready. Nothing is saved until you approve a generated batch.</p><div class="quality-family-preview" data-quality-family-preview></div></div>`;

    const existingPreview = document.getElementById("promptFactoryPreview");
    if (existingPreview?.parentNode === factory) existingPreview.after(panel); else factory.appendChild(panel);

    panel.querySelector("[data-quality-family-generate]").addEventListener("click", () => {
      const status = panel.querySelector("[data-quality-family-status]");
      status.textContent = "Checking V1, V2, V3 and inverse anti-meta variations against the full database…";
      setTimeout(() => { currentBatch = buildBatch(); renderBatch(panel); }, 20);
    });
    panel.querySelector("[data-quality-family-add]").addEventListener("click", () => saveSelected(panel));
    panel.addEventListener("change", event => {
      if (!event.target.matches("[data-quality-family-select]")) return;
      panel.querySelector("[data-quality-family-add]").disabled = !panel.querySelector("[data-quality-family-select]:checked");
    });

    const style = document.createElement("style");
    style.textContent = `.quality-family-generator{margin:14px 0 0;border:1px solid rgba(98,201,255,.18);border-radius:14px;background:rgba(98,201,255,.025);overflow:hidden}.quality-family-generator summary{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;cursor:pointer}.quality-family-generator summary span{display:grid;gap:2px}.quality-family-generator summary small{color:#62c9ff;font-size:.62rem;font-weight:950;letter-spacing:.09em}.quality-family-generator summary strong{color:#f4fff8;font-size:.88rem}.quality-family-generator summary em{color:#63eaa1;font-size:.66rem;font-style:normal;font-weight:900}.quality-family-body{padding:0 12px 12px}.quality-family-body>p{color:#9bb7a8;font-size:.72rem;line-height:1.45}.quality-family-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.quality-family-preview{display:grid;gap:7px;margin-top:10px}.quality-family-card{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid rgba(174,226,199,.1);border-radius:11px;background:rgba(0,0,0,.11);cursor:pointer}.quality-family-card input{width:17px;height:17px}.quality-family-copy{min-width:0}.quality-family-copy strong,.quality-family-copy small{display:block}.quality-family-copy strong{color:#f4fff8;font-size:.74rem;line-height:1.35}.quality-family-copy small{margin-top:3px;color:#9bb7a8;font-size:.64rem}.quality-family-card>b{color:#63eaa1;font-size:.7rem}.quality-family-empty{padding:12px;border:1px dashed rgba(174,226,199,.13);border-radius:10px;color:#9bb7a8;font-size:.72rem}@media(max-width:520px){.quality-family-actions{display:grid;grid-template-columns:1fr}.quality-family-card{grid-template-columns:auto auto minmax(0,1fr)}.quality-family-card>b{grid-column:3}}`;
    document.head.appendChild(style);
  }

  function retryInstall() {
    if (installed) return;
    install();
    if (!installed) setTimeout(retryInstall, 150);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retryInstall, { once:true }); else retryInstall();
  window.addEventListener("fpl:prompt-tools-ready", retryInstall);
  window.addEventListener("fpl:quality-prompt-baseline-ready", retryInstall);
})();
