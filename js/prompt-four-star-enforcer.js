/* FPL Challenge Studio — Prompt Quality Enforcement v2
   Keeps the live Daily Challenge pool at 4★+ while treating promising new-family prompts
   differently from genuinely broken/duplicate material. Clean borderline 3★ prompts are
   retained in a refinement incubator; selected novel prompts can receive a small, capped
   family-diversity rescue into the certified 4★ pool. */
(() => {
  "use strict";

  if (window.__FPL_PROMPT_QUALITY_ENFORCEMENT_V2__) return;
  window.__FPL_PROMPT_QUALITY_ENFORCEMENT_V2__ = true;
  // Keep the legacy guard set too so an older cached copy cannot start a second pass.
  window.__FPL_FOUR_STAR_ENFORCER_V1__ = true;

  const CACHE_VERSION = "2.0.0";
  const SCRIPT_VERSION = "2.0.0";
  const CACHE_KEY = "fplPromptFourStarFloorV1";
  const INCUBATOR_KEY = "fplPromptQualityIncubatorV2";
  const MINIMUM_RATING = 4;
  const PROMISING_RATING = 3;
  const PROMISING_MIN_SCORE = 58;
  const RESCUE_MIN_RAW_SCORE = 66;
  const RESCUE_TARGET_SCORE = 72;
  const HARD_OVERLAP = 0.97;
  const RESCUE_MAX_OVERLAP = 0.94;
  const HARD_ISSUES = new Set(["broken-rule", "no-answers", "runtime-error", "invalid-rule"]);

  let running = false;
  let attempts = 0;
  let lastProgressPaint = 0;

  function library() {
    const apiLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(apiLibrary) ? apiLibrary : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function hashText(text, seed = 2166136261) {
    let hash = seed >>> 0;
    const value = String(text || "");
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function promptFingerprint(items) {
    const signatures = items.map(prompt => [
      String(prompt?.id || ""),
      String(prompt?.rating ?? ""),
      prompt?.enabled === false ? "0" : "1",
      String(prompt?.label || ""),
      String(prompt?.testSource || prompt?.studioRule?.source || prompt?.test || "")
    ].join("|")).sort();
    let hash = 2166136261;
    for (const signature of signatures) hash = hashText(`${signature}\n`, hash);
    return `${items.length}:${hash.toString(16).padStart(8, "0")}`;
  }

  function playerDataFingerprint(players) {
    let hash = 2166136261;
    let positiveRows = 0;
    for (const player of players) {
      hash = hashText(`${String(player?.playerId || player?.name || "")}\n`, hash);
      for (const season of player?.seasons || []) {
        if (Number(season?.minutes) <= 0) continue;
        positiveRows += 1;
        hash = hashText(`${JSON.stringify(season)}\n`, hash);
      }
    }
    return `${players.length}:${positiveRows}:${hash.toString(16).padStart(8, "0")}`;
  }

  function sourceFingerprint(items, players) {
    return `${promptFingerprint(items)}|${playerDataFingerprint(players)}`;
  }

  function finalLibraryFingerprint(items) {
    return promptFingerprint(items);
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return value
        && value.version === CACHE_VERSION
        && typeof value.sourceFingerprint === "string"
        && Array.isArray(value.rejectedIds)
        ? value
        : null;
    } catch (_) { return null; }
  }

  function writeCache(value) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (_) {}
  }

  function issueCodes(result) {
    const values = Array.isArray(result?.issues) ? result.issues : [];
    return values.map(issue => {
      if (typeof issue === "string") return issue;
      return String(issue?.code || issue?.type || issue?.id || issue?.issue || "");
    }).filter(Boolean);
  }

  function overlapValue(result) {
    const values = [
      result?.overlap?.max,
      result?.maxOverlap,
      result?.overlapMax,
      result?.highestOverlap
    ].map(Number).filter(Number.isFinite);
    return values.length ? Math.max(...values) : 0;
  }

  function familyBonus(prompt) {
    const tags = new Set((Array.isArray(prompt?.tags) ? prompt.tags : []).map(tag => String(tag).toLowerCase()));
    let bonus = 0;
    if (tags.has("career-evolution")) bonus += 6;
    if (tags.has("nationality")) bonus += 4;
    if (tags.has("manager") || tags.has("manager-journey")) bonus += 4;
    if (tags.has("career-shape")) bonus += 3;
    if (tags.has("career-total") || tags.has("career-seasons")) bonus += 2;
    if (tags.has("season-rule")) bonus += 2;
    if (tags.has("anti-meta")) bonus += 2;
    if (tags.has("position-journey") || tags.has("club-status-journey")) bonus += 2;
    return Math.min(8, bonus);
  }

  function qualityDecision(prompt, result) {
    const rawRating = Number(result?.suggestedRating || 0);
    const rawScoreValue = Number(result?.score);
    const rawScore = Number.isFinite(rawScoreValue)
      ? rawScoreValue
      : rawRating === 5 ? 85 : rawRating === 4 ? 72 : rawRating === 3 ? 58 : 0;
    const playerCount = Math.max(0, Number(result?.playerCount || 0));
    const overlap = overlapValue(result);
    const issues = issueCodes(result);
    const quality = String(result?.quality || "").toLowerCase();
    const errorCount = Math.max(0, Number(result?.errorCount || 0));
    const hardIssue = issues.some(issue => HARD_ISSUES.has(issue));
    const hardReject = errorCount > 0
      || playerCount < 3
      || quality === "broken"
      || quality === "poor"
      || overlap >= HARD_OVERLAP
      || hardIssue;
    const bonus = hardReject ? 0 : familyBonus(prompt);
    const adjustedScore = Math.min(100, rawScore + bonus);

    if (hardReject) {
      return { state: "rejected", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues, enforcedRating: 0 };
    }
    if (rawRating >= MINIMUM_RATING) {
      return { state: "certified", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues, enforcedRating: Math.max(MINIMUM_RATING, rawRating) };
    }
    if (rawRating === PROMISING_RATING
        && rawScore >= RESCUE_MIN_RAW_SCORE
        && adjustedScore >= RESCUE_TARGET_SCORE
        && overlap < RESCUE_MAX_OVERLAP) {
      return { state: "rescued", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues, enforcedRating: MINIMUM_RATING };
    }
    if (rawRating === PROMISING_RATING && rawScore >= PROMISING_MIN_SCORE) {
      return { state: "incubator", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues, enforcedRating: 0 };
    }
    return { state: "rejected", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues, enforcedRating: 0 };
  }

  function serialisablePrompt(prompt, decision) {
    return {
      id: String(prompt?.id || ""),
      position: String(prompt?.position || ""),
      label: String(prompt?.label || ""),
      fail: String(prompt?.fail || ""),
      difficulty: String(prompt?.difficulty || "medium"),
      tags: Array.isArray(prompt?.tags) ? [...prompt.tags] : [],
      rating: Number(prompt?.rating || 0),
      cooldown: Number(prompt?.cooldown || 0),
      enabled: false,
      studioRule: prompt?.studioRule && typeof prompt.studioRule === "object" ? prompt.studioRule : null,
      testSource: String(prompt?.testSource || prompt?.studioRule?.source || ""),
      qualityV2: {
        state: decision.state,
        rawRating: decision.rawRating,
        rawScore: decision.rawScore,
        adjustedScore: decision.adjustedScore,
        familyBonus: decision.bonus,
        playerCount: decision.playerCount,
        overlap: decision.overlap,
        issues: [...decision.issues]
      }
    };
  }

  function publishIncubator(entries, sourceFp) {
    const payload = {
      version: CACHE_VERSION,
      sourceFingerprint: sourceFp,
      updatedAt: new Date().toISOString(),
      total: entries.length,
      items: entries
    };
    try { localStorage.setItem(INCUBATOR_KEY, JSON.stringify(payload)); } catch (_) {}
    window.FPL_PROMPT_QUALITY_INCUBATOR = Object.freeze({
      ready: true,
      version: CACHE_VERSION,
      total: entries.length,
      items: Object.freeze(entries.map(entry => Object.freeze(entry)))
    });
    window.dispatchEvent(new CustomEvent("fpl:prompt-quality-incubator-ready", { detail: window.FPL_PROMPT_QUALITY_INCUBATOR }));
  }

  function removeIds(ids) {
    const rejected = new Set(ids.map(String));
    const items = library();
    let removed = 0;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (!rejected.has(String(items[index]?.id || ""))) continue;
      items.splice(index, 1);
      removed += 1;
    }
    if (Array.isArray(window.FPL_RECENT_PROMPT_IDS)) {
      window.FPL_RECENT_PROMPT_IDS = window.FPL_RECENT_PROMPT_IDS.filter(id => !rejected.has(String(id)));
    }
    window.FPL_STUDIO_API?.invalidatePromptStats?.();
    const search = document.getElementById("promptManagerSearch");
    if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", { detail: { reason: "quality-enforcement-v2", removed } }));
    return removed;
  }

  function applyCertifiedRatings(ratings = {}) {
    for (const prompt of library()) {
      const id = String(prompt?.id || "");
      const enforced = Number(ratings[id] || 0);
      if (enforced >= MINIMUM_RATING && Number(prompt?.rating || 0) < enforced) prompt.rating = enforced;
    }
  }

  function restoreLibrary(snapshot) {
    const items = library();
    if (!Array.isArray(items)) return;
    items.splice(0, items.length, ...snapshot);
    window.FPL_STUDIO_API?.invalidatePromptStats?.();
  }

  function statusPanel() {
    const analyser = document.getElementById("promptQualityAnalyser");
    if (!analyser) return null;
    let panel = document.getElementById("fourStarLibraryFloorStatus");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "fourStarLibraryFloorStatus";
    panel.className = "four-star-library-floor";
    panel.setAttribute("role", "status");
    const scope = analyser.querySelector("#qualityScope")?.closest("label") || analyser.querySelector("#qualityScope")?.parentElement;
    if (scope?.parentElement) scope.parentElement.insertBefore(panel, scope);
    else analyser.prepend(panel);
    if (!document.getElementById("fourStarLibraryFloorStyles")) {
      const style = document.createElement("style");
      style.id = "fourStarLibraryFloorStyles";
      style.textContent = `.four-star-library-floor{margin:0 0 14px;padding:12px 13px;border:1px solid rgba(57,232,143,.22);border-radius:13px;background:rgba(57,232,143,.055);color:#a8c8b6;font-size:.72rem;line-height:1.45}.four-star-library-floor strong{color:#63eaa1}.four-star-library-floor[data-state="working"]{border-color:rgba(98,201,255,.22);background:rgba(98,201,255,.05);color:#a9c8d8}.four-star-library-floor[data-state="working"] strong{color:#62c9ff}.four-star-library-floor .quality-v2-note{display:block;margin-top:5px;color:#87aa97}`;
      document.head.appendChild(style);
    }
    return panel;
  }

  function setStatus(message, state = "ready") {
    const panel = statusPanel();
    if (!panel) return;
    panel.dataset.state = state;
    panel.innerHTML = message;
  }

  function publishProgress(current, total, state = "working", message = "") {
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const percent = safeTotal ? Math.max(0, Math.min(100, Math.round((safeCurrent / safeTotal) * 100))) : 0;
    const detail = Object.freeze({
      state,
      current: safeCurrent,
      total: safeTotal,
      percent,
      message: String(message || ""),
      scriptVersion: SCRIPT_VERSION
    });
    window.FPL_FOUR_STAR_LIBRARY_PROGRESS = detail;
    window.dispatchEvent(new CustomEvent("fpl:four-star-library-progress", { detail }));

    const batchStatus = document.getElementById("batchStatus");
    const challenge = document.querySelector('[data-workspace="challenge"]');
    if (batchStatus && (!challenge || challenge.hidden === false)) {
      if (state === "working") {
        batchStatus.textContent = safeTotal
          ? `Rechecking the certified 4★+ prompt pool… ${percent}% (${safeCurrent.toLocaleString("en-GB")} / ${safeTotal.toLocaleString("en-GB")}). Quality Enforcement v2 keeps promising 3★ ideas for refinement.`
          : "Loading Prompt Quality Enforcement v2…";
        batchStatus.dataset.state = "working";
      } else if (state === "fail") {
        batchStatus.textContent = message || "The prompt-quality check could not finish.";
        batchStatus.dataset.state = "fail";
      }
    }
  }

  function disabledDeletedCount() {
    const baseline = window.FPL_APPROVED_PROMPT_BASELINE || {};
    return Number(baseline.disabledDeleted || baseline.removedDisabled || 0);
  }

  function publishMeta(sourceCount, decisionCounts, removed, fromCache) {
    const finalLibrary = library();
    const four = finalLibrary.filter(prompt => Number(prompt.rating) === 4).length;
    const five = finalLibrary.filter(prompt => Number(prompt.rating) === 5).length;
    const deletedDisabled = disabledDeletedCount();
    const certified = Number(decisionCounts.certified || 0);
    const rescued = Number(decisionCounts.rescued || 0);
    const incubated = Number(decisionCounts.incubator || 0);
    const rejected = Number(decisionCounts.rejected || 0);
    window.FPL_FOUR_STAR_LIBRARY = Object.freeze({
      ready: true,
      version: CACHE_VERSION,
      scriptVersion: SCRIPT_VERSION,
      policy: "quality-enforcement-v2",
      minimumRating: MINIMUM_RATING,
      analysed: sourceCount,
      analyserRejected: incubated + rejected,
      rescued,
      incubated,
      hardRejected: rejected,
      removed,
      disabledDeleted: deletedDisabled,
      total: finalLibrary.length,
      fourStarStoredRating: four,
      fiveStarStoredRating: five,
      fromCache: Boolean(fromCache)
    });
    window.FPL_PROMPT_QUALITY_ENFORCEMENT_V2 = Object.freeze({
      ready: true,
      certified: certified + rescued,
      rescued,
      incubated,
      rejected,
      liveTotal: finalLibrary.length
    });
    publishProgress(sourceCount, sourceCount, "ready");
    window.dispatchEvent(new CustomEvent("fpl:four-star-library-ready", { detail: window.FPL_FOUR_STAR_LIBRARY }));
    window.dispatchEvent(new CustomEvent("fpl:prompt-quality-enforcement-v2-ready", { detail: window.FPL_PROMPT_QUALITY_ENFORCEMENT_V2 }));
    setStatus(`<strong>4★+ Quality Enforcement v2 complete.</strong> ${finalLibrary.length.toLocaleString("en-GB")} certified prompts remain · ${rescued.toLocaleString("en-GB")} borderline prompt${rescued === 1 ? "" : "s"} rescued by family/diversity scoring · ${incubated.toLocaleString("en-GB")} promising 3★ prompt${incubated === 1 ? "" : "s"} held for refinement · ${rejected.toLocaleString("en-GB")} genuinely unsafe/weak prompt${rejected === 1 ? "" : "s"} rejected.<span class="quality-v2-note">The Daily Challenge still receives only the certified 4★+ pool. Held 3★ prompts are preserved in the refinement incubator instead of being thrown away.</span>`);
  }

  async function enforce() {
    if (running) return true;
    const baseline = window.FPL_APPROVED_PROMPT_BASELINE;
    const engine = window.FPL_PROMPT_QUALITY_ENGINE;
    const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    const items = library();
    if (!baseline?.ready || typeof engine?.analyseLibrary !== "function" || !players.length || !items.length) {
      publishProgress(0, 0, "working");
      return false;
    }

    running = true;
    try {
      const sourceSnapshot = items.slice();
      const currentSourceFingerprint = sourceFingerprint(sourceSnapshot, players);
      const cached = readCache();
      if (cached?.sourceFingerprint === currentSourceFingerprint) {
        applyCertifiedRatings(cached.certifiedRatings || {});
        const removedCached = removeIds(cached.rejectedIds);
        publishIncubator(Array.isArray(cached.incubatorItems) ? cached.incubatorItems : [], currentSourceFingerprint);
        if (!cached.finalFingerprint || finalLibraryFingerprint(library()) === cached.finalFingerprint) {
          publishMeta(Number(cached.analysed || sourceSnapshot.length), cached.decisionCounts || {}, removedCached, true);
          return true;
        }
        restoreLibrary(sourceSnapshot);
        console.warn("Quality Enforcement v2 cache final fingerprint did not match; rebuilding from the current source library.");
      }

      const source = library().slice();
      const sourceById = new Map(source.map(prompt => [String(prompt?.id || ""), prompt]));
      const freshSourceFingerprint = sourceFingerprint(source, players);
      publishProgress(0, source.length, "working");
      setStatus(`<strong>Finalising the 4★+ library with Quality Enforcement v2…</strong> Rechecking ${source.length.toLocaleString("en-GB")} prompts. Broken and duplicate material will still be rejected, while clean borderline new-family ideas can be rescued or held for refinement.`, "working");
      const results = await engine.analyseLibrary(source, players, {
        progress: (current, total) => {
          const now = Date.now();
          if (now - lastProgressPaint < 350 && current < total) return;
          lastProgressPaint = now;
          const percent = total ? Math.round((current / total) * 100) : 0;
          publishProgress(current, total, "working");
          setStatus(`<strong>Quality Enforcement v2… ${percent}%</strong> Checking rule health, answer breadth, overlap and diversity before certifying, rescuing or incubating each prompt.`, "working");
        }
      });

      const rejectedIds = [];
      const incubatorItems = [];
      const certifiedRatings = {};
      const decisionCounts = { certified: 0, rescued: 0, incubator: 0, rejected: 0 };
      const feedback = {};

      for (const result of results) {
        const id = String(result?.id || "");
        if (!id) continue;
        const prompt = sourceById.get(id);
        if (!prompt) continue;
        const decision = qualityDecision(prompt, result);
        decisionCounts[decision.state] = (decisionCounts[decision.state] || 0) + 1;
        feedback[id] = Object.freeze({ ...decision, id });
        if (decision.state === "certified" || decision.state === "rescued") {
          certifiedRatings[id] = decision.enforcedRating;
        } else {
          rejectedIds.push(id);
          if (decision.state === "incubator") incubatorItems.push(serialisablePrompt(prompt, decision));
        }
      }

      window.FPL_PROMPT_QUALITY_FEEDBACK_V2 = Object.freeze(feedback);
      applyCertifiedRatings(certifiedRatings);
      publishIncubator(incubatorItems, freshSourceFingerprint);
      const removed = removeIds(rejectedIds);
      const finalFingerprint = finalLibraryFingerprint(library());
      writeCache({
        version: CACHE_VERSION,
        analysed: source.length,
        sourceFingerprint: freshSourceFingerprint,
        rejectedIds,
        certifiedRatings,
        incubatorItems,
        decisionCounts,
        finalFingerprint,
        createdAt: new Date().toISOString()
      });
      publishMeta(source.length, decisionCounts, removed, false);
      return true;
    } catch (error) {
      const message = `Quality Enforcement v2 could not finish: ${String(error?.message || error || "Unknown error")}`;
      console.error("Prompt Quality Enforcement v2 could not be enforced.", error);
      publishProgress(0, 0, "fail", message);
      setStatus(`<strong>Quality Enforcement v2 could not finish.</strong> ${String(error?.message || error || "Unknown error")}`, "working");
      return true;
    } finally {
      running = false;
    }
  }

  function retry() {
    enforce().then(done => {
      if (done) return;
      attempts += 1;
      if (attempts < 120) setTimeout(retry, 150);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
  window.addEventListener("fpl:approved-prompt-baseline-ready", retry);
  window.addEventListener("fpl:prompt-tools-ready", retry);
})();