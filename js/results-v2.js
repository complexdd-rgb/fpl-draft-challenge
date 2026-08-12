/* FPL Draft Challenge — Daily Challenge Results v2.
   Player-facing result polish only: scoring and answer validation remain owned by the game engine. */
(() => {
  "use strict";

  const challenge = window.FPL_DAILY_CHALLENGE || null;
  const results = document.getElementById("results");
  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  if (!challenge || !results || !players.length) return;

  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const archiveMode = runtime.archiveMode === true;
  const localStore = archiveMode ? `fpl-v2-practice-${challenge.id}` : `fpl-v2-${challenge.id}`;
  const historyStore = "fpl-v4-local-history";
  const flatSeasons = players.flatMap(player => (Array.isArray(player.seasons) ? player.seasons : []).map(season => ({
    ...season,
    playerId: player.playerId,
    name: player.name
  })));
  const promptById = new Map((challenge.prompts || []).map((prompt, index) => [prompt.id, { prompt, index }]));
  let lastSignature = "";
  let currentModel = null;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function currentRecord(preferred = null) {
    if (preferred?.challengeId === challenge.id && preferred.completed === true) return preferred;
    const stored = readJson(localStore, {});
    if (stored?.completedRecord?.challengeId === challenge.id) return stored.completedRecord;
    const history = readJson(historyStore, []);
    if (Array.isArray(history)) {
      const match = history.find(item => item?.completed === true && item.challengeId === challenge.id);
      if (match) return match;
    }
    return null;
  }

  function selectionRows(record) {
    const storedSelections = Array.isArray(record?.selections) ? record.selections : [];
    const storedByPrompt = new Map(storedSelections.map(item => [item.promptId, item]));
    return (challenge.prompts || []).map(prompt => {
      const stored = storedByPrompt.get(prompt.id);
      const pick = record?.picks?.[prompt.id] || null;
      const playerId = stored?.playerId ?? pick?.playerId;
      const season = stored?.season ?? pick?.season;
      const source = flatSeasons.find(item => String(item.playerId) === String(playerId) && String(item.season) === String(season));
      if (!source && !stored) return null;
      return {
        promptId: prompt.id,
        position: prompt.position,
        playerId,
        name: stored?.name || source?.name || "Unknown player",
        season: season || source?.season || "",
        club: stored?.club || source?.club || "",
        points: Number.isFinite(Number(stored?.points)) ? Number(stored.points) : Number(source?.points) || 0
      };
    });
  }

  function qualifies(candidate, prompt) {
    if (!candidate || candidate.position !== prompt.position || Number(candidate.minutes) <= 0) return false;
    try { return Boolean(prompt.test(candidate)); } catch { return false; }
  }

  function insightFor(selection, prompt, index) {
    if (!selection) return null;
    const valid = flatSeasons.filter(candidate => qualifies(candidate, prompt));
    const pickedPoints = Number(selection.points) || 0;
    const bestPoints = valid.length ? Math.max(...valid.map(candidate => Number(candidate.points) || 0)) : 0;
    const higherCount = valid.reduce((count, candidate) => count + ((Number(candidate.points) || 0) > pickedPoints ? 1 : 0), 0);
    const tiedCount = valid.reduce((count, candidate) => count + ((Number(candidate.points) || 0) === pickedPoints ? 1 : 0), 0);
    const rank = valid.length ? higherCount + 1 : null;
    const efficiency = bestPoints > 0 ? Math.max(0, Math.min(100, (pickedPoints / bestPoints) * 100)) : pickedPoints === bestPoints ? 100 : 0;
    const pointsOffBest = Math.max(0, bestPoints - pickedPoints);
    const tier = rank === 1 ? "perfect" : efficiency >= 90 ? "elite" : efficiency >= 75 ? "strong" : "risky";
    const rankLabel = rank === 1
      ? (tiedCount > 1 ? `Joint-best of ${valid.length}` : `Best of ${valid.length}`)
      : rank ? `${tiedCount > 1 ? "Joint " : ""}#${rank} of ${valid.length}` : "Rank unavailable";
    return {
      index,
      prompt,
      selection,
      validCount: valid.length,
      rank,
      tiedCount,
      rankLabel,
      pickedPoints,
      bestPoints,
      pointsOffBest,
      efficiency,
      tier
    };
  }

  function buildModel(record) {
    if (!record) return null;
    const selections = selectionRows(record);
    if (selections.some(item => !item)) return null;
    const insights = selections.map((selection, index) => insightFor(selection, challenge.prompts[index], index));
    const finalScore = Number(record.finalScore) || Number(document.getElementById("finalScore")?.textContent) || 0;
    const perfectScore = Number(record.perfectScore) || Number(challenge.perfectScore) || 0;
    const efficiency = Number.isFinite(Number(record.efficiency)) ? Number(record.efficiency) : perfectScore > 0 ? finalScore / perfectScore * 100 : 0;
    const penalties = Number(record.penalties) || 0;
    const elapsedSeconds = Number(record.elapsedSeconds) || 0;
    const grade = String(record.grade || document.getElementById("grade")?.textContent || "–");
    return {
      record,
      selections,
      insights,
      finalScore,
      perfectScore,
      efficiency,
      penalties,
      elapsedSeconds,
      grade,
      pointsToPerfect: Math.max(0, perfectScore - finalScore),
      perfectPromptPicks: insights.filter(item => item?.rank === 1).length
    };
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function dateLabel(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || challenge.releaseDate || ""));
    if (!match) return String(value || "Daily Challenge");
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)));
  }

  function installStyles() {
    if (document.getElementById("resultsV2Styles")) return;
    const style = document.createElement("style");
    style.id = "resultsV2Styles";
    style.textContent = `
      .results-v2-scoreboard{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 22px}
      .results-v2-headline-stat{position:relative;overflow:hidden;min-height:112px;padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:18px;background:linear-gradient(145deg,rgba(20,56,41,.96),rgba(8,29,21,.98));box-shadow:0 10px 24px rgba(0,0,0,.16)}
      .results-v2-headline-stat::after{content:"";position:absolute;width:68px;height:68px;border-radius:50%;right:-24px;top:-28px;background:rgba(255,255,255,.035)}
      .results-v2-headline-stat span,.results-v2-headline-stat strong,.results-v2-headline-stat small{display:block;position:relative;z-index:1}
      .results-v2-headline-stat span{color:var(--muted);font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.075em}
      .results-v2-headline-stat strong{margin-top:7px;font-size:clamp(1.45rem,4.5vw,2.2rem);line-height:1;color:#f7fff9;letter-spacing:-.04em}
      .results-v2-headline-stat small{margin-top:5px;color:#c8ddd1;font-size:.72rem;line-height:1.35}
      .results-v2-headline-stat.emphasis{border-color:rgba(0,255,135,.26);background:linear-gradient(145deg,rgba(0,255,135,.13),rgba(9,36,25,.98))}
      .results-v2-headline-stat.emphasis strong{color:var(--accent)}
      .score-card.results-v2-secondary{opacity:.82;margin-top:10px}
      .results-v2-analysis{margin:24px 0;padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:linear-gradient(155deg,rgba(16,45,33,.96),rgba(7,25,18,.98))}
      .results-v2-analysis-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:13px}
      .results-v2-analysis-head h2{margin:3px 0 4px;font-size:1.15rem}.results-v2-analysis-head p{margin:0;color:var(--muted);font-size:.76rem;line-height:1.45}
      .results-v2-analysis-summary{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .results-v2-analysis-summary span{padding:6px 8px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(0,0,0,.15);font-size:.62rem;font-weight:900;color:#dcece3;white-space:nowrap}
      .results-v2-picks{display:grid;gap:8px}.results-v2-pick{display:grid;grid-template-columns:52px minmax(0,1.7fr) minmax(130px,.8fr) minmax(110px,.65fr);gap:10px;align-items:center;padding:11px;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(0,0,0,.13)}
      .results-v2-pos{display:grid;place-items:center;min-height:42px;border-radius:11px;background:rgba(255,255,255,.065);font-size:.7rem;font-weight:1000;color:#e9fff1}
      .results-v2-pick-copy strong,.results-v2-pick-copy span{display:block}.results-v2-pick-copy strong{font-size:.84rem}.results-v2-pick-copy span{margin-top:2px;color:var(--muted);font-size:.66rem;line-height:1.3}
      .results-v2-rank strong,.results-v2-rank span,.results-v2-gap strong,.results-v2-gap span{display:block}.results-v2-rank strong,.results-v2-gap strong{font-size:.82rem}.results-v2-rank span,.results-v2-gap span{margin-top:2px;color:var(--muted);font-size:.6rem}
      .results-v2-rank[data-tier="perfect"] strong{color:#ffd166}.results-v2-rank[data-tier="elite"] strong{color:var(--accent)}.results-v2-rank[data-tier="strong"] strong{color:#5fe5ff}.results-v2-rank[data-tier="risky"] strong{color:#ff879c}
      .results-v2-meter{grid-column:2/-1;height:5px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.055);margin-top:-3px}.results-v2-meter span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),#5fe5ff)}
      .results-v2-share-card .share-card-stats{grid-template-columns:repeat(4,minmax(0,1fr))}
      .results-v2-share-pitch{display:grid;gap:7px;margin:17px 0;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:15px;background:linear-gradient(180deg,rgba(21,119,68,.32),rgba(10,72,42,.28))}
      .results-v2-share-line{display:flex;justify-content:center;gap:6px}.results-v2-share-line span{width:22px;height:22px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}
      .results-v2-share-line .perfect{background:#ffd166}.results-v2-share-line .elite{background:#00ff87}.results-v2-share-line .strong{background:#5fe5ff}.results-v2-share-line .risky{background:#ff5577}
      .results-v2-share-legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;color:var(--muted);font-size:.58rem}.results-v2-share-legend span{display:flex;align-items:center;gap:4px}.results-v2-share-legend i{width:8px;height:8px;border-radius:3px;display:inline-block}.results-v2-share-legend .perfect{background:#ffd166}.results-v2-share-legend .elite{background:#00ff87}.results-v2-share-legend .strong{background:#5fe5ff}.results-v2-share-legend .risky{background:#ff5577}
      @media(max-width:760px){.results-v2-scoreboard{grid-template-columns:1fr 1fr}.results-v2-pick{grid-template-columns:46px minmax(0,1fr) auto}.results-v2-gap{grid-column:2/4}.results-v2-meter{grid-column:2/4}.results-v2-analysis-head{display:block}.results-v2-analysis-summary{justify-content:flex-start;margin-top:9px}}
      @media(max-width:480px){.results-v2-headline-stat{min-height:96px;padding:12px}.results-v2-headline-stat strong{font-size:1.55rem}.results-v2-share-card .share-card-stats{grid-template-columns:1fr 1fr}.results-v2-pick{grid-template-columns:42px minmax(0,1fr)}.results-v2-rank,.results-v2-gap,.results-v2-meter{grid-column:2/3}}
    `;
    document.head.appendChild(style);
  }

  function renderScoreboard(model) {
    let board = document.getElementById("resultsV2Scoreboard");
    if (!board) {
      board = document.createElement("div");
      board.id = "resultsV2Scoreboard";
      board.className = "results-v2-scoreboard";
      document.getElementById("resultHero")?.insertAdjacentElement("afterend", board);
    }
    board.innerHTML = `
      <article class="results-v2-headline-stat"><span>Final score</span><strong>${model.finalScore.toLocaleString()}</strong><small>Your verified-style total after penalties.</small></article>
      <article class="results-v2-headline-stat emphasis"><span>Perfect score</span><strong>${model.perfectScore.toLocaleString()}</strong><small>Highest possible unique-player XI.</small></article>
      <article class="results-v2-headline-stat emphasis"><span>Efficiency</span><strong>${model.efficiency.toFixed(1)}%</strong><small>${model.pointsToPerfect.toLocaleString()} point${model.pointsToPerfect === 1 ? "" : "s"} from perfect.</small></article>
      <article class="results-v2-headline-stat"><span>Perfect prompt picks</span><strong>${model.perfectPromptPicks}/11</strong><small>${esc(model.grade)} grade · ${formatTime(model.elapsedSeconds)}.</small></article>
    `;
    document.querySelector(".score-card")?.classList.add("results-v2-secondary");
  }

  function renderAnalysis(model) {
    let panel = document.getElementById("resultsV2Analysis");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "resultsV2Analysis";
      panel.className = "results-v2-analysis";
      const reviews = document.getElementById("reviews");
      const heading = reviews?.previousElementSibling;
      if (heading) heading.insertAdjacentElement("beforebegin", panel);
      else document.querySelector(".score-card")?.insertAdjacentElement("afterend", panel);
    }

    const topThree = model.insights.filter(item => item?.rank && item.rank <= 3).length;
    const averageRank = model.insights.length
      ? model.insights.reduce((sum, item) => sum + (Number(item?.rank) || Number(item?.validCount) || 0), 0) / model.insights.length
      : 0;
    panel.innerHTML = `
      <div class="results-v2-analysis-head">
        <div><span class="overview-kicker">Pick-by-pick review</span><h2>Where your points were won and lost</h2><p>Ranks compare your chosen player-season with every valid player-season for that prompt. Equal scores share the same rank.</p></div>
        <div class="results-v2-analysis-summary"><span>${model.perfectPromptPicks} best answer${model.perfectPromptPicks === 1 ? "" : "s"}</span><span>${topThree} top-three pick${topThree === 1 ? "" : "s"}</span><span>Avg rank ${averageRank.toFixed(1)}</span></div>
      </div>
      <div class="results-v2-picks">
        ${model.insights.map(item => item ? `
          <article class="results-v2-pick">
            <div class="results-v2-pos">${esc(item.prompt.position)}</div>
            <div class="results-v2-pick-copy"><strong>${item.index + 1}. ${esc(item.selection.name)} · ${item.pickedPoints.toLocaleString()} pts</strong><span>${esc(item.selection.season)} · ${esc(item.selection.club)} · ${esc(item.prompt.label)}</span></div>
            <div class="results-v2-rank" data-tier="${item.tier}"><strong>${esc(item.rankLabel)}</strong><span>valid answer rank</span></div>
            <div class="results-v2-gap"><strong>${item.pointsOffBest ? `${item.pointsOffBest.toLocaleString()} pts off best` : "Maximum points"}</strong><span>${item.efficiency.toFixed(0)}% of prompt best · best ${item.bestPoints.toLocaleString()}</span></div>
            <div class="results-v2-meter" aria-hidden="true"><span style="width:${item.efficiency.toFixed(1)}%"></span></div>
          </article>` : "").join("")}
      </div>
    `;
  }

  function tierMarker(tier) {
    return tier === "perfect" ? "🟨" : tier === "elite" ? "🟩" : tier === "strong" ? "🟦" : "🟥";
  }

  function positionRows(model) {
    const order = ["FWD", "MID", "DEF", "GK"];
    return order.map(position => ({ position, items: model.insights.filter(item => item?.prompt.position === position) })).filter(row => row.items.length);
  }

  function buildShareText(model) {
    const rows = positionRows(model).map(row => row.items.map(item => tierMarker(item.tier)).join(""));
    return [
      `FPL Draft Challenge · ${dateLabel(model.record.challengeDate || challenge.releaseDate)}`,
      challenge.title || "Daily Challenge",
      runtime.archiveMode ? "Archive practice" : "",
      "",
      ...rows,
      "",
      `Score ${model.finalScore.toLocaleString()} / ${model.perfectScore.toLocaleString()} · ${model.efficiency.toFixed(1)}%`,
      `Grade ${model.grade} · ${model.perfectPromptPicks}/11 best prompt picks`,
      `Time ${formatTime(model.elapsedSeconds)} · Penalties ${model.penalties}`,
      "",
      "Can you beat my historical XI?"
    ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== "")).join("\n");
  }

  function renderShareCard(model) {
    const preview = document.getElementById("phase45SharePreview");
    const mount = document.getElementById("phase45ShareCard");
    if (!preview || !mount) return;
    preview.querySelector(".share-preview-head h3")?.replaceChildren(document.createTextNode("Your spoiler-free result"));
    const rows = positionRows(model);
    mount.innerHTML = `
      <article class="share-card results-v2-share-card">
        <div class="share-card-top">
          <div class="share-card-title"><span>FPL Draft Challenge · ${esc(dateLabel(model.record.challengeDate || challenge.releaseDate))}</span><strong>${esc(challenge.title || "Daily Challenge")}</strong></div>
          <div class="share-card-grade">${esc(model.grade)}</div>
        </div>
        <div class="results-v2-share-pitch" aria-label="Spoiler-free pick quality grid">
          ${rows.map(row => `<div class="results-v2-share-line" data-position="${row.position}">${row.items.map(item => `<span class="${item.tier}" title="${esc(item.rankLabel)}"></span>`).join("")}</div>`).join("")}
        </div>
        <div class="share-card-stats">
          <div class="share-card-stat"><span>Score</span><strong>${model.finalScore.toLocaleString()} / ${model.perfectScore.toLocaleString()}</strong></div>
          <div class="share-card-stat"><span>Efficiency</span><strong>${model.efficiency.toFixed(1)}%</strong></div>
          <div class="share-card-stat"><span>Best picks</span><strong>${model.perfectPromptPicks}/11</strong></div>
          <div class="share-card-stat"><span>Time</span><strong>${formatTime(model.elapsedSeconds)}</strong></div>
        </div>
        <div class="results-v2-share-legend"><span><i class="perfect"></i> Best</span><span><i class="elite"></i> 90%+</span><span><i class="strong"></i> 75%+</span><span><i class="risky"></i> &lt;75%</span></div>
      </article>
    `;
  }

  function replaceShareActions() {
    for (const [id, kind] of [["shareResult", "share"], ["copy", "copy"]]) {
      const current = document.getElementById(id);
      if (!current || current.dataset.resultsV2 === "1") continue;
      const button = current.cloneNode(true);
      button.dataset.resultsV2 = "1";
      current.replaceWith(button);
      button.addEventListener("click", async () => {
        if (!currentModel) return;
        const text = buildShareText(currentModel);
        const status = document.getElementById("copyStatus");
        try {
          if (kind === "share" && navigator.share) {
            await navigator.share({ title: challenge.title || "FPL Draft Challenge", text, url: location.href });
            if (status) status.textContent = "Result shared.";
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            if (status) status.textContent = kind === "share" ? "Share text copied." : "Result copied.";
          } else if (status) {
            status.textContent = text;
          }
        } catch (error) {
          if (error?.name !== "AbortError" && status) status.textContent = "Sharing was not available.";
        }
      });
    }
  }

  function render(record = null) {
    const resolved = currentRecord(record);
    if (!resolved || results.classList.contains("hidden")) return;
    const signature = `${resolved.challengeId}|${resolved.completedAt || "restored"}|${resolved.finalScore}|${resolved.elapsedSeconds}`;
    if (signature === lastSignature && currentModel) return;
    const model = buildModel(resolved);
    if (!model) return;
    lastSignature = signature;
    currentModel = model;
    installStyles();
    renderScoreboard(model);
    renderAnalysis(model);
    renderShareCard(model);
    replaceShareActions();
  }

  window.addEventListener("fpl:challenge-completed", event => {
    window.setTimeout(() => render(event.detail?.record || null), 0);
  });

  const observer = new MutationObserver(() => {
    if (!results.classList.contains("hidden")) window.setTimeout(() => render(), 0);
  });
  observer.observe(results, { attributes: true, attributeFilter: ["class"], childList: true, subtree: false });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.setTimeout(() => render(), 0), { once: true });
  } else {
    window.setTimeout(() => render(), 0);
  }
})();
