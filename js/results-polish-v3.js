/* FPL Draft Challenge — Results polish v3.
   Presentation-only enhancement layered over results-v2. It reads rendered result data
   and never changes scoring, validation, saved selections, penalties or leaderboard data. */
(() => {
  "use strict";

  const results = document.getElementById("results");
  if (!results) return;

  let lastSignature = "";
  let renderQueued = false;
  let mobileDetailsExpanded = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const numberFrom = value => {
    const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };

  function headlineValue(label) {
    const cards = [...document.querySelectorAll("#resultsV2Scoreboard .results-v2-headline-stat")];
    const card = cards.find(node => node.querySelector("span")?.textContent?.trim().toLowerCase() === label.toLowerCase());
    return card?.querySelector("strong")?.textContent?.trim() || "";
  }

  function readPick(node, index) {
    const copy = node.querySelector(".results-v2-pick-copy");
    const headline = copy?.querySelector("strong")?.textContent?.trim() || "";
    const meta = copy?.querySelector("span")?.textContent?.trim() || "";
    const cleanHeadline = headline.replace(/^\d+\.\s*/, "");
    const name = cleanHeadline.split(" · ")[0] || `Pick ${index + 1}`;
    const points = numberFrom(cleanHeadline.split(" · ").slice(1).join(" · "));
    const rankText = node.querySelector(".results-v2-rank strong")?.textContent?.trim() || "Rank unavailable";
    const rankMatch = rankText.match(/#(\d+)/);
    const rank = /^best\b|^joint-best\b/i.test(rankText) ? 1 : rankMatch ? Number(rankMatch[1]) : null;
    const gapText = node.querySelector(".results-v2-gap strong")?.textContent?.trim() || "";
    const gap = /maximum points/i.test(gapText) ? 0 : numberFrom(gapText);
    const meter = node.querySelector(".results-v2-meter span");
    const efficiency = Math.max(0, Math.min(100, numberFrom(meter?.style?.width || "0")));
    return {
      index,
      name,
      points,
      meta,
      position: node.querySelector(".results-v2-pos")?.textContent?.trim() || "XI",
      rank,
      rankText,
      gap,
      efficiency,
      tier: node.querySelector(".results-v2-rank")?.dataset?.tier || "risky"
    };
  }

  function snapshot() {
    const board = document.getElementById("resultsV2Scoreboard");
    const pickNodes = [...document.querySelectorAll("#resultsV2Analysis .results-v2-pick")];
    if (!board || !pickNodes.length) return null;

    const finalScore = numberFrom(headlineValue("Final score"));
    const perfectScore = numberFrom(headlineValue("Perfect score"));
    const efficiency = numberFrom(headlineValue("Efficiency"));
    const perfectPicks = numberFrom(headlineValue("Perfect prompt picks"));
    const penalties = numberFrom(document.getElementById("penaltyPoints")?.textContent || "0");
    const grade = String(document.getElementById("grade")?.textContent || "–").trim();
    const time = String(document.getElementById("timeTaken")?.textContent || "–").trim();
    const picks = pickNodes.map(readPick);
    const pointsToPerfect = Math.max(0, perfectScore - finalScore);
    const topThree = picks.filter(pick => Number(pick.rank) > 0 && pick.rank <= 3).length;
    const eliteOrBetter = picks.filter(pick => pick.efficiency >= 90).length;
    const strongest = [...picks].sort((a, b) => a.gap - b.gap || b.efficiency - a.efficiency || (a.rank || 9999) - (b.rank || 9999))[0] || null;
    const biggestGap = [...picks].sort((a, b) => b.gap - a.gap || a.efficiency - b.efficiency)[0] || null;

    return {
      finalScore,
      perfectScore,
      efficiency,
      perfectPicks,
      penalties,
      grade,
      time,
      pointsToPerfect,
      picks,
      topThree,
      eliteOrBetter,
      strongest,
      biggestGap
    };
  }

  function verdictFor(model) {
    if (model.perfectScore > 0 && model.finalScore >= model.perfectScore) {
      return { label: "Perfect XI", tone: "perfect", copy: "You matched the highest-scoring unique-player XI." };
    }
    if (model.efficiency >= 95) return { label: "Elite draft", tone: "elite", copy: "You were right on the heels of the unique-player maximum." };
    if (model.efficiency >= 90) return { label: "Excellent XI", tone: "elite", copy: "A high-quality draft with only a small amount left on the table." };
    if (model.efficiency >= 80) return { label: "Strong XI", tone: "strong", copy: "A strong result with a few clear places where extra points were available." };
    if (model.efficiency >= 70) return { label: "Solid XI", tone: "strong", copy: "A solid base, with the pick review showing the quickest route to a bigger score." };
    return { label: "Room to climb", tone: "risky", copy: "There were some big scoring opportunities — the review below shows where they were." };
  }

  function installStyles() {
    if (document.getElementById("resultsPolishV3Styles")) return;
    const style = document.createElement("style");
    style.id = "resultsPolishV3Styles";
    style.textContent = `
      .score-card.results-v2-secondary{display:none!important}
      .results-v3-verdict{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;margin:4px 0 14px;padding:17px 18px;border:1px solid rgba(0,255,135,.18);border-radius:20px;background:linear-gradient(135deg,rgba(0,255,135,.09),rgba(95,229,255,.04) 55%,rgba(0,0,0,.12));box-shadow:0 12px 28px rgba(0,0,0,.14)}
      .results-v3-verdict[data-tone="perfect"]{border-color:rgba(255,209,102,.3);background:linear-gradient(135deg,rgba(255,209,102,.1),rgba(0,255,135,.06),rgba(0,0,0,.12))}
      .results-v3-verdict-copy h3{margin:3px 0 5px;font-size:1.18rem;letter-spacing:-.025em}.results-v3-verdict-copy p{margin:0;color:#c8ddd1;font-size:.74rem;line-height:1.5}
      .results-v3-verdict-copy p strong{color:#fff}.results-v3-verdict-kicker{color:var(--accent);font-size:.58rem;font-weight:950;text-transform:uppercase;letter-spacing:.09em}
      .results-v3-verdict-grade{display:grid;place-items:center;min-width:78px;min-height:78px;padding:10px;border-radius:20px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.1);text-align:center}.results-v3-verdict-grade strong{font-size:1.75rem;line-height:1;color:var(--accent)}.results-v3-verdict-grade span{margin-top:5px;color:var(--muted);font-size:.55rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
      .results-v3-chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.results-v3-chip-row span{padding:5px 8px;border-radius:999px;background:rgba(0,0,0,.17);border:1px solid rgba(255,255,255,.075);color:#dcece3;font-size:.59rem;font-weight:850}
      .results-v3-key-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 18px}.results-v3-key-card{min-width:0;padding:12px;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(0,0,0,.12)}.results-v3-key-card span,.results-v3-key-card strong,.results-v3-key-card small{display:block}.results-v3-key-card span{color:var(--muted);font-size:.56rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.results-v3-key-card strong{margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.84rem;color:#fff}.results-v3-key-card small{margin-top:3px;color:#bcd2c5;font-size:.61rem;line-height:1.35}.results-v3-key-card.good strong{color:var(--accent)}.results-v3-key-card.warn strong{color:#ffd166}.results-v3-key-card.gap strong{color:#ff9aae}
      .results-v3-details-toggle{display:none;border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(255,255,255,.045);color:#fff;padding:8px 10px;font:inherit;font-size:.64rem;font-weight:900;cursor:pointer}
      .results-v2-pick[data-v3-tier="perfect"]{border-color:rgba(255,209,102,.14)}.results-v2-pick[data-v3-tier="elite"]{border-color:rgba(0,255,135,.12)}
      @media(max-width:760px){
        .results-v3-verdict{grid-template-columns:minmax(0,1fr) 66px;gap:10px;padding:14px}.results-v3-verdict-grade{min-width:62px;min-height:62px;border-radius:16px}.results-v3-verdict-grade strong{font-size:1.4rem}
        .results-v3-key-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.results-v3-key-card{padding:10px}
        .results-v3-details-toggle{display:inline-flex;align-items:center;justify-content:center;margin-top:10px}
        .results-v2-analysis[data-mobile-collapsed="true"] .results-v2-picks{display:none}
        .results-v2-analysis[data-mobile-collapsed="true"]{padding-bottom:13px}
      }
      @media(max-width:430px){.results-v3-verdict-copy h3{font-size:1.03rem}.results-v3-verdict-copy p{font-size:.68rem}.results-v3-chip-row{gap:5px}.results-v3-chip-row span{font-size:.55rem}.results-v3-key-card strong{font-size:.78rem}.results-v3-key-card small{font-size:.58rem}}
    `;
    document.head.appendChild(style);
  }

  function renderVerdict(model) {
    const verdict = verdictFor(model);
    const headline = document.getElementById("resultHeadline");
    const summary = document.getElementById("resultSummary");
    if (headline) headline.textContent = `${model.efficiency.toFixed(1)}% — ${verdict.label}`;
    if (summary) {
      summary.textContent = model.pointsToPerfect
        ? `${model.pointsToPerfect.toLocaleString()} points behind the highest-scoring unique-player XI · ${model.perfectPicks}/11 prompt-best picks.`
        : `You matched the highest-scoring unique-player XI · ${model.perfectPicks}/11 prompt-best picks.`;
    }

    let panel = document.getElementById("resultsV3Verdict");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "resultsV3Verdict";
      panel.className = "results-v3-verdict";
      document.getElementById("resultsV2Scoreboard")?.insertAdjacentElement("afterend", panel);
    }
    panel.dataset.tone = verdict.tone;
    panel.innerHTML = `
      <div class="results-v3-verdict-copy">
        <span class="results-v3-verdict-kicker">Match report</span>
        <h3>${esc(verdict.label)}</h3>
        <p>${esc(verdict.copy)} ${model.pointsToPerfect ? `<strong>${model.pointsToPerfect.toLocaleString()} points</strong> separated your XI from perfect.` : ""}</p>
        <div class="results-v3-chip-row"><span>${esc(model.time)} time</span><span>${model.penalties.toLocaleString()} penalties</span><span>${model.perfectPicks}/11 prompt bests</span></div>
      </div>
      <div class="results-v3-verdict-grade"><strong>${esc(model.grade)}</strong><span>Grade</span></div>`;
  }

  function renderKeyGrid(model) {
    let grid = document.getElementById("resultsV3KeyGrid");
    if (!grid) {
      grid = document.createElement("section");
      grid.id = "resultsV3KeyGrid";
      grid.className = "results-v3-key-grid";
      const analysis = document.getElementById("resultsV2Analysis");
      if (analysis) analysis.insertAdjacentElement("beforebegin", grid);
      else document.getElementById("resultsV3Verdict")?.insertAdjacentElement("afterend", grid);
    }

    const strongest = model.strongest;
    const biggest = model.biggestGap;
    const strongestDetail = strongest
      ? strongest.gap === 0 ? `${strongest.position} · ${strongest.rankText}` : `${strongest.position} · ${strongest.efficiency.toFixed(0)}% of prompt best`
      : "No pick data";
    const biggestDetail = biggest
      ? biggest.gap > 0 ? `${biggest.position} · ${biggest.gap.toLocaleString()} pts available` : "No prompt-level gap"
      : "No pick data";

    grid.innerHTML = `
      <article class="results-v3-key-card good"><span>Best pick</span><strong>${esc(strongest?.name || "—")}</strong><small>${esc(strongestDetail)}</small></article>
      <article class="results-v3-key-card ${biggest?.gap ? "gap" : "good"}"><span>Biggest opportunity</span><strong>${esc(biggest?.name || "—")}</strong><small>${esc(biggestDetail)}</small></article>
      <article class="results-v3-key-card warn"><span>Top-three picks</span><strong>${model.topThree}/11</strong><small>Ranked in the top three valid scores.</small></article>
      <article class="results-v3-key-card good"><span>90%+ picks</span><strong>${model.eliteOrBetter}/11</strong><small>Reached at least 90% of the prompt best.</small></article>`;
  }

  function enhancePickRows(model) {
    const nodes = [...document.querySelectorAll("#resultsV2Analysis .results-v2-pick")];
    nodes.forEach((node, index) => {
      const pick = model.picks[index];
      if (pick) node.dataset.v3Tier = pick.tier;
    });
  }

  function enhanceAnalysis(model) {
    const panel = document.getElementById("resultsV2Analysis");
    const head = panel?.querySelector(".results-v2-analysis-head");
    if (!panel || !head) return;

    let toggle = head.querySelector(".results-v3-details-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "results-v3-details-toggle";
      head.appendChild(toggle);
      toggle.addEventListener("click", () => {
        mobileDetailsExpanded = !mobileDetailsExpanded;
        panel.dataset.mobileCollapsed = mobileDetailsExpanded ? "false" : "true";
        toggle.textContent = mobileDetailsExpanded ? "Hide pick details" : `Show all ${model.picks.length} picks`;
        toggle.setAttribute("aria-expanded", String(mobileDetailsExpanded));
      });
    }
    panel.dataset.mobileCollapsed = mobileDetailsExpanded ? "false" : "true";
    toggle.textContent = mobileDetailsExpanded ? "Hide pick details" : `Show all ${model.picks.length} picks`;
    toggle.setAttribute("aria-expanded", String(mobileDetailsExpanded));
  }

  function render() {
    renderQueued = false;
    if (results.classList.contains("hidden")) return;
    const model = snapshot();
    if (!model) return;
    const signature = `${model.finalScore}|${model.perfectScore}|${model.efficiency}|${model.picks.length}|${model.penalties}`;
    const complete = document.getElementById("resultsV3Verdict") && document.getElementById("resultsV3KeyGrid") && document.querySelector(".results-v3-details-toggle");
    if (signature === lastSignature && complete) return;
    lastSignature = signature;
    installStyles();
    renderVerdict(model);
    renderKeyGrid(model);
    enhancePickRows(model);
    enhanceAnalysis(model);
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => window.setTimeout(render, 0));
  }

  const observer = new MutationObserver(scheduleRender);
  observer.observe(results, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("fpl:challenge-completed", scheduleRender);
  scheduleRender();
})();
