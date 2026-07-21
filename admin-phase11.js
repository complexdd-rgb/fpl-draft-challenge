/* FPL Challenge Studio Phase 11 — conservative player identity consolidation. */
(() => {
  "use strict";

  const originalPlayers = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const promptLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const CORE_SEASON_FIELDS = ["club", "position", "points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice"];
  const NAME_PARTICLES = new Set(["de", "da", "do", "dos", "das", "del", "della", "di", "van", "von", "der", "den", "la", "le", "el", "al", "bin", "ibn", "st", "saint"]);
  const NICKNAME_GROUPS = [
    ["matthew", "matty", "matt"], ["robert", "rob", "robbie", "bob", "bobby"], ["alexander", "alex"], ["benjamin", "ben"],
    ["nicholas", "nick", "nicky"], ["christopher", "chris"], ["jonathan", "jon", "johnny"], ["joseph", "joe", "joey"],
    ["samuel", "sam", "sammy"], ["daniel", "dan", "danny"], ["edward", "ed", "eddie"], ["william", "will", "bill", "billy"],
    ["james", "jim", "jimmy"], ["thomas", "tom", "tommy"], ["anthony", "tony"], ["michael", "mike", "mikey"],
    ["patrick", "pat", "paddy"], ["timothy", "tim"], ["andrew", "andy"], ["charles", "charlie"],
    ["frederick", "fred", "freddie"], ["stephen", "steven", "steve"], ["philip", "phil"], ["nathaniel", "nathan"],
    ["theodore", "theo"], ["dominic", "dom"], ["maximilian", "max"]
  ];
  const NICKNAME_MAP = new Map();
  NICKNAME_GROUPS.forEach(group => group.forEach(name => NICKNAME_MAP.set(name, new Set(group))));

  const state = {
    candidates: [], selected: new Set(), workspace: null, mergeReport: [], checks: [], ready: false, liveChallenge: null
  };
  const elements = {};

  window.addEventListener("load", initialise, { once: true });

  function initialise() {
    [
      "identityCentreStatus", "identityPlayersScanned", "identitySafeCount", "identityReviewCount", "identityBlockedCount",
      "identityProjectedPlayers", "identityProjectedSeasons", "runIdentityScanBtn", "selectSafeIdentityBtn", "applyIdentityMergesBtn",
      "resetIdentityBtn", "identityActionStatus", "identityResultsPanel", "identityConfidenceFilter", "identitySearchInput",
      "identityShownCount", "identityCandidateList", "identityRegressionPanel", "runIdentityChecksBtn", "identityRegressionList",
      "identityDownloadPanel", "identityDownloadExplanation", "downloadIdentityPackBtn", "identityDownloadStatus"
    ].forEach(id => elements[id] = document.getElementById(id));
    if (!elements.runIdentityScanBtn) return;

    elements.runIdentityScanBtn.addEventListener("click", runScan);
    elements.selectSafeIdentityBtn.addEventListener("click", selectSafeCandidates);
    elements.applyIdentityMergesBtn.addEventListener("click", buildWorkspace);
    elements.resetIdentityBtn.addEventListener("click", resetWorkspace);
    elements.identityConfidenceFilter.addEventListener("change", renderCandidates);
    elements.identitySearchInput.addEventListener("input", renderCandidates);
    elements.identityCandidateList.addEventListener("change", onCandidateToggle);
    elements.runIdentityChecksBtn.addEventListener("click", runRegressionChecks);
    elements.downloadIdentityPackBtn.addEventListener("click", downloadPack);

    elements.identityPlayersScanned.textContent = originalPlayers.length.toLocaleString();
    elements.identityProjectedPlayers.textContent = originalPlayers.length.toLocaleString();
    elements.identityProjectedSeasons.textContent = seasonCount(originalPlayers).toLocaleString();

    window.FPL_STUDIO_PHASE11 = Object.freeze({
      scan: runScan,
      buildWorkspace,
      runChecks: runRegressionChecks,
      getCandidates: () => clone(state.candidates),
      getWorkspace: () => clone(state.workspace),
      getReport: () => clone(state.mergeReport)
    });
  }

  function runScan() {
    setStatus("Scanning names, aliases, clubs, seasons and birth dates…");
    state.candidates = findCandidates(originalPlayers);
    state.selected = new Set(state.candidates.filter(candidate => candidate.confidence === "safe").map(candidate => candidate.id));
    state.workspace = null;
    state.mergeReport = [];
    state.ready = false;
    updateSummary();
    elements.identityResultsPanel.classList.remove("hidden");
    elements.identityRegressionPanel.classList.add("hidden");
    elements.identityDownloadPanel.classList.add("hidden");
    elements.selectSafeIdentityBtn.disabled = !state.candidates.some(candidate => candidate.confidence === "safe");
    elements.applyIdentityMergesBtn.disabled = !state.selected.size;
    elements.identityCentreStatus.textContent = `${state.candidates.length} candidates`;
    renderCandidates();
    const safe = state.candidates.filter(candidate => candidate.confidence === "safe").length;
    const review = state.candidates.filter(candidate => candidate.confidence === "review").length;
    setStatus(`Scan complete: ${safe} safe merges and ${review} review candidates. Ambiguous same-name footballers remain protected.`);
  }

  function findCandidates(database) {
    const profiles = database.map(player => buildProfile(player));
    const pairKeys = new Set();
    const blocks = new Map();
    const addBlock = (key, index) => {
      if (!key) return;
      if (!blocks.has(key)) blocks.set(key, []);
      blocks.get(key).push(index);
    };
    profiles.forEach((profile, index) => {
      addBlock(`surname:${profile.lastToken}`, index);
      addBlock(`name:${profile.normalName}`, index);
      if (profile.dob) addBlock(`dob:${profile.dob}`, index);
    });

    const candidates = [];
    for (const indexes of blocks.values()) {
      if (indexes.length < 2) continue;
      for (let left = 0; left < indexes.length; left += 1) {
        for (let right = left + 1; right < indexes.length; right += 1) {
          const aIndex = indexes[left], bIndex = indexes[right];
          const key = aIndex < bIndex ? `${aIndex}:${bIndex}` : `${bIndex}:${aIndex}`;
          if (pairKeys.has(key)) continue;
          pairKeys.add(key);
          const result = evaluatePair(profiles[aIndex], profiles[bIndex]);
          if (result) candidates.push(result);
        }
      }
    }
    return candidates.sort((a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence) || b.score - a.score || a.left.name.localeCompare(b.left.name));
  }

  function buildProfile(player) {
    const tokens = tokenise(player.name);
    const years = player.seasons.map(season => seasonYear(season.season)).filter(Number.isFinite);
    return {
      player,
      id: player.playerId,
      name: player.name,
      normalName: normalise(player.name),
      tokens,
      firstToken: tokens[0] || "",
      lastToken: tokens.at(-1) || "",
      surnameTokens: surnameTokens(tokens),
      dob: player.bio?.dateOfBirth || "",
      clubs: new Set(player.seasons.map(season => season.club).filter(Boolean)),
      positions: new Set(player.seasons.map(season => season.position).filter(Boolean)),
      years,
      aliases: Array.isArray(player.aliases) ? player.aliases : []
    };
  }

  function evaluatePair(left, right) {
    const sameNormalName = left.normalName === right.normalName;
    const sameDob = Boolean(left.dob && right.dob && left.dob === right.dob);
    const conflictingDob = Boolean(left.dob && right.dob && left.dob !== right.dob);
    const sharedClub = intersects(left.clubs, right.clubs);
    const adjacent = areAdjacent(left.years, right.years);
    const firstNamesMatch = firstNameEquivalent(left.firstToken, right.firstToken);
    const lastNamesMatch = left.lastToken && left.lastToken === right.lastToken;
    const contained = nameContained(left.tokens, right.tokens);
    const similarity = similarityRatio(left.normalName, right.normalName);
    const compatible = seasonsCompatible(left.player, right.player);
    const mojibakePair = normalise(fixCommonEncoding(left.name)) === normalise(fixCommonEncoding(right.name));
    const reasons = [];
    let score = 0;

    if (sameDob) { score += 5; reasons.push("same birth date"); }
    if (firstNamesMatch && lastNamesMatch) { score += 5; reasons.push("nickname/full first name and same surname"); }
    if (contained) { score += 4; reasons.push("one name is contained in the other"); }
    if (similarity >= .9) { score += 4; reasons.push(`very similar spelling (${Math.round(similarity * 100)}%)`); }
    else if (similarity >= .74) { score += 2; reasons.push(`similar spelling (${Math.round(similarity * 100)}%)`); }
    if (sharedClub) { score += 3; reasons.push("shared club history"); }
    if (adjacent) { score += 1; reasons.push("adjacent seasons"); }
    if (mojibakePair && !sameNormalName) { score += 5; reasons.push("encoding-only spelling difference"); }
    if (!compatible) { score -= 12; reasons.push("conflicting record in the same season"); }
    if (conflictingDob) { score -= 8; reasons.push("different birth dates"); }

    let confidence = null;
    if (!compatible || conflictingDob) {
      if (sameNormalName || score >= 7) confidence = "blocked";
    } else if (
      (sameDob && sharedClub && (contained || similarity >= .72)) ||
      (firstNamesMatch && lastNamesMatch && sharedClub && adjacent) ||
      (mojibakePair && sharedClub) ||
      (contained && sharedClub && adjacent && left.firstToken === right.firstToken)
    ) {
      confidence = "safe";
    } else if (sameNormalName && !sameDob && !sharedClub) {
      confidence = "blocked";
      reasons.push("same name without enough identity evidence");
    } else if (score >= 11 && (sharedClub || sameDob || adjacent)) {
      confidence = "review";
    }
    if (!confidence) return null;

    const canonical = chooseCanonical([left.player, right.player]);
    return {
      id: `${left.id}::${right.id}`,
      left: summary(left.player),
      right: summary(right.player),
      confidence,
      score,
      reasons: [...new Set(reasons)],
      canonicalId: canonical.playerId,
      canonicalName: canonical.name,
      warning: confidence === "blocked" ? "This pair is deliberately protected from automatic merging." : ""
    };
  }

  function onCandidateToggle(event) {
    const checkbox = event.target.closest("[data-identity-candidate]");
    if (!checkbox) return;
    if (checkbox.checked) state.selected.add(checkbox.dataset.identityCandidate);
    else state.selected.delete(checkbox.dataset.identityCandidate);
    elements.applyIdentityMergesBtn.disabled = !state.selected.size;
  }

  function selectSafeCandidates() {
    state.selected = new Set(state.candidates.filter(candidate => candidate.confidence === "safe").map(candidate => candidate.id));
    renderCandidates();
    elements.applyIdentityMergesBtn.disabled = !state.selected.size;
    setStatus(`${state.selected.size} safe merges selected.`);
  }

  function renderCandidates() {
    const filter = elements.identityConfidenceFilter.value;
    const query = normalise(elements.identitySearchInput.value);
    const filtered = state.candidates.filter(candidate => {
      if (filter !== "all" && candidate.confidence !== filter) return false;
      if (!query) return true;
      const haystack = normalise(`${candidate.left.name} ${candidate.right.name} ${candidate.left.id} ${candidate.right.id} ${candidate.left.clubs.join(" ")} ${candidate.right.clubs.join(" ")}`);
      return haystack.includes(query);
    });
    elements.identityShownCount.textContent = `${filtered.length} candidate${filtered.length === 1 ? "" : "s"}`;
    elements.identityCandidateList.innerHTML = filtered.length ? filtered.map(candidateCard).join("") : '<div class="identity-empty">No identity candidates match these filters.</div>';
  }

  function candidateCard(candidate) {
    const checked = state.selected.has(candidate.id);
    const disabled = candidate.confidence === "blocked";
    return `<article class="identity-card ${candidate.confidence}">
      <div class="identity-card-head">
        <input class="identity-select" type="checkbox" data-identity-candidate="${escapeHtml(candidate.id)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} aria-label="Merge ${escapeHtml(candidate.left.name)} and ${escapeHtml(candidate.right.name)}">
        <div class="identity-names">${escapeHtml(candidate.left.name)}<span class="identity-arrow">⇄</span>${escapeHtml(candidate.right.name)}</div>
        <span class="identity-confidence">${candidate.confidence === "safe" ? "Safe merge" : candidate.confidence === "review" ? "Review" : "Protected"}</span>
      </div>
      <div class="identity-reasons">${candidate.reasons.map(reason => `<span class="identity-reason">${escapeHtml(reason)}</span>`).join("")}</div>
      <div class="identity-columns">
        ${playerBox(candidate.left)}${playerBox(candidate.right)}
      </div>
      <div class="identity-canonical">Proposed display identity: <strong>${escapeHtml(candidate.canonicalName)}</strong> · all other names retained as searchable aliases in the database.</div>
      ${candidate.warning ? `<div class="identity-warning">${escapeHtml(candidate.warning)}</div>` : ""}
    </article>`;
  }

  function playerBox(player) {
    return `<div class="identity-player-box"><strong>${escapeHtml(player.name)}</strong><small>ID: ${escapeHtml(player.id)}</small><small>${player.seasonCount} seasons · ${escapeHtml(player.seasons.join(" · "))}</small><small>${escapeHtml(player.clubs.join(" · ") || "No club")}${player.dob ? ` · DOB ${escapeHtml(player.dob)}` : ""}</small></div>`;
  }

  async function buildWorkspace() {
    if (!state.selected.size) return;
    const selected = state.candidates.filter(candidate => state.selected.has(candidate.id) && candidate.confidence !== "blocked");
    const result = mergeSelectedGroups(originalPlayers, selected);
    state.workspace = result.database;
    state.mergeReport = result.report;
    state.ready = false;
    updateSummary();
    elements.identityRegressionPanel.classList.remove("hidden");
    elements.identityDownloadPanel.classList.remove("hidden");
    setStatus(`Preview built: ${result.report.length} identity groups consolidated. Running safety checks…`);
    await runRegressionChecks();
  }

  function mergeSelectedGroups(database, selectedCandidates) {
    const parent = new Map(database.map(player => [player.playerId, player.playerId]));
    const find = id => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root);
      let current = id;
      while (parent.get(current) !== root) { const next = parent.get(current); parent.set(current, root); current = next; }
      return root;
    };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
    selectedCandidates.forEach(candidate => union(candidate.left.id, candidate.right.id));

    const groups = new Map();
    database.forEach(player => {
      const root = find(player.playerId);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(player);
    });

    const output = [];
    const report = [];
    for (const players of groups.values()) {
      if (players.length === 1) { output.push(clone(players[0])); continue; }
      if (!groupCompatible(players)) {
        players.forEach(player => output.push(clone(player)));
        report.push({ status: "skipped", reason: "conflicting same-season records", players: players.map(summary) });
        continue;
      }
      const merged = mergePlayers(players);
      output.push(merged);
      report.push({
        status: "merged",
        canonicalId: merged.playerId,
        canonicalName: merged.name,
        aliases: merged.aliases || [],
        legacyPlayerIds: merged.legacyPlayerIds || [],
        players: players.map(summary),
        seasonsAfter: merged.seasons.length
      });
    }
    output.sort((a, b) => a.name.localeCompare(b.name));
    return { database: output, report };
  }

  function mergePlayers(players) {
    const canonical = chooseCanonical(players);
    const aliases = new Set();
    const legacyIds = new Set();
    players.forEach(player => {
      aliases.add(player.name);
      (player.aliases || []).forEach(alias => aliases.add(alias));
      legacyIds.add(player.playerId);
      (player.legacyPlayerIds || []).forEach(id => legacyIds.add(id));
    });
    aliases.delete(canonical.name);
    legacyIds.delete(canonical.playerId);

    const seasonMap = new Map();
    players.flatMap(player => player.seasons).forEach(season => {
      const existing = seasonMap.get(season.season);
      seasonMap.set(season.season, existing ? mergeDuplicateSeason(existing, season) : clone(season));
    });
    const bio = mergeBio(players, canonical.bio || {});
    const merged = {
      ...clone(canonical),
      playerId: canonical.playerId,
      name: canonical.name,
      aliases: [...aliases].sort((a, b) => a.localeCompare(b)),
      legacyPlayerIds: [...legacyIds].sort(),
      seasons: [...seasonMap.values()].sort((a, b) => seasonYear(b.season) - seasonYear(a.season)),
      bio
    };
    return merged;
  }

  function chooseCanonical(players) {
    return [...players].sort((a, b) => {
      const aBroken = looksBrokenEncoding(a.name) ? 1 : 0;
      const bBroken = looksBrokenEncoding(b.name) ? 1 : 0;
      if (aBroken !== bBroken) return aBroken - bBroken;
      const aWords = tokenise(a.name).length, bWords = tokenise(b.name).length;
      if (aWords !== bWords) return aWords - bWords;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      if (a.seasons.length !== b.seasons.length) return b.seasons.length - a.seasons.length;
      return latestSeason(b) - latestSeason(a);
    })[0];
  }

  function mergeDuplicateSeason(left, right) {
    if (coreSeasonEqual(left, right)) return mergeObjects(left, right);
    if ((Number(left.minutes) || 0) === 0 && (Number(right.minutes) || 0) > 0) return clone(right);
    if ((Number(right.minutes) || 0) === 0 && (Number(left.minutes) || 0) > 0) return clone(left);
    return completeness(right) > completeness(left) ? clone(right) : clone(left);
  }

  function mergeObjects(primary, secondary) {
    const output = { ...clone(secondary), ...clone(primary) };
    const managers = new Set([...(primary.managers || []), ...(secondary.managers || [])]);
    output.managers = [...managers];
    for (const [key, value] of Object.entries(secondary)) {
      if ((output[key] === null || output[key] === undefined || output[key] === "") && value !== null && value !== undefined && value !== "") output[key] = clone(value);
    }
    return output;
  }

  function mergeBio(players, fallback) {
    const dates = players.map(player => player.bio?.dateOfBirth).filter(Boolean);
    const regions = players.map(player => player.bio?.regionId).filter(value => value !== undefined && value !== null);
    return {
      ...clone(fallback),
      ...(new Set(dates).size === 1 ? { dateOfBirth: dates[0] } : {}),
      ...(new Set(regions).size === 1 ? { regionId: regions[0] } : {})
    };
  }

  async function runRegressionChecks() {
    if (!state.workspace) return;
    setStatus("Running identity regression checks…");
    const checks = [];
    addCheck(checks, originalPlayers.length > 0, "Original database preserved", `${originalPlayers.length.toLocaleString()} loaded players remain untouched in memory.`);
    addCheck(checks, uniquePlayerIds(state.workspace), "Every player ID is unique", `${state.workspace.length.toLocaleString()} consolidated player identities checked.`);
    addCheck(checks, uniqueSeasonsPerPlayer(state.workspace), "No player has duplicate seasons", `${seasonCount(state.workspace).toLocaleString()} player-season records checked.`);
    addCheck(checks, validCoreData(state.workspace), "Core positions and statistics remain valid", "All retained seasons use supported positions and finite core values.");

    const promptFailures = evaluatePrompts(state.workspace);
    addCheck(checks, promptFailures.length === 0, "All enabled prompts retain enough answers", promptFailures.length ? `${promptFailures.length} prompts fell below six valid footballers.` : `${promptLibrary.filter(prompt => prompt.enabled !== false).length} enabled prompts passed.`);

    const selectedMergeReports = state.mergeReport.filter(item => item.status === "merged");
    const expectedPlayers = originalPlayers.length - selectedMergeReports.reduce((sum, item) => sum + item.players.length - 1, 0);
    addCheck(checks, state.workspace.length === expectedPlayers, "Player-count change matches approved merges", `${originalPlayers.length.toLocaleString()} → ${state.workspace.length.toLocaleString()} players.`);
    addCheck(checks, seasonCount(state.workspace) <= seasonCount(originalPlayers), "Season count is controlled", `${seasonCount(originalPlayers).toLocaleString()} → ${seasonCount(state.workspace).toLocaleString()} seasons; records were never summed.`);

    const live = await loadLiveChallenge();
    if (live) {
      const result = calculatePerfectXI(live.prompts || [], state.workspace);
      addCheck(checks, result.possible, "The live challenge still has eleven unique valid footballers", result.possible ? "A valid unique-player XI still exists." : result.reason);
      addCheck(checks, result.possible && result.score === Number(live.perfectScore), "Live perfect score remains correct", result.possible ? `${result.score.toLocaleString()} calculated versus ${Number(live.perfectScore).toLocaleString()} stored.` : "Perfect score could not be calculated.");
    } else {
      addCheck(checks, false, "Live challenge could not be verified", "todays-challenge.js could not be read, so the upload package remains locked.");
    }

    state.checks = checks;
    state.ready = checks.every(check => check.pass);
    renderRegression();
    elements.downloadIdentityPackBtn.disabled = !state.ready;
    elements.downloadIdentityPackBtn.textContent = state.ready ? "Download upload-ready package" : "Download review package";
    elements.identityDownloadExplanation.textContent = state.ready
      ? "Every identity, prompt and live-challenge check passed. Upload only UPLOAD/players.js after keeping the backup."
      : "At least one blocking check failed. Review the candidates before replacing players.js.";
    elements.identityCentreStatus.textContent = state.ready ? "Upload-ready" : "Review required";
    setStatus(state.ready ? "Identity consolidation passed every safety check." : "Identity consolidation needs review; no upload-ready file has been unlocked.");
  }

  function renderRegression() {
    elements.identityRegressionList.innerHTML = state.checks.map(check => `
      <div class="repair-check ${check.pass ? "pass" : "fail"}">
        <span class="repair-check-icon">${check.pass ? "✓" : "!"}</span>
        <div><strong>${escapeHtml(check.title)}</strong><small>${escapeHtml(check.detail)}</small></div>
      </div>`).join("");
  }

  function downloadPack() {
    if (!state.workspace || !state.ready) return;
    const zipBuilder = window.FPL_STUDIO_PHASE6?.buildZipBlob;
    if (typeof zipBuilder !== "function") {
      elements.identityDownloadStatus.textContent = "The ZIP builder is unavailable. Reload the Studio and try again.";
      return;
    }
    const merged = state.mergeReport.filter(item => item.status === "merged");
    const files = [
      { name: "UPLOAD/players.js", content: buildPlayersSource(state.workspace, "Generated by Challenge Studio Phase 11 identity consolidation") },
      { name: "BACKUPS/players-before-identity-consolidation.js", content: buildPlayersSource(originalPlayers, "Backup created before Phase 11 identity consolidation") },
      { name: "REPORTS/identity-merges.json", content: JSON.stringify(merged, null, 2) + "\n" },
      { name: "REPORTS/aliases.json", content: JSON.stringify(state.workspace.filter(player => player.aliases?.length).map(player => ({ playerId: player.playerId, name: player.name, aliases: player.aliases, legacyPlayerIds: player.legacyPlayerIds || [] })), null, 2) + "\n" },
      { name: "REPORTS/regression-checks.json", content: JSON.stringify(state.checks, null, 2) + "\n" },
      { name: "README-UPLOAD.txt", content: buildReadme(merged) }
    ];
    downloadBlob(`fpl-phase-11-identity-consolidation-${dateStamp()}.zip`, zipBuilder(files));
    elements.identityDownloadStatus.textContent = "Package downloaded. Keep the backup and replace only players.js from the UPLOAD folder.";
  }

  function buildReadme(merged) {
    return [
      "FPL CHALLENGE STUDIO — PHASE 11 IDENTITY CONSOLIDATION",
      "=======================================================",
      "",
      `Merged identity groups: ${merged.length}`,
      `Players: ${originalPlayers.length} -> ${state.workspace.length}`,
      `Player-seasons: ${seasonCount(originalPlayers)} -> ${seasonCount(state.workspace)}`,
      "",
      "UPLOAD STEPS",
      "1. Keep BACKUPS/players-before-identity-consolidation.js locally.",
      "2. Upload only UPLOAD/players.js to the root of the GitHub repository.",
      "3. Wait for GitHub Pages to deploy and hard-refresh the game and admin page.",
      "4. Confirm the displayed player and season totals match this report.",
      "",
      "IMPORTANT",
      "Different seasons were combined under one footballer identity. Same-season statistics were never added together. Exact duplicate or zero-minute stub records were deduplicated conservatively.",
      ""
    ].join("\n");
  }

  function resetWorkspace() {
    state.candidates = [];
    state.selected.clear();
    state.workspace = null;
    state.mergeReport = [];
    state.checks = [];
    state.ready = false;
    elements.identityResultsPanel.classList.add("hidden");
    elements.identityRegressionPanel.classList.add("hidden");
    elements.identityDownloadPanel.classList.add("hidden");
    elements.selectSafeIdentityBtn.disabled = true;
    elements.applyIdentityMergesBtn.disabled = true;
    elements.downloadIdentityPackBtn.disabled = true;
    elements.identityCentreStatus.textContent = "Ready to scan";
    elements.identitySafeCount.textContent = "0";
    elements.identityReviewCount.textContent = "0";
    elements.identityBlockedCount.textContent = "0";
    elements.identityProjectedPlayers.textContent = originalPlayers.length.toLocaleString();
    elements.identityProjectedSeasons.textContent = seasonCount(originalPlayers).toLocaleString();
    setStatus("Identity workspace reset. The loaded database was not changed.");
  }

  function updateSummary() {
    const safe = state.candidates.filter(candidate => candidate.confidence === "safe").length;
    const review = state.candidates.filter(candidate => candidate.confidence === "review").length;
    const blocked = state.candidates.filter(candidate => candidate.confidence === "blocked").length;
    elements.identityPlayersScanned.textContent = originalPlayers.length.toLocaleString();
    elements.identitySafeCount.textContent = safe.toLocaleString();
    elements.identityReviewCount.textContent = review.toLocaleString();
    elements.identityBlockedCount.textContent = blocked.toLocaleString();
    elements.identityProjectedPlayers.textContent = (state.workspace?.length || originalPlayers.length).toLocaleString();
    elements.identityProjectedSeasons.textContent = seasonCount(state.workspace || originalPlayers).toLocaleString();
  }

  function summary(player) {
    return {
      id: player.playerId,
      name: player.name,
      dob: player.bio?.dateOfBirth || "",
      clubs: [...new Set(player.seasons.map(season => season.club).filter(Boolean))],
      seasons: player.seasons.map(season => season.season).sort((a, b) => seasonYear(a) - seasonYear(b)),
      seasonCount: player.seasons.length
    };
  }

  function seasonsCompatible(left, right) {
    const rightMap = new Map(right.seasons.map(season => [season.season, season]));
    for (const leftSeason of left.seasons) {
      const rightSeason = rightMap.get(leftSeason.season);
      if (!rightSeason) continue;
      if (coreSeasonEqual(leftSeason, rightSeason)) continue;
      if (leftSeason.club === rightSeason.club && ((Number(leftSeason.minutes) || 0) === 0 || (Number(rightSeason.minutes) || 0) === 0)) continue;
      return false;
    }
    return true;
  }

  function groupCompatible(players) {
    for (let left = 0; left < players.length; left += 1) for (let right = left + 1; right < players.length; right += 1) if (!seasonsCompatible(players[left], players[right])) return false;
    return true;
  }

  function coreSeasonEqual(left, right) {
    return CORE_SEASON_FIELDS.every(field => normalValue(left[field]) === normalValue(right[field]));
  }

  function normalValue(value) {
    if (Array.isArray(value)) return JSON.stringify([...value].sort());
    return value === undefined ? null : value;
  }

  function completeness(record) {
    return Object.values(record).reduce((score, value) => score + (value !== null && value !== undefined && value !== "" ? 1 : 0), 0);
  }

  function evaluatePrompts(database) {
    const flat = flatten(database);
    return promptLibrary.filter(prompt => prompt.enabled !== false).map(prompt => {
      const players = new Set();
      for (const record of flat) {
        try { if (record.position === prompt.position && prompt.test(record)) players.add(record.playerId); } catch { /* handled as failure */ }
      }
      return { id: prompt.id, players: players.size };
    }).filter(result => result.players < 6);
  }

  function calculatePerfectXI(prompts, database) {
    if (!Array.isArray(prompts) || prompts.length !== 11) return { possible: false, reason: "The live challenge does not contain eleven prompts." };
    const flat = flatten(database);
    const bestBySlot = prompts.map(prompt => {
      const map = new Map();
      for (const record of flat) {
        if (record.position !== prompt.position) continue;
        let valid = false;
        try { valid = prompt.test(record); } catch { valid = false; }
        if (!valid) continue;
        const current = map.get(record.playerId);
        if (!current || Number(record.points) > Number(current.points)) map.set(record.playerId, record);
      }
      return map;
    });
    if (bestBySlot.some(map => map.size === 0)) return { possible: false, reason: "At least one live prompt has no valid footballers." };
    const playerIds = [...new Set(bestBySlot.flatMap(map => [...map.keys()]))];
    if (playerIds.length < 11) return { possible: false, reason: "Fewer than eleven unique valid footballers remain." };
    const maxPoints = Math.max(...bestBySlot.flatMap(map => [...map.values()].map(record => Number(record.points) || 0)));
    const forbidden = 1e9;
    const costs = bestBySlot.map(map => Float64Array.from(playerIds, id => map.has(id) ? maxPoints - (Number(map.get(id).points) || 0) : forbidden));
    const assignment = hungarianMinimumAssignment(costs);
    if (!assignment) return { possible: false, reason: "The unique-player optimiser could not complete an XI." };
    const records = assignment.map((column, slot) => bestBySlot[slot].get(playerIds[column]) || null);
    if (records.some(record => !record)) return { possible: false, reason: "No complete unique-player assignment exists." };
    return { possible: true, score: records.reduce((sum, record) => sum + (Number(record.points) || 0), 0), records };
  }

  function hungarianMinimumAssignment(costs) {
    const rows = costs.length, columns = costs[0]?.length || 0;
    if (!rows || columns < rows) return null;
    const u = new Float64Array(rows + 1), v = new Float64Array(columns + 1);
    const p = new Int32Array(columns + 1), way = new Int32Array(columns + 1);
    for (let i = 1; i <= rows; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(columns + 1); minv.fill(Infinity);
      const used = new Uint8Array(columns + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= columns; j += 1) {
          if (used[j]) continue;
          const current = costs[i0 - 1][j - 1] - u[i0] - v[j];
          if (current < minv[j]) { minv[j] = current; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        if (!Number.isFinite(delta)) return null;
        for (let j = 0; j <= columns; j += 1) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0);
    }
    const assignment = new Int32Array(rows); assignment.fill(-1);
    for (let j = 1; j <= columns; j += 1) if (p[j] > 0 && p[j] <= rows) assignment[p[j] - 1] = j - 1;
    return [...assignment].every(value => value >= 0) ? [...assignment] : null;
  }

  async function loadLiveChallenge() {
    try {
      const response = await fetch(`todays-challenge.js?identity=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return null;
      const source = await response.text();
      const sandbox = {};
      Function("window", `${source}\n;return window.FPL_DAILY_CHALLENGE;`)(sandbox);
      state.liveChallenge = sandbox.FPL_DAILY_CHALLENGE || null;
      return state.liveChallenge;
    } catch { return null; }
  }

  function buildPlayersSource(database, note) {
    return `/* ${note}. */\nwindow.FPL_PLAYERS = ${JSON.stringify(database)};\n`;
  }

  function uniquePlayerIds(database) { return new Set(database.map(player => player.playerId)).size === database.length; }
  function uniqueSeasonsPerPlayer(database) { return database.every(player => new Set(player.seasons.map(season => season.season)).size === player.seasons.length); }
  function validCoreData(database) {
    return database.every(player => player.playerId && player.name && Array.isArray(player.seasons) && player.seasons.every(season => VALID_POSITIONS.has(season.position) && CORE_SEASON_FIELDS.filter(field => !["club", "position"].includes(field)).every(field => Number.isFinite(Number(season[field])))));
  }

  function flatten(database) { return database.flatMap(player => player.seasons.map(season => ({ ...season, playerId: player.playerId, name: player.name, aliases: player.aliases || [] }))); }
  function seasonCount(database) { return database.reduce((sum, player) => sum + player.seasons.length, 0); }
  function latestSeason(player) { return Math.max(...player.seasons.map(season => seasonYear(season.season)).filter(Number.isFinite), 0); }
  function seasonYear(season) { const match = String(season || "").match(/^(\d{4})/); return match ? Number(match[1]) : NaN; }
  function intersects(left, right) { for (const value of left) if (right.has(value)) return true; return false; }
  function areAdjacent(left, right) { return left.length && right.length && Math.min(...left.flatMap(a => right.map(b => Math.abs(a - b)))) <= 1; }
  function nameContained(left, right) { const short = left.length <= right.length ? left : right; const long = left.length <= right.length ? right : left; return short.length >= 2 && short.every(token => long.includes(token)); }
  function firstNameEquivalent(left, right) { return left === right || Boolean(NICKNAME_MAP.get(left)?.has(right)); }
  function surnameTokens(tokens) { if (tokens.length <= 1) return tokens; const result = [tokens.at(-1)]; for (let index = tokens.length - 2; index >= 1 && NAME_PARTICLES.has(tokens[index]); index -= 1) result.unshift(tokens[index]); return result; }
  function tokenise(value) { return normalise(value).split(" ").filter(Boolean); }
  function normalise(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/-/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function fixCommonEncoding(value) { try { return decodeURIComponent(escape(String(value))); } catch { return String(value); } }
  function looksBrokenEncoding(value) { return /Ã|Â|Å|Ä|â€/.test(String(value)); }

  function similarityRatio(left, right) {
    if (left === right) return 1;
    if (!left || !right) return 0;
    const longer = left.length >= right.length ? left : right;
    const shorter = left.length >= right.length ? right : left;
    const distance = levenshtein(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  function levenshtein(left, right) {
    const previous = new Uint16Array(right.length + 1), current = new Uint16Array(right.length + 1);
    for (let j = 0; j <= right.length; j += 1) previous[j] = j;
    for (let i = 1; i <= left.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= right.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous.set(current);
    }
    return previous[right.length];
  }

  function confidenceRank(value) { return value === "safe" ? 0 : value === "review" ? 1 : 2; }
  function addCheck(list, pass, title, detail) { list.push({ pass: Boolean(pass), title, detail }); }
  function setStatus(message) { elements.identityActionStatus.textContent = message; }
  function normaliseNumber(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function dateStamp() { return new Date().toISOString().slice(0, 10); }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})();
