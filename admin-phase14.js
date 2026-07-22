(() => {
  "use strict";

  const MANAGER_STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const BIG_SIX = new Set(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"]);
  const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const QUALITY_ORDER = { excellent: 5, good: 4, fair: 3, review: 2, poor: 1, broken: 0 };
  const IDEAL_RANGES = {
    GK: { narrow: 5, idealLow: 8, idealHigh: 35, broad: 70 },
    DEF: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    MID: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    FWD: { narrow: 6, idealLow: 12, idealHigh: 60, broad: 110 }
  };

  let analysisResults = [];
  let analysisById = new Map();
  let running = false;
  let cancelled = false;

  window.FPL_PROMPT_QUALITY_ENGINE = Object.freeze({
    analyseLibrary: (library, players, options = {}) => analyseLibrary(library, players, options)
  });

  window.addEventListener("load", () => {
    window.setTimeout(initialiseQualityAnalyser, 80);
  }, { once: true });

  function initialiseQualityAnalyser() {
    const core = window.FPL_STUDIO_API;
    const panel = document.querySelector("#promptQualityAnalyser");
    if (!core || !panel) return;

    const elements = getElements();
    bindEvents(elements, core);

    const library = core.getPromptLibrary?.() || [];
    const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    elements.status.textContent = library.length && players.length
      ? `Ready to analyse ${library.length.toLocaleString()} prompts against ${players.length.toLocaleString()} footballers.`
      : "The analyser is waiting for players.js and prompt-library.js.";

    window.FPL_PROMPT_QUALITY_API = Object.freeze({
      run: options => analyseLibrary(core.getPromptLibrary?.() || [], window.FPL_PLAYERS || [], options),
      getResults: () => analysisResults.map(copyResult),
      getResult: promptId => analysisById.has(promptId) ? copyResult(analysisById.get(promptId)) : null
    });
  }

  function getElements() {
    return {
      panel: document.querySelector("#promptQualityAnalyser"),
      scope: document.querySelector("#qualityScope"),
      runBtn: document.querySelector("#runPromptQualityBtn"),
      cancelBtn: document.querySelector("#cancelPromptQualityBtn"),
      ratingsBtn: document.querySelector("#applyQualityRatingsBtn"),
      disableBtn: document.querySelector("#disablePoorPromptsBtn"),
      jsonBtn: document.querySelector("#downloadQualityJsonBtn"),
      csvBtn: document.querySelector("#downloadQualityCsvBtn"),
      status: document.querySelector("#promptQualityStatus"),
      progressWrap: document.querySelector("#qualityProgressWrap"),
      progressBar: document.querySelector("#qualityProgressBar"),
      progressText: document.querySelector("#qualityProgressText"),
      summary: document.querySelector("#promptQualitySummary"),
      controls: document.querySelector("#promptQualityFilters"),
      search: document.querySelector("#qualitySearch"),
      position: document.querySelector("#qualityPosition"),
      quality: document.querySelector("#qualityBand"),
      issue: document.querySelector("#qualityIssue"),
      sort: document.querySelector("#qualitySort"),
      list: document.querySelector("#promptQualityList"),
      listSummary: document.querySelector("#promptQualityListSummary")
    };
  }

  function bindEvents(elements, core) {
    elements.runBtn.addEventListener("click", () => runAnalysis(elements, core));
    elements.cancelBtn.addEventListener("click", () => { cancelled = true; });
    elements.ratingsBtn.addEventListener("click", () => applyRecommendations(elements, core, { ratings: true, disable: false }));
    elements.disableBtn.addEventListener("click", () => applyRecommendations(elements, core, { ratings: false, disable: true }));
    elements.jsonBtn.addEventListener("click", downloadJsonReport);
    elements.csvBtn.addEventListener("click", downloadCsvReport);

    for (const input of [elements.search, elements.position, elements.quality, elements.issue, elements.sort]) {
      if (!input) continue;
      input.addEventListener(input === elements.search ? "input" : "change", () => renderResults(elements));
    }
  }

  async function runAnalysis(elements, core) {
    if (running) return;
    running = true;
    cancelled = false;
    setRunningState(elements, true);
    analysisResults = [];
    analysisById = new Map();
    clearOutput(elements);

    try {
      const library = (core.getPromptLibrary?.() || []).filter(prompt => elements.scope.value !== "enabled" || prompt.enabled !== false);
      const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
      if (!library.length) throw new Error("No prompts are available in the selected scope.");
      if (!players.length) throw new Error("players.js is not loaded.");

      elements.status.textContent = `Preparing ${library.length.toLocaleString()} prompts for analysis…`;
      const progress = (current, total, label) => updateProgress(elements, current, total, label);
      const results = await analyseLibrary(library, players, { progress, shouldCancel: () => cancelled });
      if (cancelled) {
        elements.status.textContent = "Analysis cancelled. No prompt settings were changed.";
        return;
      }

      analysisResults = results;
      analysisById = new Map(results.map(result => [result.id, result]));
      renderSummary(elements);
      renderResults(elements);
      enableReportActions(elements, true);

      const excellent = results.filter(result => result.quality === "excellent").length;
      const needsAttention = results.filter(result => ["review", "poor", "broken"].includes(result.quality)).length;
      elements.status.textContent = `Analysis complete: ${excellent} excellent, ${needsAttention} needing attention. Nothing has been changed automatically.`;
    } catch (error) {
      console.error("Prompt Quality Analyser failed.", error);
      elements.status.textContent = `Analysis could not be completed: ${error.message}`;
    } finally {
      running = false;
      setRunningState(elements, false);
    }
  }

  async function analyseLibrary(library, players, options = {}) {
    const progress = typeof options.progress === "function" ? options.progress : () => {};
    const shouldCancel = typeof options.shouldCancel === "function" ? options.shouldCancel : () => false;
    const records = [];
    const allSeasonLabels = new Set();

    for (const player of players) {
      for (const season of player.seasons || []) {
        records.push({ ...season, playerId: player.playerId, playerName: player.name, name: player.name });
        if (season.season) allSeasonLabels.add(season.season);
      }
    }

    const raw = [];
    const totalSteps = library.length * 2 + Math.max(1, Math.floor((library.length * (library.length - 1)) / 2));
    let step = 0;

    for (let index = 0; index < library.length; index += 1) {
      if (shouldCancel()) return [];
      const prompt = library[index];
      const evaluated = evaluatePrompt(prompt, records);
      raw.push({ prompt, ...evaluated });
      step += 1;
      progress(step, totalSteps, `Testing ${index + 1} of ${library.length}: ${prompt.label}`);
      if (index % 4 === 3) await nextFrame();
    }

    const bestLeaderCounts = new Map();
    for (const item of raw) {
      if (!item.bestAnswer) continue;
      bestLeaderCounts.set(item.bestAnswer.playerId, (bestLeaderCounts.get(item.bestAnswer.playerId) || 0) + 1);
    }

    const overlapData = new Map(raw.map(item => [item.prompt.id, { max: 0, averageTopThree: 0, closestId: null, closestLabel: null, labelSimilarity: 0, similarLabelId: null, similarLabel: null, values: [] }]));
    const pairTotal = Math.max(1, Math.floor((raw.length * (raw.length - 1)) / 2));
    let pairIndex = 0;

    for (let leftIndex = 0; leftIndex < raw.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < raw.length; rightIndex += 1) {
        if (shouldCancel()) return [];
        const left = raw[leftIndex];
        const right = raw[rightIndex];
        const labelScore = tokenSimilarity(normaliseLabel(left.prompt.label), normaliseLabel(right.prompt.label));
        updateLabelSimilarity(overlapData.get(left.prompt.id), right.prompt, labelScore);
        updateLabelSimilarity(overlapData.get(right.prompt.id), left.prompt, labelScore);

        if (left.prompt.position === right.prompt.position) {
          const overlap = jaccard(left.playerSet, right.playerSet);
          updatePoolOverlap(overlapData.get(left.prompt.id), right.prompt, overlap);
          updatePoolOverlap(overlapData.get(right.prompt.id), left.prompt, overlap);
        }

        pairIndex += 1;
        step += 1;
        if (pairIndex % 500 === 0) {
          progress(step, totalSteps, `Comparing prompt overlap ${pairIndex.toLocaleString()} of ${pairTotal.toLocaleString()}`);
          await nextFrame();
        }
      }
    }

    for (const data of overlapData.values()) {
      data.values.sort((a, b) => b - a);
      const top = data.values.slice(0, 3);
      data.averageTopThree = top.length ? top.reduce((sum, value) => sum + value, 0) / top.length : 0;
      delete data.values;
    }

    const results = [];
    for (let index = 0; index < raw.length; index += 1) {
      if (shouldCancel()) return [];
      const item = raw[index];
      const overlap = overlapData.get(item.prompt.id);
      const bestRepeatCount = item.bestAnswer ? bestLeaderCounts.get(item.bestAnswer.playerId) || 0 : 0;
      results.push(scorePrompt(item, overlap, bestRepeatCount, allSeasonLabels.size));
      step += 1;
      progress(Math.min(step, totalSteps), totalSteps, `Scoring ${index + 1} of ${raw.length}: ${item.prompt.label}`);
      if (index % 8 === 7) await nextFrame();
    }

    progress(totalSteps, totalSteps, "Prompt quality report ready");
    return results;
  }

  function evaluatePrompt(prompt, records) {
    const matches = [];
    const errors = [];

    for (const record of records) {
      if (record.position !== prompt.position) continue;
      try {
        if (prompt.test(record)) matches.push(record);
      } catch (error) {
        if (errors.length < 5) errors.push(String(error?.message || error));
      }
    }

    const bestByPlayer = new Map();
    for (const match of matches) {
      const previous = bestByPlayer.get(match.playerId);
      if (!previous || match.points > previous.points || (match.points === previous.points && seasonValue(match.season) > seasonValue(previous.season))) {
        bestByPlayer.set(match.playerId, match);
      }
    }

    const uniqueAnswers = [...bestByPlayer.values()].sort((a, b) => b.points - a.points || String(a.playerName).localeCompare(String(b.playerName)));
    const clubCounts = countBy(uniqueAnswers, answer => answer.club || "Unknown");
    const seasonCounts = countBy(matches, answer => answer.season || "Unknown");
    const playerSet = new Set(bestByPlayer.keys());
    const bigSixCount = uniqueAnswers.filter(answer => BIG_SIX.has(answer.club)).length;
    const largestClub = largestEntry(clubCounts);
    const pointValues = uniqueAnswers.map(answer => Number(answer.points) || 0);
    const topFive = pointValues.slice(0, 5);
    const top = topFive[0] || 0;
    const second = topFive[1] ?? top;
    const fifth = topFive[4] ?? topFive[topFive.length - 1] ?? top;

    return {
      playerCount: bestByPlayer.size,
      seasonCount: matches.length,
      uniqueSeasonCount: seasonCounts.size,
      uniqueClubCount: clubCounts.size,
      playerSet,
      bestAnswer: uniqueAnswers[0] || null,
      topAnswers: uniqueAnswers.slice(0, 5),
      largestClubName: largestClub?.[0] || "—",
      largestClubCount: largestClub?.[1] || 0,
      largestClubShare: uniqueAnswers.length ? (largestClub?.[1] || 0) / uniqueAnswers.length : 0,
      bigSixShare: uniqueAnswers.length ? bigSixCount / uniqueAnswers.length : 0,
      topGapRatio: top > 0 ? Math.max(0, top - second) / top : 0,
      topToFifthRatio: top > 0 ? Math.max(0, top - fifth) / top : 0,
      errorCount: errors.length,
      errorSamples: errors
    };
  }

  function scorePrompt(item, overlap, bestRepeatCount, totalSeasonCount) {
    const prompt = item.prompt;
    const flags = [];
    const recommendations = [];
    const components = {};
    const range = IDEAL_RANGES[prompt.position] || IDEAL_RANGES.MID;

    components.answerBreadth = breadthScore(item.playerCount, range);
    components.seasonDiversity = Math.min(15, totalSeasonCount ? (item.uniqueSeasonCount / Math.min(totalSeasonCount, 8)) * 15 : 0);
    components.clubSpread = spreadScore(item.largestClubShare, 15);
    components.bigSixBalance = eliteBalanceScore(item.bigSixShare, prompt);
    components.answerObviousness = obviousnessScore(item.topGapRatio, item.topToFifthRatio, bestRepeatCount);
    components.poolUniqueness = overlapScore(overlap.max);
    components.difficultyFit = difficultyFitScore(prompt, item.playerCount);
    components.ruleHealth = item.errorCount ? 0 : 5;

    let score = Object.values(components).reduce((sum, value) => sum + value, 0);

    if (item.errorCount) {
      flags.push("broken-rule");
      recommendations.push("Repair the test rule before using this prompt.");
      score -= 40;
    }
    if (item.playerCount === 0) {
      flags.push("no-answers");
      recommendations.push("Disable this prompt until the rule or database is corrected.");
      score = 0;
    } else if (item.playerCount < range.narrow) {
      flags.push("too-narrow");
      recommendations.push(`Broaden the rule; only ${item.playerCount} footballers currently qualify.`);
      score -= item.playerCount < 3 ? 25 : 10;
    }
    if (item.playerCount > range.broad) {
      flags.push("too-broad");
      recommendations.push(`Add another condition; ${item.playerCount} footballers currently qualify.`);
      score -= item.playerCount > range.broad * 1.5 ? 18 : 8;
    }
    if (overlap.max >= 0.8) {
      flags.push("high-overlap");
      recommendations.push(`This answer pool is very similar to “${overlap.closestLabel}”.`);
      score -= overlap.max >= 0.95 ? 20 : 9;
    }
    if (overlap.labelSimilarity >= 0.82) {
      flags.push("similar-wording");
      recommendations.push(`Review the wording against “${overlap.similarLabel}”.`);
      score -= overlap.labelSimilarity >= 0.94 ? 10 : 4;
    }
    if (item.topGapRatio >= 0.35 || item.topToFifthRatio >= 0.55) {
      flags.push("too-obvious");
      recommendations.push("The highest-scoring answer stands well clear of the alternatives.");
    }
    if (bestRepeatCount >= 6) {
      flags.push("repeated-leader");
      recommendations.push(`${item.bestAnswer?.playerName || "The leading answer"} is also the best answer for ${bestRepeatCount - 1} other prompts.`);
      score -= bestRepeatCount >= 10 ? 8 : 4;
    }
    if (item.largestClubShare >= 0.45 && item.playerCount >= 8) {
      flags.push("club-dominated");
      recommendations.push(`${item.largestClubName} supplies ${formatPercent(item.largestClubShare)} of the valid footballers.`);
    }
    if (item.bigSixShare >= 0.78 && !explicitElitePrompt(prompt)) {
      flags.push("big-six-heavy");
      recommendations.push(`${formatPercent(item.bigSixShare)} of valid footballers come from the traditional Big Six.`);
      score -= item.bigSixShare >= 0.92 ? 7 : 3;
    }
    if (item.uniqueSeasonCount < 3 && item.seasonCount > 0) {
      flags.push("low-season-spread");
      recommendations.push("The answers are concentrated in very few seasons.");
      score -= 7;
    }

    const inferredDifficulty = inferDifficulty(prompt.position, item.playerCount);
    if (prompt.difficulty !== inferredDifficulty) {
      flags.push("difficulty-mismatch");
      recommendations.push(`Consider changing the difficulty from ${capitalise(prompt.difficulty)} to ${capitalise(inferredDifficulty)}.`);
    }

    score = clamp(Math.round(score), 0, 100);
    const quality = qualityBand(score, item.errorCount, item.playerCount);
    const suggestedRating = score >= 85 ? 5 : score >= 72 ? 4 : score >= 58 ? 3 : score >= 42 ? 2 : 1;
    const suggestedEnabled = !(quality === "broken" || quality === "poor" || item.playerCount < 3 || overlap.max >= 0.97);

    if (!recommendations.length) recommendations.push("No major quality problems were detected.");

    return {
      id: prompt.id,
      label: prompt.label,
      position: prompt.position,
      difficulty: prompt.difficulty,
      enabled: prompt.enabled !== false,
      currentRating: Number(prompt.rating) || 3,
      score,
      quality,
      suggestedRating,
      suggestedEnabled,
      inferredDifficulty,
      playerCount: item.playerCount,
      seasonCount: item.seasonCount,
      uniqueSeasonCount: item.uniqueSeasonCount,
      uniqueClubCount: item.uniqueClubCount,
      largestClubName: item.largestClubName,
      largestClubShare: item.largestClubShare,
      bigSixShare: item.bigSixShare,
      bestAnswer: item.bestAnswer ? {
        playerId: item.bestAnswer.playerId,
        playerName: item.bestAnswer.playerName,
        season: item.bestAnswer.season,
        club: item.bestAnswer.club,
        points: item.bestAnswer.points
      } : null,
      topAnswers: item.topAnswers.map(answer => ({
        playerId: answer.playerId,
        playerName: answer.playerName,
        season: answer.season,
        club: answer.club,
        points: answer.points
      })),
      topGapRatio: item.topGapRatio,
      topToFifthRatio: item.topToFifthRatio,
      bestRepeatCount,
      maxPoolOverlap: overlap.max,
      averageTopThreeOverlap: overlap.averageTopThree,
      closestPromptId: overlap.closestId,
      closestPromptLabel: overlap.closestLabel,
      labelSimilarity: overlap.labelSimilarity,
      similarLabelId: overlap.similarLabelId,
      similarLabel: overlap.similarLabel,
      errorCount: item.errorCount,
      errorSamples: item.errorSamples,
      flags,
      recommendations,
      components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value * 10) / 10]))
    };
  }

  function renderSummary(elements) {
    const total = analysisResults.length;
    const bands = countBy(analysisResults, result => result.quality);
    const enabled = analysisResults.filter(result => result.enabled).length;
    const suggestedDisable = analysisResults.filter(result => !result.suggestedEnabled && result.enabled).length;
    const average = total ? Math.round(analysisResults.reduce((sum, result) => sum + result.score, 0) / total) : 0;

    elements.summary.classList.remove("hidden");
    elements.controls.classList.remove("hidden");
    elements.summary.innerHTML = `
      <article><span>Analysed</span><strong>${total.toLocaleString()}</strong></article>
      <article><span>Average score</span><strong>${average}/100</strong></article>
      <article><span>Excellent</span><strong>${bands.get("excellent") || 0}</strong></article>
      <article><span>Good</span><strong>${bands.get("good") || 0}</strong></article>
      <article><span>Needs attention</span><strong>${(bands.get("review") || 0) + (bands.get("poor") || 0) + (bands.get("broken") || 0)}</strong></article>
      <article><span>Enabled</span><strong>${enabled}</strong></article>
      <article><span>Suggested disables</span><strong>${suggestedDisable}</strong></article>
    `;
  }

  function renderResults(elements) {
    if (!analysisResults.length) return;
    const query = normaliseLabel(elements.search.value);
    const position = elements.position.value;
    const quality = elements.quality.value;
    const issue = elements.issue.value;
    const sort = elements.sort.value;

    const filtered = analysisResults.filter(result => {
      if (position !== "all" && result.position !== position) return false;
      if (quality !== "all" && result.quality !== quality) return false;
      if (issue !== "all" && !result.flags.includes(issue)) return false;
      if (query && !normaliseLabel(`${result.id} ${result.label} ${result.flags.join(" ")}`).includes(query)) return false;
      return true;
    });

    filtered.sort((left, right) => {
      if (sort === "score-desc") return right.score - left.score || comparePrompt(left, right);
      if (sort === "score-asc") return left.score - right.score || comparePrompt(left, right);
      if (sort === "players-asc") return left.playerCount - right.playerCount || comparePrompt(left, right);
      if (sort === "players-desc") return right.playerCount - left.playerCount || comparePrompt(left, right);
      if (sort === "overlap-desc") return right.maxPoolOverlap - left.maxPoolOverlap || comparePrompt(left, right);
      if (sort === "quality") return QUALITY_ORDER[right.quality] - QUALITY_ORDER[left.quality] || right.score - left.score;
      return comparePrompt(left, right);
    });

    elements.listSummary.textContent = `${filtered.length.toLocaleString()} of ${analysisResults.length.toLocaleString()} analysed prompts shown`;
    elements.list.innerHTML = filtered.length ? filtered.map(renderQualityCard).join("") : '<div class="quality-empty">No prompts match these filters.</div>';
  }

  function renderQualityCard(result) {
    const best = result.bestAnswer
      ? `${escapeHtml(result.bestAnswer.playerName)} · ${escapeHtml(result.bestAnswer.season)} · ${Number(result.bestAnswer.points).toLocaleString()} pts`
      : "No valid answer";
    const issues = result.flags.length
      ? result.flags.map(flag => `<span class="quality-issue">${escapeHtml(issueLabel(flag))}</span>`).join("")
      : '<span class="quality-issue clear">No major issues</span>';
    const recommendations = result.recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const ratingChange = result.suggestedRating === result.currentRating
      ? `Keep rating ${result.currentRating}/5`
      : `Rating ${result.currentRating}/5 → ${result.suggestedRating}/5`;

    return `<article class="quality-card ${result.quality}" data-prompt-id="${escapeAttribute(result.id)}">
      <div class="quality-card-head">
        <div class="quality-title">
          <span class="position-badge">${escapeHtml(result.position)}</span>
          <div><h4>${escapeHtml(result.label)}</h4><p>${escapeHtml(result.id)}</p></div>
        </div>
        <div class="quality-score"><strong>${result.score}</strong><span>/100</span><em>${escapeHtml(qualityLabel(result.quality))}</em></div>
      </div>
      <div class="quality-meter"><span style="width:${result.score}%"></span></div>
      <div class="quality-metrics">
        <span><b>${result.playerCount}</b> players</span>
        <span><b>${result.seasonCount}</b> seasons</span>
        <span><b>${result.uniqueSeasonCount}</b> season years</span>
        <span><b>${result.uniqueClubCount}</b> clubs</span>
        <span><b>${formatPercent(result.maxPoolOverlap)}</b> max overlap</span>
        <span><b>${formatPercent(result.bigSixShare)}</b> Big Six</span>
      </div>
      <div class="quality-detail-grid">
        <div><span>Best answer</span><strong>${best}</strong></div>
        <div><span>Largest club share</span><strong>${escapeHtml(result.largestClubName)} · ${formatPercent(result.largestClubShare)}</strong></div>
        <div><span>Closest answer pool</span><strong>${result.closestPromptLabel ? `${escapeHtml(result.closestPromptLabel)} · ${formatPercent(result.maxPoolOverlap)}` : "None"}</strong></div>
        <div><span>Recommendation</span><strong>${escapeHtml(ratingChange)} · ${result.suggestedEnabled ? "Keep enabled" : "Disable for review"}</strong></div>
      </div>
      <div class="quality-issues">${issues}</div>
      <details class="quality-details"><summary>Why it received this score</summary>
        <div class="quality-component-grid">
          ${Object.entries(result.components).map(([key, value]) => `<span>${escapeHtml(componentLabel(key))}<b>${value}</b></span>`).join("")}
        </div>
        <ul>${recommendations}</ul>
      </details>
    </article>`;
  }

  function applyRecommendations(elements, core, options) {
    if (!analysisResults.length) return;
    const targets = analysisResults.filter(result => options.ratings || (!result.suggestedEnabled && result.enabled));
    if (!targets.length) {
      elements.status.textContent = options.disable ? "No enabled prompts are recommended for disabling." : "There are no rating suggestions to apply.";
      return;
    }

    const message = options.disable
      ? `Disable ${targets.filter(result => !result.suggestedEnabled && result.enabled).length} low-quality prompt(s) in this browser workspace? You can still reset the browser edits later.`
      : `Apply the suggested quality rating to ${targets.length} analysed prompt(s) in this browser workspace?`;
    if (!window.confirm(message)) return;

    const library = core.getPromptLibrary?.() || [];
    const state = loadManagerState();
    let changed = 0;

    for (const result of analysisResults) {
      const prompt = library.find(item => item.id === result.id);
      if (!prompt) continue;
      let shouldPersist = false;
      if (options.ratings && prompt.rating !== result.suggestedRating) {
        prompt.rating = result.suggestedRating;
        shouldPersist = true;
      }
      if (options.disable && !result.suggestedEnabled && prompt.enabled !== false) {
        prompt.enabled = false;
        shouldPersist = true;
      }
      if (!shouldPersist) continue;
      persistPromptMetadata(state, prompt);
      changed += 1;
    }

    if (!changed) {
      elements.status.textContent = "The analysed prompts already match those recommendations.";
      return;
    }

    localStorage.setItem(MANAGER_STORAGE_KEY, JSON.stringify(state));
    elements.status.textContent = `${changed} browser-only prompt setting(s) updated. Reloading the Studio…`;
    window.setTimeout(() => window.location.reload(), 450);
  }

  function persistPromptMetadata(state, prompt) {
    const metadata = {
      label: prompt.label,
      fail: prompt.fail,
      difficulty: prompt.difficulty,
      tags: [...(prompt.tags || [])],
      rating: prompt.rating,
      cooldown: prompt.cooldown,
      enabled: prompt.enabled !== false
    };
    const customIndex = state.customs.findIndex(item => item.id === prompt.id);
    if (customIndex >= 0 || prompt.studioRule) {
      const source = customIndex >= 0 ? state.customs[customIndex] : {};
      const serialised = {
        ...source,
        id: prompt.id,
        position: prompt.position,
        label: prompt.label,
        fail: prompt.fail,
        difficulty: prompt.difficulty,
        tags: [...(prompt.tags || [])],
        rating: prompt.rating,
        cooldown: prompt.cooldown,
        enabled: prompt.enabled !== false,
        studioRule: prompt.studioRule || source.studioRule,
        testSource: prompt.test?.toString?.() || source.testSource
      };
      if (customIndex >= 0) state.customs[customIndex] = serialised;
      else state.customs.push(serialised);
      return;
    }
    state.overrides[prompt.id] = { ...(state.overrides[prompt.id] || {}), ...metadata };
  }

  function loadManagerState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MANAGER_STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") {
        return {
          version: 1,
          overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
          customs: Array.isArray(parsed.customs) ? parsed.customs : [],
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
        };
      }
    } catch (error) {
      console.warn("Prompt manager state could not be read.", error);
    }
    return { version: 1, overrides: {}, customs: [], deletedIds: [] };
  }

  function downloadJsonReport() {
    if (!analysisResults.length) return;
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      database: {
        players: Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS.length : 0,
        playerSeasons: Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS.reduce((sum, player) => sum + (player.seasons?.length || 0), 0) : 0
      },
      summary: buildSummaryObject(),
      prompts: analysisResults.map(copyResult)
    };
    downloadText("prompt-quality-report.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }

  function downloadCsvReport() {
    if (!analysisResults.length) return;
    const headers = [
      "id", "position", "label", "enabled", "difficulty", "score", "quality", "currentRating", "suggestedRating", "suggestedEnabled",
      "playerCount", "seasonCount", "uniqueSeasonCount", "uniqueClubCount", "largestClub", "largestClubShare", "bigSixShare",
      "bestAnswer", "bestAnswerSeason", "bestAnswerPoints", "maxPoolOverlap", "closestPromptId", "flags", "recommendations"
    ];
    const rows = analysisResults.map(result => [
      result.id, result.position, result.label, result.enabled, result.difficulty, result.score, result.quality, result.currentRating,
      result.suggestedRating, result.suggestedEnabled, result.playerCount, result.seasonCount, result.uniqueSeasonCount, result.uniqueClubCount,
      result.largestClubName, result.largestClubShare, result.bigSixShare, result.bestAnswer?.playerName || "", result.bestAnswer?.season || "",
      result.bestAnswer?.points ?? "", result.maxPoolOverlap, result.closestPromptId || "", result.flags.join("|"), result.recommendations.join(" | ")
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
    downloadText("prompt-quality-report.csv", csv, "text/csv;charset=utf-8");
  }

  function buildSummaryObject() {
    const bands = Object.fromEntries(countBy(analysisResults, result => result.quality));
    return {
      analysed: analysisResults.length,
      averageScore: analysisResults.length ? Math.round(analysisResults.reduce((sum, result) => sum + result.score, 0) / analysisResults.length) : 0,
      qualityBands: bands,
      suggestedDisables: analysisResults.filter(result => !result.suggestedEnabled && result.enabled).length,
      difficultyMismatches: analysisResults.filter(result => result.flags.includes("difficulty-mismatch")).length,
      highOverlap: analysisResults.filter(result => result.flags.includes("high-overlap")).length
    };
  }

  function setRunningState(elements, isRunning) {
    elements.runBtn.disabled = isRunning;
    elements.cancelBtn.disabled = !isRunning;
    elements.scope.disabled = isRunning;
    if (!isRunning) elements.cancelBtn.textContent = "Cancel analysis";
  }

  function clearOutput(elements) {
    elements.summary.classList.add("hidden");
    elements.controls.classList.add("hidden");
    elements.list.innerHTML = "";
    elements.listSummary.textContent = "";
    enableReportActions(elements, false);
    elements.progressWrap.classList.remove("hidden");
    updateProgress(elements, 0, 1, "Starting…");
  }

  function enableReportActions(elements, enabled) {
    elements.ratingsBtn.disabled = !enabled;
    elements.disableBtn.disabled = !enabled;
    elements.jsonBtn.disabled = !enabled;
    elements.csvBtn.disabled = !enabled;
  }

  function updateProgress(elements, current, total, label) {
    const percent = total ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressWrap.setAttribute("aria-valuenow", String(Math.round(percent)));
    elements.progressText.textContent = `${label} · ${Math.round(percent)}%`;
  }

  function breadthScore(count, range) {
    if (count <= 0) return 0;
    if (count < range.narrow) return 20 * (count / range.narrow) * 0.55;
    if (count < range.idealLow) return 11 + ((count - range.narrow) / Math.max(1, range.idealLow - range.narrow)) * 9;
    if (count <= range.idealHigh) return 20;
    if (count <= range.broad) return 20 - ((count - range.idealHigh) / Math.max(1, range.broad - range.idealHigh)) * 12;
    return Math.max(1, 8 - ((count - range.broad) / range.broad) * 7);
  }

  function spreadScore(largestShare, maximum) {
    if (!Number.isFinite(largestShare)) return 0;
    if (largestShare <= 0.2) return maximum;
    if (largestShare <= 0.35) return maximum - ((largestShare - 0.2) / 0.15) * 4;
    if (largestShare <= 0.55) return maximum - 4 - ((largestShare - 0.35) / 0.2) * 6;
    return Math.max(1, maximum - 10 - ((largestShare - 0.55) / 0.45) * 5);
  }

  function eliteBalanceScore(bigSixShare, prompt) {
    if (explicitElitePrompt(prompt)) return 8;
    if (bigSixShare <= 0.45) return 10;
    if (bigSixShare <= 0.65) return 8;
    if (bigSixShare <= 0.8) return 5;
    if (bigSixShare <= 0.92) return 3;
    return 1;
  }

  function obviousnessScore(topGap, topToFifth, repeatCount) {
    let score = 15;
    if (topGap > 0.12) score -= Math.min(6, (topGap - 0.12) * 16);
    if (topToFifth > 0.35) score -= Math.min(7, (topToFifth - 0.35) * 12);
    if (repeatCount > 4) score -= Math.min(4, (repeatCount - 4) * 0.7);
    return Math.max(0, score);
  }

  function overlapScore(overlap) {
    if (overlap <= 0.25) return 20;
    if (overlap <= 0.45) return 20 - ((overlap - 0.25) / 0.2) * 4;
    if (overlap <= 0.65) return 16 - ((overlap - 0.45) / 0.2) * 6;
    if (overlap <= 0.82) return 10 - ((overlap - 0.65) / 0.17) * 6;
    return Math.max(0, 4 - ((overlap - 0.82) / 0.18) * 4);
  }

  function difficultyFitScore(prompt, count) {
    const inferred = inferDifficulty(prompt.position, count);
    if (prompt.difficulty === inferred) return 5;
    const values = { easy: 1, medium: 2, hard: 3 };
    return Math.abs((values[prompt.difficulty] || 2) - (values[inferred] || 2)) === 1 ? 3 : 1;
  }

  function inferDifficulty(position, count) {
    const thresholds = position === "GK"
      ? { hard: 7, medium: 20 }
      : position === "FWD"
        ? { hard: 9, medium: 28 }
        : { hard: 13, medium: 45 };
    if (count <= thresholds.hard) return "hard";
    if (count <= thresholds.medium) return "medium";
    return "easy";
  }

  function qualityBand(score, errorCount, playerCount) {
    if (errorCount || playerCount === 0) return "broken";
    if (score >= 85) return "excellent";
    if (score >= 72) return "good";
    if (score >= 58) return "fair";
    if (score >= 42) return "review";
    return "poor";
  }

  function explicitElitePrompt(prompt) {
    const text = normaliseLabel(`${prompt.label} ${(prompt.tags || []).join(" ")}`);
    return /big six|top four|champion|league winner|arsenal|chelsea|liverpool|man city|man utd|spurs/.test(text);
  }

  function updatePoolOverlap(data, otherPrompt, value) {
    data.values.push(value);
    if (value > data.max) {
      data.max = value;
      data.closestId = otherPrompt.id;
      data.closestLabel = otherPrompt.label;
    }
  }

  function updateLabelSimilarity(data, otherPrompt, value) {
    if (value > data.labelSimilarity) {
      data.labelSimilarity = value;
      data.similarLabelId = otherPrompt.id;
      data.similarLabel = otherPrompt.label;
    }
  }

  function jaccard(left, right) {
    if (!left.size && !right.size) return 1;
    if (!left.size || !right.size) return 0;
    const smaller = left.size <= right.size ? left : right;
    const larger = left.size <= right.size ? right : left;
    let intersection = 0;
    for (const value of smaller) if (larger.has(value)) intersection += 1;
    return intersection / (left.size + right.size - intersection);
  }

  function tokenSimilarity(left, right) {
    const leftSet = new Set(left.split(/\s+/).filter(Boolean));
    const rightSet = new Set(right.split(/\s+/).filter(Boolean));
    if (!leftSet.size || !rightSet.size) return 0;
    return jaccard(leftSet, rightSet);
  }

  function countBy(items, getKey) {
    const counts = new Map();
    for (const item of items) {
      const key = getKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  function largestEntry(map) {
    let largest = null;
    for (const entry of map.entries()) if (!largest || entry[1] > largest[1]) largest = entry;
    return largest;
  }

  function comparePrompt(left, right) {
    return (POSITION_ORDER[left.position] ?? 99) - (POSITION_ORDER[right.position] ?? 99) || left.label.localeCompare(right.label);
  }

  function seasonValue(season) {
    const value = Number.parseInt(String(season || "").slice(0, 4), 10);
    return Number.isFinite(value) ? value : 0;
  }

  function qualityLabel(value) {
    return ({ excellent: "Excellent", good: "Good", fair: "Fair", review: "Needs review", poor: "Poor", broken: "Broken" })[value] || capitalise(value);
  }

  function issueLabel(value) {
    return ({
      "broken-rule": "Broken rule", "no-answers": "No answers", "too-narrow": "Too narrow", "too-broad": "Too broad",
      "high-overlap": "High overlap", "similar-wording": "Similar wording", "too-obvious": "Obvious leader",
      "repeated-leader": "Repeated leader", "club-dominated": "Club dominated", "big-six-heavy": "Big Six heavy",
      "low-season-spread": "Low season spread", "difficulty-mismatch": "Difficulty mismatch"
    })[value] || capitalise(value.replaceAll("-", " "));
  }

  function componentLabel(value) {
    return ({
      answerBreadth: "Answer breadth", seasonDiversity: "Season diversity", clubSpread: "Club spread", bigSixBalance: "Anti-meta balance",
      answerObviousness: "Answer variety", poolUniqueness: "Pool uniqueness", difficultyFit: "Difficulty fit", ruleHealth: "Rule health"
    })[value] || capitalise(value);
  }

  function formatPercent(value) {
    return `${Math.round((Number(value) || 0) * 100)}%`;
  }

  function normaliseLabel(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function capitalise(value) {
    return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function nextFrame() {
    return new Promise(resolve => window.setTimeout(resolve, 0));
  }

  function copyResult(result) {
    return JSON.parse(JSON.stringify(result));
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();
