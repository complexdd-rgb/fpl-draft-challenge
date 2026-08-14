/* FPL Challenge Studio — Prompt Quality Analyser star-rating UI v1.0.1
   Keeps the analyser's detailed scoring engine intact, but presents its recommendations
   in the same 1–5★ language used by the Prompt Library and generator. */
(() => {
  "use strict";

  if (window.__FPL_PROMPT_ANALYSER_STARS_V1__) return;
  window.__FPL_PROMPT_ANALYSER_STARS_V1__ = true;
  let queued = false;

  const root = () => document.getElementById("promptQualityAnalyser");
  const clampRating = rating => Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  const stars = rating => `${"★".repeat(clampRating(rating))}${"☆".repeat(5 - clampRating(rating))}`;
  const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };

  function optionLabel(selectId, value, label) {
    const option = document.querySelector(`#${selectId} option[value="${value}"]`);
    if (option && option.textContent !== label) option.textContent = label;
  }

  function patchControls() {
    optionLabel("qualityBand", "all", "All star ratings");
    optionLabel("qualityBand", "excellent", "5★");
    optionLabel("qualityBand", "good", "4★");
    optionLabel("qualityBand", "fair", "3★");
    optionLabel("qualityBand", "review", "2★");
    optionLabel("qualityBand", "poor", "1★");
    optionLabel("qualityBand", "broken", "Broken");

    optionLabel("qualitySort", "score-desc", "Star rating: high to low");
    optionLabel("qualitySort", "score-asc", "Star rating: low to high");
    optionLabel("qualitySort", "quality", "Star rating");

    for (const id of ["qualityDisableMode", "qualityDeleteMode"]) {
      optionLabel(id, "recommended", "Analyser recommendations");
      optionLabel(id, "broken", "Broken only");
      optionLabel(id, "poor", "1★ / broken");
      optionLabel(id, "review", "2★ and below");
      optionLabel(id, "fair", "3★ and below");
      optionLabel(id, "filtered", "Prompts currently shown");
    }

    const apply = document.getElementById("applyQualityRatingsBtn");
    if (apply && /rating/i.test(apply.textContent || "") && apply.textContent !== "Apply suggested star ratings") {
      apply.textContent = "Apply suggested star ratings";
    }
  }

  function results() {
    try { return window.FPL_PROMPT_QUALITY_API?.getResults?.() || []; }
    catch (_) { return []; }
  }

  function patchSummary(items) {
    const summary = document.getElementById("promptQualitySummary");
    if (!summary || summary.classList.contains("hidden") || !items.length) return;
    const total = items.length;
    const average = items.reduce((sum, item) => sum + Number(item.suggestedRating || 0), 0) / total;
    const count = rating => items.filter(item => Number(item.suggestedRating) === rating).length;
    const enabled = items.filter(item => item.enabled).length;
    const suggestedDisable = items.filter(item => !item.suggestedEnabled && item.enabled).length;
    const html = `<article><span>Analysed</span><strong>${total.toLocaleString("en-GB")}</strong></article>
      <article><span>Average rating</span><strong>${average.toFixed(1)}★</strong></article>
      <article><span>5★</span><strong>${count(5)}</strong></article>
      <article><span>4★</span><strong>${count(4)}</strong></article>
      <article><span>3★ and below</span><strong>${count(1) + count(2) + count(3)}</strong></article>
      <article><span>Enabled</span><strong>${enabled}</strong></article>
      <article><span>Suggested disables</span><strong>${suggestedDisable}</strong></article>`;
    if (summary.innerHTML.trim() !== html.trim()) summary.innerHTML = html;
  }

  function patchCard(card, byId) {
    const id = String(card?.dataset?.promptId || "");
    const result = byId.get(id);
    if (!result) return;
    const rating = Math.max(1, Math.min(5, Number(result.suggestedRating) || 1));
    const current = Math.max(1, Math.min(5, Number(result.currentRating) || 1));
    const score = card.querySelector(".quality-score");
    if (score) {
      const strong = score.querySelector("strong");
      const span = score.querySelector("span");
      const em = score.querySelector("em");
      setText(strong, `${rating}★`);
      setText(span, stars(rating));
      if (span) span.classList.add("quality-star-strip");
      setText(em, rating === current ? "Keep rating" : "Suggested");
      const aria = `${rating} out of 5 stars`;
      if (score.getAttribute("aria-label") !== aria) score.setAttribute("aria-label", aria);
    }
    const meter = card.querySelector(".quality-meter > span");
    if (meter && meter.style.width !== `${rating * 20}%`) meter.style.width = `${rating * 20}%`;

    for (const detail of card.querySelectorAll(".quality-detail-grid strong")) {
      const text = detail.textContent || "";
      const next = text
        .replace(/Keep rating\s+(\d)\/5/gi, "Keep $1★")
        .replace(/Rating\s+(\d)\/5\s*→\s*(\d)\/5/gi, "$1★ → $2★");
      setText(detail, next);
    }
    const why = card.querySelector(".quality-details > summary");
    if (why && /score/i.test(why.textContent || "")) setText(why, "Why it received this star rating");
  }

  function patchStatus(items) {
    const status = document.getElementById("promptQualityStatus");
    if (!status || !items.length || !/analysis complete/i.test(status.textContent || "")) return;
    const five = items.filter(item => Number(item.suggestedRating) === 5).length;
    const four = items.filter(item => Number(item.suggestedRating) === 4).length;
    const below = items.filter(item => Number(item.suggestedRating) < 4).length;
    setText(status, `Analysis complete: ${five} rated 5★, ${four} rated 4★, ${below} below the 4★ library standard. Nothing has been changed automatically.`);
  }

  function patch() {
    queued = false;
    if (!root()) return;
    patchControls();
    const items = results();
    if (!items.length) return;
    const byId = new Map(items.map(item => [String(item.id || ""), item]));
    patchSummary(items);
    document.querySelectorAll("#promptQualityList .quality-card").forEach(card => patchCard(card, byId));
    patchStatus(items);
  }

  function queuePatch() {
    if (queued) return;
    queued = true;
    queueMicrotask(patch);
  }

  function install() {
    const panel = root();
    if (!panel) return false;
    patchControls();
    if (!document.getElementById("promptAnalyserStarStyles")) {
      const style = document.createElement("style");
      style.id = "promptAnalyserStarStyles";
      style.textContent = `#promptQualityAnalyser .quality-score{min-width:90px}#promptQualityAnalyser .quality-score strong{font-size:1.08rem}#promptQualityAnalyser .quality-star-strip{display:block!important;margin-top:2px;color:#ffd477!important;font-size:.62rem!important;letter-spacing:.04em;white-space:nowrap}#promptQualityAnalyser .quality-score em{margin-top:2px}`;
      document.head.appendChild(style);
    }
    new MutationObserver(queuePatch).observe(panel, { childList: true, subtree: true });
    panel.addEventListener("change", queuePatch);
    panel.addEventListener("click", () => setTimeout(queuePatch, 0));
    queuePatch();
    return true;
  }

  function retry() { if (!install()) setTimeout(retry, 150); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
})();
