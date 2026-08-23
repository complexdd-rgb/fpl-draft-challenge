/* FPL Draft Challenge — gameplay roadmap phase 1.
   Adds Give Up (0-point completed prompts) and removes the legacy public selection explainer. */
(() => {
  "use strict";

  if (typeof challenge === "undefined" || !challenge?.prompts?.length || typeof render !== "function") return;

  const GIVE_UP_STORE = `${STORE}:giveups`;
  const promptIds = new Set(challenge.prompts.map(prompt => prompt.id));
  const skippedPrompts = new Set();

  function restoreSkippedPrompts() {
    const absorb = values => {
      if (!Array.isArray(values)) return;
      values.forEach(id => { if (promptIds.has(id)) skippedPrompts.add(id); });
    };
    try { absorb(JSON.parse(localStorage.getItem(GIVE_UP_STORE) || "[]")); } catch {}
    try {
      const payload = JSON.parse(localStorage.getItem(STORE) || "{}");
      absorb(payload?.skippedPrompts);
      absorb(payload?.completedRecord?.skippedPrompts);
    } catch {}
    absorb(completedRecord?.skippedPrompts);
    for (const id of [...skippedPrompts]) if (picks[id]) skippedPrompts.delete(id);
  }

  function persistSkippedPrompts() {
    try { localStorage.setItem(GIVE_UP_STORE, JSON.stringify([...skippedPrompts])); } catch {}
  }

  function isResolved(prompt) {
    return Boolean(picks[prompt.id]) || skippedPrompts.has(prompt.id);
  }

  function allResolved() {
    return challenge.prompts.every(isResolved);
  }

  function firstOpenPrompt() {
    return challenge.prompts.find(prompt => !isResolved(prompt)) || null;
  }

  function skippedRecord(prompt) {
    return {
      playerId: null,
      name: "No pick",
      season: "—",
      club: "Given up",
      position: prompt.position,
      points: 0,
      minutes: 0,
      skipped: true
    };
  }

  function addStyles() {
    if (document.getElementById("giveUpRoadmapStyles")) return;
    const style = document.createElement("style");
    style.id = "giveUpRoadmapStyles";
    style.textContent = `
      .give-up-row{display:flex;justify-content:flex-end;margin-top:9px}
      .give-up{border:1px solid rgba(255,145,167,.35);border-radius:10px;padding:8px 11px;background:rgba(255,90,120,.07);color:#ffafbf;font-size:.7rem;font-weight:900;cursor:pointer}
      .give-up:hover{border-color:rgba(255,145,167,.62);background:rgba(255,90,120,.12)}
      .slot.given-up{border-color:rgba(255,209,102,.42);background:linear-gradient(145deg,rgba(66,52,22,.72),rgba(25,29,20,.96));box-shadow:0 10px 28px rgba(0,0,0,.18)}
      .slot.given-up::after{content:"0";background:#ffd166;color:#2c2105}
      .slot.given-up .confirmed-player strong{color:#ffd166}
      .slot.given-up .compact-efficiency{border-color:rgba(255,209,102,.34);background:rgba(255,209,102,.07)}
      .slot.given-up .compact-efficiency strong{color:#ffd166}
      .slot.given-up .compact-track span{background:#ffd166}
      .reopen-give-up{margin:0;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 10px;background:#142a20;color:#d9eee1;font-size:.68rem;font-weight:900;cursor:pointer}
      .reopen-give-up:hover{border-color:rgba(255,209,102,.45);color:#ffd166}
    `;
    document.head.appendChild(style);
  }


  const baseSave = save;
  save = function saveWithGiveUps() {
    baseSave();
    persistSkippedPrompts();
    try {
      const payload = JSON.parse(localStorage.getItem(STORE) || "{}");
      payload.skippedPrompts = [...skippedPrompts];
      if (payload.completedRecord && completedRecord?.skippedPrompts) {
        payload.completedRecord.skippedPrompts = [...completedRecord.skippedPrompts];
      }
      localStorage.setItem(STORE, JSON.stringify(payload));
    } catch {}
  };

  const baseUpdateStatus = updateStatus;
  updateStatus = function updateStatusWithGiveUps() {
    baseUpdateStatus();
    const completed = challenge.prompts.filter(isResolved).length;
    const total = challenge.prompts.length;
    const percent = total ? Math.max(0, Math.min(100, completed / total * 100)) : 0;
    const progress = document.getElementById("progress");
    const revealButton = document.getElementById("reveal");
    const dockProgress = document.getElementById("dockProgress");
    const dockBar = document.getElementById("dockProgressBar");
    const nextButton = document.getElementById("jumpToNext");
    if (progress) progress.textContent = `${completed} / ${total} complete`;
    if (revealButton) revealButton.disabled = completed !== total || Boolean(completedRecord);
    if (dockProgress) dockProgress.textContent = `${completed}/${total}`;
    if (dockBar) dockBar.style.width = `${percent}%`;
    if (nextButton) nextButton.textContent = completed === total ? "Reveal completed XI" : "Next open pick";
  };

  function decorateGiveUpControls() {
    for (const prompt of challenge.prompts) {
      const slot = document.getElementById(`slot-${prompt.id}`);
      if (!slot) continue;

      if (skippedPrompts.has(prompt.id) && !picks[prompt.id]) {
        slot.className = "slot valid compact-confirmed given-up";
        slot.dataset.position = prompt.position;
        slot.innerHTML = `
          <div class="slot-head"><span class="pos">${prompt.position}</span><div><div class="prompt">${challenge.prompts.indexOf(prompt) + 1}. ${esc(prompt.label)}</div></div></div>
          <div class="confirmed-summary">
            <div class="confirmed-player"><strong>Given up · 0 points</strong><span>No footballer selected for this prompt.</span></div>
            <div class="compact-efficiency" data-tier="risky" title="This prompt scores zero points"><span>Surrendered</span><strong>0%</strong></div>
            ${completedRecord ? '<button class="reopen-give-up attempt-locked" type="button" disabled>Completed</button>' : `<button class="reopen-give-up" data-reopen-give-up="${prompt.id}" type="button">Reopen</button>`}
          </div>
          <div class="compact-track" aria-hidden="true"><span style="width:0%"></span></div>`;
        continue;
      }

      if (!picks[prompt.id] && !completedRecord) {
        const feedbackNode = slot.querySelector(".feedback");
        if (feedbackNode && !slot.querySelector("[data-give-up]")) {
          const row = document.createElement("div");
          row.className = "give-up-row";
          row.innerHTML = `<button class="give-up" data-give-up="${prompt.id}" type="button">Give up · 0 points</button>`;
          feedbackNode.after(row);
        }
      }
    }

    document.querySelectorAll("[data-give-up]").forEach(button => button.addEventListener("click", () => giveUp(button.dataset.giveUp)));
    document.querySelectorAll("[data-reopen-give-up]").forEach(button => button.addEventListener("click", () => reopenGiveUp(button.dataset.reopenGiveUp)));
  }

  const baseRender = render;
  render = function renderWithGiveUps() {
    baseRender();
    decorateGiveUpControls();
    updateStatus();
  };

  function moveToNextOpen() {
    const openPrompt = firstOpenPrompt();
    if (!openPrompt) {
      const revealButton = document.getElementById("reveal");
      revealButton?.scrollIntoView({ behavior: "smooth", block: "center" });
      revealButton?.focus();
      return;
    }
    const slot = document.getElementById(`slot-${openPrompt.id}`);
    slot?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => slot?.querySelector(".player-search")?.focus(), 300);
  }

  function giveUp(id) {
    if (completedRecord || !promptIds.has(id)) return;
    ensureStarted();
    delete picks[id];
    delete drafts[id];
    feedback[id] = "";
    skippedPrompts.add(id);
    save();
    render();
    moveToNextOpen();
    window.dispatchEvent(new CustomEvent("fpl:prompt-given-up", { detail: { challengeId: challenge.id, promptId: id } }));
  }

  function reopenGiveUp(id) {
    if (completedRecord || !skippedPrompts.has(id)) return;
    skippedPrompts.delete(id);
    persistSkippedPrompts();
    save();
    render();
    const slot = document.getElementById(`slot-${id}`);
    slot?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => slot?.querySelector(".player-search")?.focus(), 250);
  }

  reveal = function revealWithGiveUps(restoring = false) {
    if (!restoring && completedRecord) { renderCompletedResult(completedRecord, true); return; }
    if (restoring && Array.isArray(completedRecord?.skippedPrompts)) {
      completedRecord.skippedPrompts.forEach(id => { if (promptIds.has(id)) skippedPrompts.add(id); });
    }
    if (!allResolved()) return;

    ensureStarted();
    const rows = challenge.prompts.map(prompt => skippedPrompts.has(prompt.id)
      ? skippedRecord(prompt)
      : getRecord(picks[prompt.id]?.playerId, picks[prompt.id]?.season));
    if (rows.some(row => !row)) return;

    const now = Date.now();
    completedSeconds = restoring && completedRecord ? Number(completedRecord.elapsedSeconds) || 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
    clearInterval(timerId);
    const points = rows.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
    const score = points - penalties;
    const eff = challenge.perfectScore > 0 ? score / challenge.perfectScore * 100 : 0;
    const grade = eff >= 100 ? "Perfect" : eff >= 95 ? "A+" : eff >= 90 ? "A" : eff >= 82 ? "B" : eff >= 72 ? "C" : "D";
    const boundedEfficiency = Math.max(0, Math.min(100, eff));
    const headline = eff >= 100 ? "A perfect historical XI" : eff >= 95 ? "An elite draft-board performance" : eff >= 85 ? "A strong historical XI" : eff >= 70 ? "A competitive XI with room to climb" : "A brave XI with points left available";
    const ring = document.getElementById("resultRing");
    if (ring) ring.style.setProperty("--result-progress", `${boundedEfficiency * 3.6}deg`);
    document.getElementById("resultEfficiencyHero").textContent = `${eff.toFixed(1)}%`;
    document.getElementById("resultGradeHero").textContent = grade;
    document.getElementById("resultHeadline").textContent = headline;
    document.getElementById("resultSummary").textContent = `${points.toLocaleString()} player points, ${penalties ? `${penalties} penalty points` : "no penalties"}, completed in ${formatTime(completedSeconds)}.`;
    if (!restoring) showCompletionMoment(grade, eff, score);

    const perfect = calculatePerfectXI();
    let exactMatches = 0;
    if (perfect) {
      const comparedUser = rows.map((row, index) => ({ ...row, exactMatch: !row.skipped && perfect.rows[index].playerId === row.playerId && perfect.rows[index].season === row.season }));
      const comparedPerfect = perfect.rows.map((row, index) => ({ ...row, exactMatch: !rows[index].skipped && rows[index].playerId === row.playerId && rows[index].season === row.season }));
      exactMatches = comparedUser.filter(row => row.exactMatch).length;
      document.getElementById("pitch").innerHTML = pitchMarkup(comparedUser, false);
      document.getElementById("perfectPitch").innerHTML = pitchMarkup(comparedPerfect, true);
      document.getElementById("perfectXiNote").textContent = `${exactMatches} of your ${challenge.prompts.length} selections exactly match the perfect XI. Calculated total: ${perfect.score.toLocaleString()} points.`;
    } else {
      document.getElementById("pitch").innerHTML = pitchMarkup(rows, false);
      document.getElementById("perfectPitch").innerHTML = '<p class="feedback bad">The perfect unique-player XI could not be calculated.</p>';
      document.getElementById("perfectXiNote").textContent = "";
    }

    document.getElementById("playerPoints").textContent = points;
    document.getElementById("penaltyPoints").textContent = penalties ? `−${penalties}` : "0";
    document.getElementById("finalScore").textContent = score;
    document.getElementById("perfectScore").textContent = challenge.perfectScore;
    document.getElementById("efficiency").textContent = `${eff.toFixed(1)}%`;
    document.getElementById("grade").textContent = grade;
    document.getElementById("timeTaken").textContent = formatTime(completedSeconds);
    const best = Math.max(Number(localStorage.getItem(BEST) || 0), score);
    localStorage.setItem(BEST, best);
    document.getElementById("bestScore").textContent = best;
    document.getElementById("reviews").innerHTML = challenge.prompts.map((prompt, index) => `<details class="review"><summary>${index + 1}. ${prompt.position} · ${esc(prompt.label)}</summary><ol>${topFive(prompt).map(row => `<li><strong>${esc(row.name)}</strong> — ${row.season} — ${row.points} pts <small>${esc(row.club)}</small></li>`).join("")}</ol></details>`).join("");

    if (!restoring) {
      const promptEfficiencies = rows.map((row, index) => row.skipped
        ? { picked: 0, best: promptBestPoints(challenge.prompts[index]), percentage: 0 }
        : pickEfficiencyDetails(row, challenge.prompts[index]));
      completedRecord = {
        version: 3,
        completed: true,
        official: !ARCHIVE_MODE,
        mode: ATTEMPT_MODE,
        challengeId: challenge.id,
        challengeNumber: Number(challenge.number) || null,
        challengeDate: challengeDate(),
        challengeTitle: challenge.title || "FPL Daily Challenge",
        startedAt,
        completedAt: now,
        elapsedSeconds: completedSeconds,
        penalties,
        playerPoints: points,
        finalScore: score,
        perfectScore: Number(challenge.perfectScore) || 0,
        calculatedPerfectScore: perfect?.score ?? null,
        perfectScoreVerified: perfect ? perfect.score === Number(challenge.perfectScore) : null,
        efficiency: Number(eff.toFixed(4)),
        grade,
        perfectPromptPicks: promptEfficiencies.filter((item, index) => !rows[index].skipped && item.picked === item.best).length,
        exactPerfectXiMatches: exactMatches,
        skippedPrompts: [...skippedPrompts],
        picks: { ...picks },
        selections: rows.map((row, index) => ({
          promptId: challenge.prompts[index].id,
          position: row.position,
          playerId: row.skipped ? null : row.playerId,
          name: row.skipped ? "Given up" : row.name,
          season: row.skipped ? null : row.season,
          club: row.skipped ? null : row.club,
          points: Number(row.points) || 0,
          skipped: Boolean(row.skipped),
          pickEfficiency: Number(promptEfficiencies[index].percentage.toFixed(4))
        }))
      };
      save();
      if (!ARCHIVE_MODE) upsertHistory(completedRecord); else renderLocalHistory();
      window.dispatchEvent(new CustomEvent("fpl:challenge-completed", { detail: { record: completedRecord } }));
    }

    document.getElementById("results").classList.remove("hidden");
    render();
    tick();
    if (!restoring) document.getElementById("results").scrollIntoView({ behavior: "smooth" });
  };

  document.getElementById("jumpToNext")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    moveToNextOpen();
  }, true);

  document.getElementById("reset")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (completedRecord) return;
    const message = ARCHIVE_MODE
      ? "Clear your practice XI? Your practice timer and any penalties will stay with this attempt."
      : "Clear your selected XI? Your official timer and any penalties will stay with this attempt.";
    if (!confirm(message)) return;
    picks = {};
    drafts = {};
    feedback = {};
    skippedPrompts.clear();
    persistSkippedPrompts();
    completedSeconds = null;
    document.getElementById("results")?.classList.add("hidden");
    save();
    render();
    tick();
  }, true);

  restoreSkippedPrompts();
  addStyles();
  render();
  if (completedRecord) renderCompletedResult(completedRecord, true);
})();
