/* FPL Draft Challenge — Prompt Studio V3 advisory quality evidence v3.2.0.
   Calculates evidence only. It never writes a star rating, review decision, approval state,
   enabled state or production prompt. Human review remains the sole V3 quality authority. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_V3_QUALITY_ADVISOR?.ready) return;

  const VERSION = "3.2.0";
  const EVIDENCE_KEY = "fplPromptStudioV3QualityAdvisoryEvidence";
  const RANGES = Object.freeze({
    ANY: { narrow:12, idealLow:25, idealHigh:120, broad:220 },
    GK: { narrow:5, idealLow:8, idealHigh:35, broad:70 },
    DEF: { narrow:8, idealLow:18, idealHigh:90, broad:165 },
    MID: { narrow:8, idealLow:18, idealHigh:90, broad:165 },
    FWD: { narrow:6, idealLow:12, idealHigh:60, broad:110 }
  });

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const pct = value => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(EVIDENCE_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  let evidenceStore = readStore();
  const answerProfileCache = new Map();
  let installed = false;
  let running = false;

  function saveStore() {
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(evidenceStore));
  }

  function v3() {
    return window.FPL_PROMPT_STUDIO_V3 || null;
  }

  function tester() {
    return window.FPL_PROMPT_STUDIO_V3_RULE_TESTER || null;
  }

  function engine() {
    return window.ValidationEngine || null;
  }

  function players() {
    return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  }

  function state() {
    return v3()?.getState?.() || { prompts:[] };
  }

  function families() {
    return v3()?.getFamilies?.() || [];
  }

  function allEntries() {
    const rows = [];
    for (const player of players()) {
      for (const record of player.seasons || []) rows.push({ player, season:record.season });
    }
    return rows;
  }

  function compatiblePosition(left, right) {
    return left === "ANY" || right === "ANY" || left === right;
  }

  function overlap(left, right) {
    if (!left.size || !right.size) return 0;
    const smaller = left.size <= right.size ? left : right;
    const larger = smaller === left ? right : left;
    let common = 0;
    for (const id of smaller) if (larger.has(id)) common += 1;
    return common / smaller.size;
  }

  function maxShare(counts, total) {
    if (!total || !counts.size) return { value:0, key:"" };
    let key = "";
    let count = 0;
    for (const [candidate, value] of counts) {
      if (value > count) { key = candidate; count = value; }
    }
    return { value:count / total, key, count };
  }

  function profileSummary(prompt, byPlayer) {
    const seasonCounts = new Map();
    const clubCounts = new Map();
    const bigSix = new Set(engine()?.BIG_SIX || []);
    let bigSixCount = 0;
    for (const result of byPlayer.values()) {
      const season = String(result.record?.season || "Unknown");
      const club = String(result.record?.club || "Unknown");
      seasonCounts.set(season, (seasonCounts.get(season) || 0) + 1);
      clubCounts.set(club, (clubCounts.get(club) || 0) + 1);
      if (bigSix.has(club)) bigSixCount += 1;
    }
    const total = byPlayer.size;
    return {
      playerCount:total,
      seasonCount:seasonCounts.size,
      clubCount:clubCounts.size,
      topSeason:maxShare(seasonCounts,total),
      topClub:maxShare(clubCounts,total),
      bigSixShare:total ? bigSixCount / total : 0,
      position:prompt.position || "ANY"
    };
  }

  function breadthSignal(position, count) {
    const range = RANGES[position] || RANGES.ANY;
    if (count < range.narrow) return { label:"Very narrow", note:`Below the ${range.narrow}-player advisory floor used for this position.` };
    if (count < range.idealLow) return { label:"Narrow", note:`Usable, but below the ${range.idealLow}-player lower edge of the healthy answer range.` };
    if (count <= range.idealHigh) return { label:"Healthy", note:`Inside the ${range.idealLow}–${range.idealHigh} advisory answer range.` };
    if (count <= range.broad) return { label:"Broad", note:`Above the ideal range but below the ${range.broad}-player broadness ceiling.` };
    return { label:"Very broad", note:`Above the ${range.broad}-player advisory broadness ceiling.` };
  }

  function obviousnessSignal(summary) {
    const range = RANGES[summary.position] || RANGES.ANY;
    let risk = 0;
    const reasons = [];
    if (summary.playerCount <= Math.max(range.narrow + 4, 12)) {
      risk += 2;
      reasons.push("Small answer pool can make the headline names easier to spot.");
    }
    if (summary.topClub.value >= 0.50) {
      risk += 2;
      reasons.push(`${pct(summary.topClub.value)}% of valid players come from ${summary.topClub.key || "one club"}.`);
    } else if (summary.topClub.value >= 0.35) {
      risk += 1;
      reasons.push(`${pct(summary.topClub.value)}% club concentration is worth a human look.`);
    }
    if (summary.topSeason.value >= 0.35) {
      risk += 2;
      reasons.push(`${pct(summary.topSeason.value)}% of valid players peak in ${summary.topSeason.key || "one season"}.`);
    } else if (summary.topSeason.value >= 0.25) {
      risk += 1;
      reasons.push(`${pct(summary.topSeason.value)}% season concentration is worth a human look.`);
    }
    if (summary.bigSixShare >= 0.75) {
      risk += 2;
      reasons.push(`${pct(summary.bigSixShare)}% of valid players are from the traditional Big Six.`);
    } else if (summary.bigSixShare >= 0.60) {
      risk += 1;
      reasons.push(`${pct(summary.bigSixShare)}% Big Six concentration may make answers more obvious.`);
    }
    const level = risk >= 4 ? "high" : risk >= 2 ? "medium" : "low";
    if (!reasons.length) reasons.push("No strong concentration signal was detected; human judgement still decides obviousness.");
    return { level, risk, reasons };
  }

  function familySignal(prompt, prompts) {
    const family = families().find(item => item.id === prompt.family) || null;
    const familyPrompts = prompt.family ? prompts.filter(item => item.family === prompt.family) : [];
    const counts = { draft:0, tested:0, review:0, approved:0 };
    for (const item of familyPrompts) if (Object.hasOwn(counts,item.status)) counts[item.status] += 1;
    const total = familyPrompts.length;
    let coverage = "Unassigned";
    if (family) {
      if (total <= 1) coverage = "First V3 prompt in family";
      else if (total <= 3) coverage = "Light coverage";
      else if (total <= 6) coverage = "Established coverage";
      else coverage = "Dense coverage";
    }
    return {
      id:prompt.family || "",
      name:family?.name || (prompt.family || "No family"),
      tier:family?.tier || "Unassigned",
      description:family?.description || "Assign a V3 family so coverage can be assessed.",
      total,
      siblingCount:Math.max(0,total - 1),
      counts,
      coverage
    };
  }

  function profileCacheKey(prompt) {
    const detail = tester()?.getTestDetail?.(prompt.id);
    return `${prompt.id}|${prompt.updatedAt || ""}|${detail?.testedAt || ""}|${prompt.label}`;
  }

  function scanPrompt(prompt, rows, onProgress) {
    const cacheKey = profileCacheKey(prompt);
    if (answerProfileCache.has(cacheKey)) return Promise.resolve(answerProfileCache.get(cacheKey));
    const validation = engine();
    return new Promise(resolve => {
      const byPlayer = new Map();
      let runtimeErrors = 0;
      let index = 0;
      const chunk = () => {
        const end = Math.min(index + 300, rows.length);
        for (; index < end; index += 1) {
          const entry = rows[index];
          let result;
          try { result = validation.evaluatePrompt(entry.player, entry.season, prompt.label); }
          catch (_) { runtimeErrors += 1; continue; }
          if (!result?.ok) { runtimeErrors += 1; continue; }
          if (!result.passed) continue;
          const current = byPlayer.get(entry.player.playerId);
          if (!current || Number(result.record?.points || 0) > Number(current.record?.points || 0)) byPlayer.set(entry.player.playerId,result);
        }
        onProgress?.(rows.length ? index / rows.length : 1);
        if (index < rows.length) window.setTimeout(chunk,0);
        else {
          const profile = { ids:new Set(byPlayer.keys()), byPlayer, runtimeErrors, summary:profileSummary(prompt,byPlayer) };
          answerProfileCache.set(cacheKey,profile);
          resolve(profile);
        }
      };
      chunk();
    });
  }

  function promptOptions(selected="") {
    return state().prompts.map(prompt => `<option value="${esc(prompt.id)}"${prompt.id === selected ? " selected" : ""}>${esc(prompt.label)}</option>`).join("");
  }

  function evidenceFor(promptId) {
    return evidenceStore[promptId] || null;
  }

  function renderEvidence(root, promptId) {
    const host = root.querySelector("[data-v3-quality-advisory-result]");
    if (!host) return;
    const prompt = state().prompts.find(item => item.id === promptId);
    if (!prompt) {
      host.innerHTML = '<div class="prompt-v3-empty">Choose a tested prompt to inspect advisory quality evidence.</div>';
      return;
    }
    const test = tester()?.getTestDetail?.(prompt.id);
    const evidence = evidenceFor(prompt.id);
    if (!test || test.technical !== "pass") {
      host.innerHTML = '<div class="prompt-v3-note"><strong>Technical Test required first.</strong><br>Quality evidence is only calculated after the real database Test passes.</div>';
      return;
    }
    if (!evidence) {
      host.innerHTML = '<div class="prompt-v3-note"><strong>Ready for advisory analysis.</strong><br>This will calculate answer breadth, concentration, same-position V3 overlap and family coverage. It will not choose a star rating or review decision.</div>';
      return;
    }
    const overlaps = evidence.overlaps || [];
    host.innerHTML = `<div class="prompt-v3-advisory-result">
      <div class="prompt-v3-note"><strong>Advisory evidence only — no quality decision was made.</strong><br>Calculated ${esc(new Date(evidence.calculatedAt).toLocaleString("en-GB"))}. Your human rating, obviousness judgement and review decision remain unchanged until you save them yourself.</div>
      <div class="prompt-v3-advisory-metrics">
        <article><span>Valid players</span><strong>${Number(evidence.breadth.players).toLocaleString("en-GB")}</strong><small>${esc(evidence.breadth.label)}</small></article>
        <article><span>Seasons</span><strong>${Number(evidence.breadth.seasons).toLocaleString("en-GB")}</strong><small>Top: ${esc(evidence.concentration.topSeason.label)} · ${evidence.concentration.topSeason.percent}%</small></article>
        <article><span>Clubs</span><strong>${Number(evidence.breadth.clubs).toLocaleString("en-GB")}</strong><small>Top: ${esc(evidence.concentration.topClub.label)} · ${evidence.concentration.topClub.percent}%</small></article>
        <article><span>Big Six share</span><strong>${evidence.concentration.bigSixPercent}%</strong><small>Concentration signal</small></article>
        <article><span>Highest V3 overlap</span><strong>${evidence.highestOverlap}%</strong><small>${esc(evidence.highestOverlapPromptLabel || "No tested peer")}</small></article>
        <article><span>Obviousness signal</span><strong>${esc(evidence.obviousness.level.toUpperCase())}</strong><small>Advisory heuristic</small></article>
      </div>
      <div class="prompt-v3-advisory-grid">
        <article><h4>Answer breadth</h4><p>${esc(evidence.breadth.note)}</p></article>
        <article><h4>Obviousness indicators</h4><p>${evidence.obviousness.reasons.map(reason => esc(reason)).join("<br>")}</p></article>
        <article><h4>Family coverage</h4><p><strong>${esc(evidence.family.name)}</strong> · ${esc(evidence.family.tier)}<br>${esc(evidence.family.coverage)} · ${evidence.family.total} V3 prompt${evidence.family.total === 1 ? "" : "s"}.<br>${esc(evidence.family.description)}</p></article>
        <article><h4>Closest tested V3 prompts</h4><div class="prompt-v3-advisory-overlaps">${overlaps.length ? overlaps.map(item => `<div><span>${esc(item.label)}</span><strong>${item.percent}%</strong></div>`).join("") : '<p>No compatible tested V3 peer exists yet.</p>'}</div></article>
      </div>
      <div class="prompt-v3-actions"><button type="button" class="prompt-v3-button" data-v3-copy-advisory-overlap>Copy ${evidence.highestOverlap}% overlap into human form</button><button type="button" class="prompt-v3-button" data-v3-copy-advisory-obviousness>Copy ${esc(evidence.obviousness.level)} obviousness into human form</button></div>
    </div>`;
  }

  async function runAnalysis(root, promptId) {
    if (running) return;
    const currentState = state();
    const prompt = currentState.prompts.find(item => item.id === promptId);
    const validation = engine();
    const ruleTester = tester();
    if (!prompt) return window.alert("Choose a V3 prompt first.");
    if (!validation?.evaluatePrompt || !players().length) return window.alert("Player database / Validation Engine is not ready yet.");
    const test = ruleTester?.getTestDetail?.(prompt.id);
    if (!test || test.technical !== "pass") return window.alert("Run and pass the real V3 database Test before quality analysis.");

    running = true;
    const button = root.querySelector("[data-v3-run-quality-advisory]");
    const progress = root.querySelector("[data-v3-quality-advisory-progress] i");
    const status = root.querySelector("[data-v3-quality-advisory-status]");
    if (button) button.disabled = true;
    if (progress) progress.style.width = "0%";

    const rows = allEntries();
    const peers = currentState.prompts.filter(other => {
      if (other.id === prompt.id || !compatiblePosition(prompt.position,other.position)) return false;
      return ruleTester?.getTestDetail?.(other.id)?.technical === "pass";
    });
    const totalScans = Math.max(1,1 + peers.length);
    let completedScans = 0;
    const progressFor = fraction => {
      if (progress) progress.style.width = `${Math.round(((completedScans + fraction) / totalScans) * 100)}%`;
    };

    if (status) status.textContent = `Analysing ${prompt.label} against ${rows.length.toLocaleString("en-GB")} player-season rows…`;
    const selected = await scanPrompt(prompt,rows,progressFor);
    completedScans += 1;

    const overlaps = [];
    for (let index = 0; index < peers.length; index += 1) {
      const peer = peers[index];
      if (status) status.textContent = `Overlap check ${index + 1} / ${peers.length}: ${peer.label}`;
      const peerProfile = await scanPrompt(peer,rows,progressFor);
      overlaps.push({ id:peer.id, label:peer.label, value:overlap(selected.ids,peerProfile.ids), players:peerProfile.ids.size });
      completedScans += 1;
      progressFor(0);
    }
    overlaps.sort((a,b) => b.value - a.value || a.label.localeCompare(b.label));

    const summary = selected.summary;
    const breadth = breadthSignal(prompt.position,summary.playerCount);
    const obviousness = obviousnessSignal(summary);
    const family = familySignal(prompt,currentState.prompts);
    const top = overlaps[0] || null;
    const evidence = {
      version:VERSION,
      promptId:prompt.id,
      label:prompt.label,
      position:prompt.position,
      testEvidenceAt:test.testedAt || test.reviewedAt || "",
      calculatedAt:new Date().toISOString(),
      runtimeErrors:selected.runtimeErrors,
      breadth:{ players:summary.playerCount, seasons:summary.seasonCount, clubs:summary.clubCount, label:breadth.label, note:breadth.note },
      concentration:{
        topClub:{ label:summary.topClub.key || "None", percent:pct(summary.topClub.value) },
        topSeason:{ label:summary.topSeason.key || "None", percent:pct(summary.topSeason.value) },
        bigSixPercent:pct(summary.bigSixShare)
      },
      obviousness,
      family,
      highestOverlap:top ? pct(top.value) : 0,
      highestOverlapPromptId:top?.id || "",
      highestOverlapPromptLabel:top?.label || "",
      comparedPeers:peers.length,
      overlaps:overlaps.slice(0,5).map(item => ({ id:item.id, label:item.label, percent:pct(item.value), players:item.players }))
    };
    evidenceStore[prompt.id] = evidence;
    saveStore();
    running = false;
    if (button) button.disabled = false;
    if (progress) progress.style.width = "100%";
    if (status) status.textContent = `Advisory evidence ready · ${summary.playerCount.toLocaleString("en-GB")} valid players · ${peers.length} compatible tested V3 peer${peers.length === 1 ? "" : "s"} compared.`;
    renderEvidence(root,prompt.id);
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v3-quality-evidence", { detail:clone(evidence) }));
  }

  function installStyles() {
    if (document.getElementById("promptV3QualityAdvisorStyles")) return;
    const style = document.createElement("style");
    style.id = "promptV3QualityAdvisorStyles";
    style.textContent = `
      .prompt-v3-quality-advisory{display:grid;gap:12px;margin-bottom:18px;padding:14px;border:1px solid rgba(98,201,255,.18);border-radius:14px;background:rgba(98,201,255,.035)}
      .prompt-v3-quality-advisory label{display:grid;gap:6px;font-size:.8rem}.prompt-v3-quality-advisory select{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#06150d;color:#f2fff6}
      .prompt-v3-advisory-result{display:grid;gap:12px}.prompt-v3-advisory-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.prompt-v3-advisory-metrics article{display:grid;gap:3px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:10px}.prompt-v3-advisory-metrics span,.prompt-v3-advisory-metrics small{color:#9eb4a7}.prompt-v3-advisory-metrics strong{font-size:1.2rem}
      .prompt-v3-advisory-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.prompt-v3-advisory-grid article{padding:11px;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}.prompt-v3-advisory-grid h4,.prompt-v3-advisory-grid p{margin:0}.prompt-v3-advisory-grid h4{margin-bottom:6px}.prompt-v3-advisory-overlaps{display:grid;gap:5px}.prompt-v3-advisory-overlaps div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      .prompt-v3-quality-progress{height:7px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.08)}.prompt-v3-quality-progress i{display:block;height:100%;width:0;background:#62c9ff;transition:width .12s linear}
      @media(max-width:800px){.prompt-v3-advisory-metrics,.prompt-v3-advisory-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function installAdvisor(root) {
    const view = root.querySelector('[data-v3-view="quality"] .prompt-v3-card');
    const humanForm = root.querySelector("[data-v3-quality-form]");
    if (!view || !humanForm || view.querySelector("[data-v3-quality-advisory]")) return;
    const box = document.createElement("div");
    box.className = "prompt-v3-quality-advisory";
    box.dataset.v3QualityAdvisory = "1";
    box.innerHTML = `
      <div><h3 style="margin:0">Advisory quality evidence</h3><p style="margin:5px 0 0">Uses the real database Test result to measure breadth and concentration, then compares answer-set overlap with compatible tested V3 prompts. This evidence cannot change the star rating, obviousness field, decision, status or live library.</p></div>
      <label>V3 prompt<select data-v3-quality-advisory-select><option value="">Choose a V3 prompt</option>${promptOptions()}</select></label>
      <div class="prompt-v3-actions"><button type="button" class="prompt-v3-button primary" data-v3-run-quality-advisory>Run advisory quality analysis</button></div>
      <div class="prompt-v3-quality-progress" data-v3-quality-advisory-progress><i></i></div>
      <p data-v3-quality-advisory-status style="margin:0;color:#9eb4a7">Ready.</p>
      <div data-v3-quality-advisory-result><div class="prompt-v3-empty">Choose a tested prompt to inspect advisory quality evidence.</div></div>
    `;
    view.insertBefore(box,humanForm);

    const select = box.querySelector("[data-v3-quality-advisory-select]");
    select.addEventListener("change", () => {
      const id = select.value;
      if ([...humanForm.elements.id.options].some(option => option.value === id)) humanForm.elements.id.value = id;
      renderEvidence(root,id);
    });
    box.querySelector("[data-v3-run-quality-advisory]").addEventListener("click", () => runAnalysis(root,select.value));
    box.addEventListener("click", event => {
      const id = select.value;
      const evidence = evidenceFor(id);
      if (!evidence) return;
      if (event.target.closest("[data-v3-copy-advisory-overlap]")) {
        humanForm.elements.id.value = id;
        humanForm.elements.overlap.value = String(evidence.highestOverlap);
      }
      if (event.target.closest("[data-v3-copy-advisory-obviousness]")) {
        humanForm.elements.id.value = id;
        humanForm.elements.obviousness.value = evidence.obviousness.level;
      }
    });
  }

  function refresh(root) {
    const select = root.querySelector("[data-v3-quality-advisory-select]");
    const humanForm = root.querySelector("[data-v3-quality-form]");
    if (!select || !humanForm) return;
    const preferred = humanForm.elements.id.value || select.value;
    select.innerHTML = `<option value="">Choose a V3 prompt</option>${promptOptions(preferred)}`;
    if ([...select.options].some(option => option.value === preferred)) select.value = preferred;
    renderEvidence(root,select.value);
  }

  function install() {
    if (installed) return true;
    const root = document.getElementById("promptStudioV3");
    if (!root || !v3() || !tester()) return false;
    installStyles();
    installAdvisor(root);
    window.addEventListener("fpl:prompt-studio-v3-changed", () => refresh(root));
    installed = true;
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v3-quality-advisor-ready", { detail:{ version:VERSION } }));
    return true;
  }

  const api = Object.freeze({
    ready:true,
    version:VERSION,
    evidenceKey:EVIDENCE_KEY,
    install,
    getEvidence:id => clone(evidenceStore[id] || null),
    overlap
  });
  window.FPL_PROMPT_STUDIO_V3_QUALITY_ADVISOR = api;

  const boot = () => {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts > 100) clearInterval(timer);
    },100);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot,{ once:true }); else boot();
})();
