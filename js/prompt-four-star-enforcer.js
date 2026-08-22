/* FPL Challenge Studio — four-star prompt floor enforcer v1.0.2
   One-time-per-library analysis that removes prompts rated below 4★ by the Quality
   Analyser. Rejections are cached only against the exact source-library fingerprint;
   they are not persisted as manual Prompt Manager deletions. */
(() => {
  "use strict";

  if (window.__FPL_FOUR_STAR_ENFORCER_V1__) return;
  window.__FPL_FOUR_STAR_ENFORCER_V1__ = true;

  const CACHE_KEY = "fplPromptFourStarFloorV1";
  const VERSION = "1.0.2";
  const MINIMUM_RATING = 4;
  let running = false;
  let attempts = 0;
  let lastProgressPaint = 0;

  function library() {
    const apiLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(apiLibrary) ? apiLibrary : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function fingerprint(items) {
    const text = items.map(prompt => String(prompt?.id || "")).filter(Boolean).sort().join("\n");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${items.length}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return value
        && value.version === VERSION
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
      version: VERSION,
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
    window.dispatchEvent(new CustomEvent("fpl:four-star-library-ready", { detail: window.FPL_FOUR_STAR_LIBRARY }));
    setStatus(`<strong>4★+ library enforced.</strong> ${rejectedIds.length} analyser-rated prompt${rejectedIds.length === 1 ? "" : "s"} below 4★ removed · ${deletedDisabled} previously disabled prompt${deletedDisabled === 1 ? "" : "s"} deleted · ${finalLibrary.length.toLocaleString("en-GB")} prompts remain.`);
  }

  async function enforce() {
    if (running) return true;
    const baseline = window.FPL_APPROVED_PROMPT_BASELINE;
    const engine = window.FPL_PROMPT_QUALITY_ENGINE;
    const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    const items = library();
    if (!baseline?.ready || typeof engine?.analyseLibrary !== "function" || !players.length || !items.length) return false;

    running = true;
    try {
      const sourceFingerprint = fingerprint(items);
      const cached = readCache();
      if (cached?.sourceFingerprint === sourceFingerprint) {
        const removedCached = removeIds(cached.rejectedIds);
        if (!cached.finalFingerprint || fingerprint(library()) === cached.finalFingerprint) {
          publishMeta(Number(cached.analysed || items.length), cached.rejectedIds, removedCached, true);
          return true;
        }
        console.warn("Four-star cache final fingerprint did not match; rebuilding from the current source library.");
      }

      const source = library().slice();
      const freshSourceFingerprint = fingerprint(source);
      setStatus(`<strong>Finalising the 4★+ library…</strong> Rechecking ${source.length.toLocaleString("en-GB")} prompts with the same full Quality Analyser rules. This only needs to run again when the library changes.`, "working");
      const results = await engine.analyseLibrary(source, players, {
        progress: (current, total) => {
          const now = Date.now();
          if (now - lastProgressPaint < 350 && current < total) return;
          lastProgressPaint = now;
          const percent = total ? Math.round((current / total) * 100) : 0;
          setStatus(`<strong>Finalising the 4★+ library… ${percent}%</strong> Checking answer breadth, overlap, variety and rule health before removing anything below the agreed quality floor.`, "working");
        }
      });
      const rejectedIds = results
        .filter(result => Number(result?.suggestedRating || 0) < MINIMUM_RATING)
        .map(result => String(result.id || ""))
        .filter(Boolean);

      const removed = removeIds(rejectedIds);
      const finalFingerprint = fingerprint(library());
      writeCache({
        version: VERSION,
        analysed: source.length,
        sourceFingerprint: freshSourceFingerprint,
        rejectedIds,
        finalFingerprint,
        createdAt: new Date().toISOString()
      });
      publishMeta(source.length, rejectedIds, removed, false);
      return true;
    } catch (error) {
      console.error("Four-star prompt floor could not be enforced.", error);
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