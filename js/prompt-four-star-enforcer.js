/* FPL Challenge Studio — four-star prompt floor enforcer v1.0.3
   One-time-per-library analysis that removes prompts rated below 4★ by the Quality
   Analyser. Rejections are cached only against the exact prompt + player-data snapshot;
   they are not persisted as manual Prompt Manager deletions. */
(() => {
  "use strict";

  if (window.__FPL_FOUR_STAR_ENFORCER_V1__) return;
  window.__FPL_FOUR_STAR_ENFORCER_V1__ = true;

  // Keep the cache schema/version stable: v1.0.3 only adds Daily Challenge boot/progress reporting.
  const CACHE_VERSION = "1.0.2";
  const SCRIPT_VERSION = "1.0.3";
  const CACHE_KEY = "fplPromptFourStarFloorV1";
  const MINIMUM_RATING = 4;
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
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", { detail: { reason: "four-star-floor", removed } }));
    return removed;
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
      style.textContent = `.four-star-library-floor{margin:0 0 14px;padding:12px 13px;border:1px solid rgba(57,232,143,.22);border-radius:13px;background:rgba(57,232,143,.055);color:#a8c8b6;font-size:.72rem;line-height:1.45}.four-star-library-floor strong{color:#63eaa1}.four-star-library-floor[data-state="working"]{border-color:rgba(98,201,255,.22);background:rgba(98,201,255,.05);color:#a9c8d8}.four-star-library-floor[data-state="working"] strong{color:#62c9ff}`;
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
          ? `Rechecking the certified 4★+ prompt pool… ${percent}% (${safeCurrent.toLocaleString("en-GB")} / ${safeTotal.toLocaleString("en-GB")}). This runs after prompt or player-data changes.`
          : "Loading the prompt-quality engine for Daily Challenge…";
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

  function publishMeta(sourceCount, rejectedIds, removed, fromCache) {
    const finalLibrary = library();
    const four = finalLibrary.filter(prompt => Number(prompt.rating) === 4).length;
    const five = finalLibrary.filter(prompt => Number(prompt.rating) === 5).length;
    const deletedDisabled = disabledDeletedCount();
    window.FPL_FOUR_STAR_LIBRARY = Object.freeze({
      ready: true,
      version: CACHE_VERSION,
      scriptVersion: SCRIPT_VERSION,
      minimumRating: MINIMUM_RATING,
      analysed: sourceCount,
      analyserRejected: rejectedIds.length,
      removed,
      disabledDeleted: deletedDisabled,
      total: finalLibrary.length,
      fourStarStoredRating: four,
      fiveStarStoredRating: five,
      fromCache: Boolean(fromCache)
    });
    publishProgress(sourceCount, sourceCount, "ready");
    window.dispatchEvent(new CustomEvent("fpl:four-star-library-ready", { detail: window.FPL_FOUR_STAR_LIBRARY }));
    setStatus(`<strong>4★+ library enforced.</strong> ${rejectedIds.length} analyser-rated prompt${rejectedIds.length === 1 ? "" : "s"} below 4★ removed · ${deletedDisabled} previously disabled prompt${deletedDisabled === 1 ? "" : "s"} deleted · ${finalLibrary.length.toLocaleString("en-GB")} prompts remain.`);
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
        const removedCached = removeIds(cached.rejectedIds);
        if (!cached.finalFingerprint || finalLibraryFingerprint(library()) === cached.finalFingerprint) {
          publishMeta(Number(cached.analysed || sourceSnapshot.length), cached.rejectedIds, removedCached, true);
          return true;
        }
        restoreLibrary(sourceSnapshot);
        console.warn("Four-star cache final fingerprint did not match; rebuilding from the current source library.");
      }

      const source = library().slice();
      const freshSourceFingerprint = sourceFingerprint(source, players);
      publishProgress(0, source.length, "working");
      setStatus(`<strong>Finalising the 4★+ library…</strong> Rechecking ${source.length.toLocaleString("en-GB")} prompts with the same full Quality Analyser rules. This only needs to run again when prompts or player data change.`, "working");
      const results = await engine.analyseLibrary(source, players, {
        progress: (current, total) => {
          const now = Date.now();
          if (now - lastProgressPaint < 350 && current < total) return;
          lastProgressPaint = now;
          const percent = total ? Math.round((current / total) * 100) : 0;
          publishProgress(current, total, "working");
          setStatus(`<strong>Finalising the 4★+ library… ${percent}%</strong> Checking answer breadth, overlap, variety and rule health before removing anything below the agreed quality floor.`, "working");
        }
      });
      const rejectedIds = results
        .filter(result => Number(result?.suggestedRating || 0) < MINIMUM_RATING)
        .map(result => String(result.id || ""))
        .filter(Boolean);

      const removed = removeIds(rejectedIds);
      const finalFingerprint = finalLibraryFingerprint(library());
      writeCache({
        version: CACHE_VERSION,
        analysed: source.length,
        sourceFingerprint: freshSourceFingerprint,
        rejectedIds,
        finalFingerprint,
        createdAt: new Date().toISOString()
      });
      publishMeta(source.length, rejectedIds, removed, false);
      return true;
    } catch (error) {
      const message = `4★+ cleanup could not finish: ${String(error?.message || error || "Unknown error")}`;
      console.error("Four-star prompt floor could not be enforced.", error);
      publishProgress(0, 0, "fail", message);
      setStatus(`<strong>4★+ cleanup could not finish.</strong> ${String(error?.message || error || "Unknown error")}`, "working");
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