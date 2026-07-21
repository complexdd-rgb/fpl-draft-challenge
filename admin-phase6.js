(() => {
  "use strict";

  const REQUIRED_FORMATION = Object.freeze({ GK: 1, DEF: 4, MID: 4, FWD: 2 });
  const LIVE_FILE = "todays-challenge.js";
  const elements = {
    publishingStatus: document.querySelector("#publishingStatus"),
    readyChip: document.querySelector("#publishReadyChip"),
    liveTitle: document.querySelector("#liveChallengeTitle"),
    liveMeta: document.querySelector("#liveChallengeMeta"),
    candidateTitle: document.querySelector("#candidateChallengeTitle"),
    candidateMeta: document.querySelector("#candidateChallengeMeta"),
    finalStatus: document.querySelector("#publishFinalStatus"),
    finalReason: document.querySelector("#publishFinalReason"),
    stateCard: document.querySelector(".publish-state-card"),
    comparison: document.querySelector("#publishComparison"),
    checklist: document.querySelector("#publishChecklist"),
    refreshButton: document.querySelector("#refreshPublishChecksBtn"),
    downloadButton: document.querySelector("#downloadPublishPackBtn"),
    actionStatus: document.querySelector("#publishActionStatus"),
    testChip: document.querySelector("#testPassChip"),
    recordHistoryButton: document.querySelector("#recordHistoryBtn"),
    challengeNumber: document.querySelector("#challengeNumber"),
    challengeName: document.querySelector("#challengeName"),
    releaseDate: document.querySelector("#releaseDate"),
    minAnswers: document.querySelector("#minAnswers"),
    maxAnswers: document.querySelector("#maxAnswers")
  };

  let liveChallenge = null;
  let liveSource = "";
  let liveLoadError = "";
  let lastReport = null;
  let refreshTimer = null;

  window.addEventListener("load", initialise, { once: true });

  function initialise() {
    if (!elements.checklist) return;
    bindEvents();
    observeStudioChanges();
    loadLiveChallenge();
    scheduleRefresh();
  }

  function bindEvents() {
    elements.refreshButton?.addEventListener("click", async () => {
      elements.actionStatus.textContent = "Refreshing the live challenge and checklist…";
      await loadLiveChallenge();
      refreshPublishingCentre();
    });
    elements.downloadButton?.addEventListener("click", downloadPublishingPack);
    [elements.challengeNumber, elements.challengeName, elements.releaseDate, elements.minAnswers, elements.maxAnswers]
      .filter(Boolean)
      .forEach(input => input.addEventListener("input", scheduleRefresh));
    document.addEventListener("fplstudio:draftchange", scheduleRefresh);
    document.addEventListener("click", event => {
      if (event.target.closest("#autoTestBtn, #recordHistoryBtn, [data-history-action], #generateBtn, [data-reroll], [data-replace]")) {
        setTimeout(scheduleRefresh, 120);
      }
    });
  }

  function observeStudioChanges() {
    const targets = [
      document.querySelector("#testPassChip"),
      document.querySelector("#historyList"),
      document.querySelector("#codeOutput"),
      document.querySelector("#promptSlots")
    ].filter(Boolean);
    const observer = new MutationObserver(scheduleRefresh);
    targets.forEach(target => observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "disabled"]
    }));
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshPublishingCentre, 80);
  }

  async function loadLiveChallenge() {
    liveLoadError = "";
    liveChallenge = null;
    liveSource = "";
    setLiveCardLoading();
    try {
      const response = await fetch(`${LIVE_FILE}?studioPhase6=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
      liveSource = await response.text();
      const parsed = parseChallengeSource(liveSource);
      if (!parsed || !Array.isArray(parsed.prompts)) throw new Error("The file did not create a valid FPL_DAILY_CHALLENGE object");
      liveChallenge = parsed;
    } catch (error) {
      liveLoadError = error instanceof Error ? error.message : String(error);
    }
    renderLiveCard();
  }

  function setLiveCardLoading() {
    if (elements.liveTitle) elements.liveTitle.textContent = "Loading…";
    if (elements.liveMeta) elements.liveMeta.textContent = `Fetching ${LIVE_FILE}`;
  }

  function renderLiveCard() {
    if (!elements.liveTitle || !elements.liveMeta) return;
    if (!liveChallenge) {
      elements.liveTitle.textContent = "Live challenge unavailable";
      elements.liveMeta.textContent = liveLoadError || `Could not read ${LIVE_FILE}`;
      return;
    }
    elements.liveTitle.textContent = challengeDisplayTitle(liveChallenge);
    elements.liveMeta.textContent = `#${Number(liveChallenge.number) || "—"} · ${liveChallenge.releaseDate || "No date"} · ${Number(liveChallenge.perfectScore || 0).toLocaleString()} perfect score`;
  }

  function refreshPublishingCentre() {
    const core = window.FPL_STUDIO_API;
    if (!core) {
      renderUnavailable("Challenge Studio core is still loading.");
      return;
    }

    const prompts = core.getSelectedPrompts?.() || [];
    const perfect = core.getPerfectResult?.() || null;
    const meta = core.getChallengeMeta?.() || null;
    const candidate = meta?.code ? safeParseChallengeSource(meta.code) : null;
    const history = window.FPL_STUDIO_PHASE3?.getHistory?.() || [];
    const report = buildReport({ prompts, perfect, meta, candidate, history });
    lastReport = report;
    renderCandidateCard(report);
    renderComparison(report);
    renderChecklist(report);
    renderFinalStatus(report);
  }

  function renderUnavailable(message) {
    if (elements.candidateTitle) elements.candidateTitle.textContent = "Studio still loading";
    if (elements.candidateMeta) elements.candidateMeta.textContent = message;
    if (elements.checklist) elements.checklist.innerHTML = checklistCard("pending", "Waiting for Studio", message);
    setFinalState("blocked", "Not ready", message, "Waiting for draft");
    if (elements.downloadButton) elements.downloadButton.disabled = true;
  }

  function buildReport({ prompts, perfect, meta, candidate, history }) {
    const checks = [];
    const promptIds = prompts.map(prompt => prompt.id);
    const promptIdSet = new Set(promptIds);
    const formation = countFormation(prompts);
    const hasDraft = prompts.length > 0;
    const minAnswers = clampNumber(elements.minAnswers?.value, 2, 999, 6);
    const maxAnswers = clampNumber(elements.maxAnswers?.value, minAnswers, 9999, 100);
    const core = window.FPL_STUDIO_API;

    addCheck(checks, hasDraft ? "pass" : "pending", "Generated draft exists",
      hasDraft ? `${prompts.length} prompt slots are loaded.` : "Generate or load a draft XI above.", true);

    addCheck(checks, prompts.length === 11 ? "pass" : hasDraft ? "fail" : "pending", "Exactly 11 prompts",
      prompts.length === 11 ? "The challenge contains eleven prompt slots." : `Found ${prompts.length}; exactly 11 are required.`, true);

    const formationValid = Object.entries(REQUIRED_FORMATION).every(([position, count]) => formation[position] === count);
    addCheck(checks, formationValid ? "pass" : hasDraft ? "fail" : "pending", "Valid 1–4–4–2 formation",
      formationValid ? "1 GK · 4 DEF · 4 MID · 2 FWD." : `Current formation: ${formationText(formation)}.`, true);

    const uniquePromptIds = promptIds.length === promptIdSet.size && promptIds.every(Boolean);
    addCheck(checks, uniquePromptIds ? "pass" : hasDraft ? "fail" : "pending", "Unique prompt IDs",
      uniquePromptIds ? "No prompt ID is repeated." : "One or more prompt IDs are missing or duplicated.", true);

    const allEnabled = hasDraft && prompts.every(prompt => prompt.enabled !== false);
    addCheck(checks, allEnabled ? "pass" : hasDraft ? "fail" : "pending", "All selected prompts enabled",
      allEnabled ? "Every selected prompt is enabled in the library." : "A disabled prompt is present in the draft.", true);

    let rangeProblems = [];
    if (hasDraft && core?.getPromptStats) {
      rangeProblems = prompts.map(prompt => ({ prompt, stats: core.getPromptStats(prompt) }))
        .filter(item => item.stats.playerCount < minAnswers || item.stats.playerCount > maxAnswers);
    }
    addCheck(checks, !hasDraft ? "pending" : rangeProblems.length ? "fail" : "pass", "Answer pools within limits",
      !hasDraft ? "Generate a draft to check answer totals." : rangeProblems.length
        ? `${rangeProblems.length} prompt(s) fall outside ${minAnswers}–${maxAnswers} valid players.`
        : `Every prompt has ${minAnswers}–${maxAnswers} valid players.`, true);

    const perfectValid = Boolean(perfect?.possible && Number(perfect.score) > 0 && Array.isArray(perfect.picks) && perfect.picks.length === 11);
    addCheck(checks, perfectValid ? "pass" : hasDraft ? "fail" : "pending", "Exact perfect score calculated",
      perfectValid ? `${Number(perfect.score).toLocaleString()} points using eleven unique footballers.` : "The exact unique-player perfect score is unavailable.", true);

    const codeValid = Boolean(candidate && candidate.prompts?.length === 11 && Number(candidate.perfectScore) === Number(perfect?.score));
    const codePromptIds = candidate?.prompts?.map(prompt => prompt.id) || [];
    const codeMatchesDraft = codeValid && arraysEqual(codePromptIds, promptIds);
    addCheck(checks, codeMatchesDraft ? "pass" : hasDraft ? "fail" : "pending", "Downloaded JavaScript matches draft",
      codeMatchesDraft ? "The generated file contains the same prompt order and perfect score." : "The generated JavaScript is missing, invalid, or out of sync with the draft.", true);

    const automaticPassed = Boolean(elements.testChip?.classList.contains("test-pass"));
    addCheck(checks, automaticPassed ? "pass" : hasDraft ? "fail" : "pending", "Automatic Test Mode checks passed",
      automaticPassed ? "The current draft passed the Studio's automatic tests." : "Run automatic checks in Test Mode after the final reroll.", true);

    const metaNumber = Number(meta?.number || candidate?.number || 0);
    const metaDate = String(meta?.releaseDate || candidate?.releaseDate || "");
    const liveNumber = Number(liveChallenge?.number || 0);
    const liveDate = String(liveChallenge?.releaseDate || "");
    const candidateSignature = signatureFor(candidate || { prompts });
    const liveSignature = signatureFor(liveChallenge);

    const numberClashLive = Boolean(liveChallenge && metaNumber === liveNumber && candidateSignature !== liveSignature);
    const numberBehindLive = Boolean(liveChallenge && metaNumber < liveNumber);
    addCheck(checks,
      !hasDraft ? "pending" : numberClashLive || numberBehindLive ? "fail" : liveChallenge && metaNumber !== liveNumber + 1 ? "warning" : "pass",
      "Challenge number checked",
      !hasDraft ? "Generate a draft to compare its number." : numberClashLive
        ? `Challenge #${metaNumber} is already live with different prompts.`
        : numberBehindLive
          ? `Challenge #${metaNumber} is behind live Challenge #${liveNumber}.`
          : liveChallenge && metaNumber !== liveNumber + 1
            ? `Live is #${liveNumber}; the prepared challenge is #${metaNumber}, not the expected next number.`
            : liveChallenge ? `Prepared challenge is the expected next number: #${metaNumber}.` : `Prepared challenge number is #${metaNumber}.`,
      numberClashLive || numberBehindLive);

    const dateClashLive = Boolean(liveChallenge && metaDate && metaDate === liveDate && candidateSignature !== liveSignature);
    const dateBeforeLive = Boolean(liveChallenge && metaDate && liveDate && metaDate < liveDate);
    addCheck(checks, !hasDraft ? "pending" : !metaDate ? "fail" : dateClashLive || dateBeforeLive ? "fail" : "pass", "Release date checked",
      !hasDraft ? "Generate a draft to compare dates." : !metaDate ? "No release date is set." : dateClashLive
        ? `${metaDate} is already used by the current live challenge.`
        : dateBeforeLive ? `${metaDate} is earlier than the live challenge date ${liveDate}.`
          : `Release date ${metaDate} is valid.`, true);

    const numberHistoryMatches = history.filter(entry => Number(entry.number) === metaNumber);
    const dateHistoryMatches = metaDate ? history.filter(entry => entry.releaseDate === metaDate && Number(entry.number) !== metaNumber) : [];
    const matchingHistory = numberHistoryMatches.find(entry => historySignature(entry) === candidateSignature);
    const conflictingNumberHistory = numberHistoryMatches.some(entry => historySignature(entry) !== candidateSignature);
    const historyState = !hasDraft ? "pending" : conflictingNumberHistory || dateHistoryMatches.length ? "fail" : matchingHistory ? "pass" : "fail";
    const historyDetail = !hasDraft ? "Generate and test a draft first." : conflictingNumberHistory
      ? `Challenge #${metaNumber} exists in history with different prompts.`
      : dateHistoryMatches.length ? `${metaDate} is already assigned to another challenge in history.`
        : matchingHistory ? "The tested draft is recorded in Challenge History." : "Record the tested challenge in history before publishing.";
    addCheck(checks, historyState, "Challenge History recorded without conflicts", historyDetail, true);

    const liveLoaded = Boolean(liveChallenge);
    addCheck(checks, liveLoaded ? "pass" : "fail", "Current live challenge loaded",
      liveLoaded ? `${challengeDisplayTitle(liveChallenge)} was read from ${LIVE_FILE}.` : `Could not read ${LIVE_FILE}: ${liveLoadError || "unknown error"}.`, true);

    const overlapCount = liveChallenge ? promptIds.filter(id => new Set(liveChallenge.prompts?.map(prompt => prompt.id) || []).has(id)).length : 0;
    addCheck(checks, !liveChallenge || !hasDraft ? "pending" : overlapCount >= 5 ? "warning" : "pass", "Prompt freshness versus live challenge",
      !liveChallenge || !hasDraft ? "Load both challenges to compare prompt overlap." : overlapCount
        ? `${overlapCount} of 11 prompt IDs are repeated from the live challenge.`
        : "No prompt IDs are repeated from the live challenge.", false);

    const failCount = checks.filter(check => check.state === "fail").length;
    const warningCount = checks.filter(check => check.state === "warning").length;
    const pendingCount = checks.filter(check => check.state === "pending").length;
    const ready = hasDraft && failCount === 0 && pendingCount === 0;

    return {
      prompts,
      perfect,
      meta,
      candidate,
      history,
      checks,
      formation,
      overlapCount,
      failCount,
      warningCount,
      pendingCount,
      ready,
      candidateSignature,
      liveSignature,
      matchingHistory
    };
  }

  function addCheck(checks, state, title, detail, blocking) {
    checks.push({ state, title, detail, blocking: blocking !== false });
  }

  function renderCandidateCard(report) {
    if (!elements.candidateTitle || !elements.candidateMeta) return;
    if (!report.candidate) {
      elements.candidateTitle.textContent = "No draft generated";
      elements.candidateMeta.textContent = "Generate, test and record a draft above";
      return;
    }
    elements.candidateTitle.textContent = challengeDisplayTitle(report.candidate);
    elements.candidateMeta.textContent = `#${Number(report.candidate.number) || "—"} · ${report.candidate.releaseDate || "No date"} · ${Number(report.candidate.perfectScore || 0).toLocaleString()} perfect score`;
  }

  function renderComparison(report) {
    if (!elements.comparison) return;
    const live = liveChallenge;
    const candidate = report.candidate;
    const items = [
      ["Challenge number", live ? `#${live.number}` : "—", candidate ? `#${candidate.number}` : "—"],
      ["Release date", live?.releaseDate || "—", candidate?.releaseDate || "—"],
      ["Difficulty", live?.difficulty || "—", candidate?.difficulty || "—"],
      ["Perfect score", live ? Number(live.perfectScore || 0).toLocaleString() : "—", candidate ? Number(candidate.perfectScore || 0).toLocaleString() : "—"],
      ["Repeated prompts", live && candidate ? `${report.overlapCount} / 11` : "—", report.overlapCount >= 5 ? "Review" : "Freshness check"]
    ];
    elements.comparison.innerHTML = items.map(([label, left, right]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(left)} → ${escapeHtml(right)}</strong></article>`).join("");
  }

  function renderChecklist(report) {
    if (!elements.checklist) return;
    elements.checklist.innerHTML = report.checks.map(check => checklistCard(check.state, check.title, check.detail)).join("");
  }

  function checklistCard(state, title, detail) {
    const icon = state === "pass" ? "✓" : state === "warning" ? "!" : state === "fail" ? "×" : "…";
    return `<article class="publish-check ${state}">
      <span class="publish-check-icon" aria-hidden="true">${icon}</span>
      <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>
    </article>`;
  }

  function renderFinalStatus(report) {
    if (elements.downloadButton) elements.downloadButton.disabled = !report.ready;
    if (!report.prompts.length) {
      setFinalState("blocked", "Not ready", "Generate a draft XI to begin the final checks.", "Waiting for draft");
    } else if (!report.ready) {
      const parts = [];
      if (report.failCount) parts.push(`${report.failCount} blocking check${report.failCount === 1 ? "" : "s"}`);
      if (report.pendingCount) parts.push(`${report.pendingCount} pending`);
      setFinalState("blocked", "Not ready", parts.join(" · ") || "Complete the checklist.", "Checks incomplete");
    } else if (report.warningCount) {
      setFinalState("warning", "Ready with warnings", `${report.warningCount} amber warning${report.warningCount === 1 ? "" : "s"} to review before upload.`, "Ready with warnings");
    } else {
      setFinalState("ready", "Ready to upload", "All final publishing checks passed.", "Ready to upload");
    }
    if (elements.publishingStatus) elements.publishingStatus.textContent = report.ready ? "Pack ready" : "Manual upload";
  }

  function setFinalState(state, heading, reason, chipText) {
    if (elements.finalStatus) elements.finalStatus.textContent = heading;
    if (elements.finalReason) elements.finalReason.textContent = reason;
    if (elements.readyChip) {
      elements.readyChip.textContent = chipText;
      elements.readyChip.classList.remove("publish-ready", "publish-warning", "publish-blocked", "ready-chip");
      elements.readyChip.classList.add(state === "ready" ? "publish-ready" : state === "warning" ? "publish-warning" : "publish-blocked");
    }
    if (elements.stateCard) {
      elements.stateCard.classList.remove("ready", "warning", "blocked");
      elements.stateCard.classList.add(state);
    }
  }

  async function downloadPublishingPack() {
    refreshPublishingCentre();
    const report = lastReport;
    if (!report?.ready || !report.meta?.code || !report.candidate) {
      elements.actionStatus.textContent = "The publishing pack is locked until every blocking check passes.";
      return;
    }

    try {
      elements.downloadButton.disabled = true;
      elements.downloadButton.textContent = "Building pack…";
      const history = report.history || [];
      const files = [
        { name: "UPLOAD/todays-challenge.js", content: ensureTrailingNewline(report.meta.code) },
        { name: "BACKUPS/challenge-history.json", content: buildHistoryJson(history) },
        { name: "BACKUPS/challenge-history.md", content: buildHistoryMarkdown(history) },
        { name: "BACKUPS/prompt-library.js", content: buildPromptLibrarySource() },
        { name: "BACKUPS/live-challenge-before-publish.js", content: liveSource ? ensureTrailingNewline(liveSource) : "/* Live challenge snapshot unavailable. */\n" },
        { name: "publish-manifest.json", content: buildManifest(report) },
        { name: "README-UPLOAD.txt", content: buildReadme(report) }
      ];
      const blob = buildZipBlob(files);
      const number = String(report.candidate.number || "next").padStart(3, "0");
      const filename = `fpl-challenge-${number}-publishing-pack.zip`;
      downloadBlob(filename, blob);
      elements.actionStatus.textContent = `${filename} downloaded. Extract it, then upload only UPLOAD/todays-challenge.js to GitHub.`;
    } catch (error) {
      console.error(error);
      elements.actionStatus.textContent = `The pack could not be created: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      elements.downloadButton.textContent = "Download publishing pack";
      elements.downloadButton.disabled = !lastReport?.ready;
    }
  }

  function buildHistoryJson(history) {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), challenges: sortHistory(history) }, null, 2) + "\n";
  }

  function buildHistoryMarkdown(history) {
    const lines = ["# FPL Daily Challenge History", "", `Exported: ${new Date().toLocaleString()}`, ""];
    for (const entry of sortHistory(history).reverse()) {
      lines.push(`## Challenge #${entry.number} · ${entry.name || entry.title || "Untitled"}`, "");
      lines.push(`- Release date: ${entry.releaseDate || "—"}`);
      lines.push(`- Difficulty: ${entry.difficulty || "Mixed"}`);
      lines.push(`- Perfect score: ${Number(entry.perfectScore || 0)}`);
      lines.push(`- Status: ${entry.status || "ready"}`, "");
      const labels = entry.promptLabels?.length ? entry.promptLabels : entry.promptIds || [];
      labels.forEach((label, index) => lines.push(`${index + 1}. ${label}`));
      lines.push("");
    }
    return lines.join("\n") + "\n";
  }

  function buildPromptLibrarySource() {
    const library = window.FPL_STUDIO_API?.getPromptLibrary?.() || window.FPL_PROMPT_LIBRARY || [];
    const promptsSource = library.map(prompt => {
      const testSource = typeof prompt.test === "function" ? prompt.test.toString() : "p => false";
      const studioRule = prompt.studioRule ? `,\n      studioRule: ${JSON.stringify(prompt.studioRule, null, 6).replace(/\n/g, "\n      ")}` : "";
      return `    {\n      id: ${JSON.stringify(prompt.id)},\n      position: ${JSON.stringify(prompt.position)},\n      label: ${JSON.stringify(prompt.label)},\n      fail: ${JSON.stringify(prompt.fail)},\n      difficulty: ${JSON.stringify(prompt.difficulty)},\n      tags: ${JSON.stringify(prompt.tags || [])},\n      rating: ${Number(prompt.rating) || 3},\n      cooldown: ${Number(prompt.cooldown) || 0},\n      enabled: ${prompt.enabled !== false}${studioRule},\n      test: ${testSource}\n    }`;
    }).join(",\n");
    const recent = Array.isArray(window.FPL_RECENT_PROMPT_IDS) ? window.FPL_RECENT_PROMPT_IDS : [];
    return `/* FPL Challenge Studio prompt library backup — exported by Phase 6. */\n(() => {\n  \"use strict\";\n\n  window.FPL_PROMPT_LIBRARY = [\n${promptsSource}\n  ];\n\n  window.FPL_RECENT_PROMPT_IDS = ${JSON.stringify(recent, null, 2)};\n})();\n`;
  }

  function buildManifest(report) {
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      ready: report.ready,
      preparedChallenge: challengeSummary(report.candidate),
      liveChallengeBeforePublish: challengeSummary(liveChallenge),
      repeatedPromptIds: report.prompts.map(prompt => prompt.id).filter(id => new Set(liveChallenge?.prompts?.map(prompt => prompt.id) || []).has(id)),
      checks: report.checks,
      instructions: "Replace only todays-challenge.js in the root of the GitHub repository. Keep every BACKUPS file locally."
    };
    return JSON.stringify(payload, null, 2) + "\n";
  }

  function buildReadme(report) {
    return [
      "FPL DAILY CHALLENGE — PHASE 6 PUBLISHING PACK",
      "================================================",
      "",
      `Prepared: ${challengeDisplayTitle(report.candidate)}`,
      `Challenge number: ${report.candidate.number}`,
      `Release date: ${report.candidate.releaseDate}`,
      `Perfect score: ${report.candidate.perfectScore}`,
      "",
      "UPLOAD THIS ONE FILE",
      "--------------------",
      "1. Extract this ZIP on your computer.",
      "2. Open the UPLOAD folder.",
      "3. Upload todays-challenge.js to the main/root of your GitHub repository.",
      "4. Replace the existing file and commit the change.",
      "5. Wait for GitHub Pages to finish, then refresh the live game with Ctrl + F5.",
      "",
      "DO NOT upload the ZIP itself. GitHub will not unpack it.",
      "DO NOT replace index.html, players.js, admin files or prompt-library.js when publishing the daily challenge.",
      "",
      "BACKUPS",
      "-------",
      "The BACKUPS folder contains the history, prompt library and the live challenge file that was present before this pack was created.",
      "",
      `Final Studio result: ${report.warningCount ? `READY WITH ${report.warningCount} WARNING(S)` : "ALL CHECKS PASSED"}`,
      ""
    ].join("\n");
  }

  function challengeSummary(challenge) {
    if (!challenge) return null;
    return {
      id: challenge.id || "",
      number: Number(challenge.number) || 0,
      title: challenge.title || "",
      releaseDate: challenge.releaseDate || "",
      difficulty: challenge.difficulty || "",
      perfectScore: Number(challenge.perfectScore) || 0,
      promptIds: Array.isArray(challenge.prompts) ? challenge.prompts.map(prompt => prompt.id) : []
    };
  }

  function parseChallengeSource(source) {
    const sandbox = Object.create(null);
    const evaluate = new Function("window", `\"use strict\";\n${source}\nreturn window.FPL_DAILY_CHALLENGE || null;`);
    return evaluate(sandbox);
  }

  function safeParseChallengeSource(source) {
    try { return parseChallengeSource(source); }
    catch (error) { return null; }
  }

  function challengeDisplayTitle(challenge) {
    if (!challenge) return "No challenge";
    return challenge.title || `Challenge #${challenge.number || "—"}`;
  }

  function countFormation(prompts) {
    const formation = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const prompt of prompts || []) if (formation[prompt.position] != null) formation[prompt.position] += 1;
    return formation;
  }

  function formationText(formation) {
    return `${formation.GK || 0} GK · ${formation.DEF || 0} DEF · ${formation.MID || 0} MID · ${formation.FWD || 0} FWD`;
  }

  function signatureFor(challenge) {
    if (!challenge) return "";
    const ids = Array.isArray(challenge.prompts) ? challenge.prompts.map(prompt => prompt.id || "") : [];
    return `${Number(challenge.number) || 0}|${challenge.releaseDate || ""}|${ids.join("|")}`;
  }

  function historySignature(entry) {
    if (!entry) return "";
    const ids = Array.isArray(entry.promptIds) ? entry.promptIds : [];
    return `${Number(entry.number) || 0}|${entry.releaseDate || ""}|${ids.join("|")}`;
  }

  function arraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function sortHistory(history) {
    return [...history].sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
  }

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function ensureTrailingNewline(value) {
    return String(value || "").replace(/\s*$/, "\n");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  /* Minimal standards-compliant ZIP writer using stored (uncompressed) entries.
     This keeps Phase 6 self-contained and avoids external libraries. */
  function buildZipBlob(files) {
    const encoder = new TextEncoder();
    const now = new Date();
    const dos = toDosDateTime(now);
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.name.replaceAll("\\", "/"));
      const dataBytes = typeof file.content === "string" ? encoder.encode(file.content) : new Uint8Array(file.content);
      const crc = crc32(dataBytes);
      const localHeader = concatBytes(
        uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0),
        uint16(dos.time), uint16(dos.date), uint32(crc), uint32(dataBytes.length), uint32(dataBytes.length),
        uint16(nameBytes.length), uint16(0), nameBytes, dataBytes
      );
      localParts.push(localHeader);

      const centralHeader = concatBytes(
        uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0),
        uint16(dos.time), uint16(dos.date), uint32(crc), uint32(dataBytes.length), uint32(dataBytes.length),
        uint16(nameBytes.length), uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes
      );
      centralParts.push(centralHeader);
      offset += localHeader.length;
    }

    const centralDirectory = concatBytes(...centralParts);
    const endRecord = concatBytes(
      uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
      uint32(centralDirectory.length), uint32(offset), uint16(0)
    );
    return new Blob([...localParts, centralDirectory, endRecord], { type: "application/zip" });
  }

  function toDosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function uint16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value & 0xffff, true);
    return bytes;
  }

  function uint32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
  }

  function concatBytes(...parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      table[index] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.FPL_STUDIO_PHASE6 = Object.freeze({
    refresh: refreshPublishingCentre,
    getReport: () => lastReport,
    reloadLiveChallenge: loadLiveChallenge,
    buildZipBlob
  });
})();
