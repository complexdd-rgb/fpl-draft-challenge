/* FPL Challenge Studio — quality prompt baseline finalizer v1.2.0
   The project-wide approved prompt standard is now 4★ or 5★. Quality-pack prompts are
   recognised by their tags whether they were loaded from prompt-library.js or generated
   by the V1/V2/V3 checked-pack scripts during Studio startup. */
(() => {
  "use strict";

  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  let attempts = 0;

  function isQualityPackPrompt(prompt) {
    const tags = Array.isArray(prompt?.tags) ? prompt.tags : [];
    return tags.includes("quality-pack-v1") || tags.includes("quality-pack-v2") || tags.includes("quality-pack-v3");
  }

  function finalise() {
    const v1 = window.FPL_QUALITY_PROMPT_PACK_V1;
    const v2 = window.FPL_QUALITY_PROMPT_PACK_V2;
    const v3 = window.FPL_QUALITY_PROMPT_PACK_V3;
    const survivorPack = window.FPL_REFINEMENT_SURVIVOR_PACK_V1;
    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;
    if (!library || !v1?.ready || !v2?.ready || !v3?.ready || !survivorPack?.ready) return false;

    const approved = [];
    const withheld = [];

    for (const prompt of library) {
      if (!isQualityPackPrompt(prompt)) continue;
      const tags = new Set(Array.isArray(prompt.tags) ? prompt.tags : []);
      tags.add("quality-pack");
      tags.add("quality-baseline");
      prompt._studioBuiltIn = true;
      prompt._studioCustom = false;

      if (Number(prompt.rating) >= 4) {
        tags.add("approved-4-plus");
        if (Number(prompt.rating) === 5) tags.add("approved-5-star");
        tags.delete("quality-withheld");
        prompt.enabled = true;
        approved.push(prompt);
      } else {
        tags.add("quality-withheld");
        tags.delete("approved-4-plus");
        tags.delete("approved-5-star");
        prompt.enabled = false;
        withheld.push(prompt);
      }
      prompt.tags = [...tags];
    }

    const byPosition = Object.fromEntries(POSITIONS.map(position => [
      position,
      approved.filter(prompt => prompt.position === position).length
    ]));
    const fourStar = approved.filter(prompt => Number(prompt.rating) === 4).length;
    const fiveStar = approved.filter(prompt => Number(prompt.rating) === 5).length;

    window.FPL_QUALITY_PROMPT_BASELINE = Object.freeze({
      ready: true,
      version: "1.2.0",
      minimumRating: 4,
      approved: approved.length,
      fourStar,
      fiveStar,
      withheld: withheld.length,
      totalChecked: approved.length + withheld.length,
      ids: Object.freeze(approved.map(prompt => prompt.id)),
      withheldIds: Object.freeze(withheld.map(prompt => prompt.id)),
      byPosition: Object.freeze(byPosition)
    });

    window.FPL_STUDIO_API?.invalidatePromptStats?.();
    window.dispatchEvent(new CustomEvent("fpl:quality-prompt-baseline-ready"));
    renderSummary();
    return true;
  }

  function renderSummary() {
    const baseline = window.FPL_QUALITY_PROMPT_BASELINE;
    const factory = document.getElementById("automaticPromptFactory");
    if (!baseline?.ready || !factory) return;

    let panel = document.getElementById("qualityPromptBaselineSummary");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "qualityPromptBaselineSummary";
      panel.className = "quality-baseline-summary";
      const v3Card = document.getElementById("qualityPromptPackV3Status");
      if (v3Card?.parentNode === factory.parentNode) v3Card.after(panel);
      else factory.before(panel);
    }

    const by = baseline.byPosition || {};
    panel.innerHTML = `
      <div class="quality-baseline-head">
        <div><small>APPROVED QUALITY BASELINE</small><strong>${baseline.approved} permanent 4★+ prompts</strong></div>
        <span>${baseline.fiveStar} 5★ · ${baseline.fourStar} 4★</span>
      </div>
      <div class="quality-baseline-grid">
        <span><b>GK</b>${Number(by.GK || 0)}</span>
        <span><b>DEF</b>${Number(by.DEF || 0)}</span>
        <span><b>MID</b>${Number(by.MID || 0)}</span>
        <span><b>FWD</b>${Number(by.FWD || 0)}</span>
      </div>
      <p>The quality packs now use the same project-wide rule as the main Prompt Library: 4★ and 5★ prompts qualify; anything below 4★ is held back.</p>`;

    if (!document.getElementById("qualityPromptBaselineStyles")) {
      const style = document.createElement("style");
      style.id = "qualityPromptBaselineStyles";
      style.textContent = `
        .quality-baseline-summary{margin:10px 0 12px;padding:14px;border:1px solid rgba(57,232,143,.3);border-radius:16px;background:linear-gradient(135deg,rgba(57,232,143,.095),rgba(164,255,92,.035));box-shadow:inset 3px 0 0 rgba(57,232,143,.8)}
        .quality-baseline-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.quality-baseline-head small{display:block;color:#63eaa1;font-size:.64rem;font-weight:950;letter-spacing:.09em}.quality-baseline-head strong{display:block;margin-top:4px;color:#f4fff8;font-size:1rem}.quality-baseline-head span{flex:0 0 auto;padding:5px 8px;border:1px solid rgba(255,212,119,.18);border-radius:999px;color:#ffd477;font-size:.66rem;font-weight:900}.quality-baseline-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px}.quality-baseline-grid span{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 9px;border:1px solid rgba(174,226,199,.1);border-radius:10px;background:rgba(0,0,0,.1);color:#f4fff8;font-size:.76rem;font-weight:900}.quality-baseline-grid b{color:#9bb7a8;font-size:.64rem}.quality-baseline-summary p{margin:11px 0 0;color:#9bb7a8;font-size:.72rem;line-height:1.45}@media(max-width:420px){.quality-baseline-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.quality-baseline-head{align-items:center}.quality-baseline-head strong{font-size:.9rem}}
      `;
      document.head.appendChild(style);
    }
  }

  function retry() {
    if (finalise()) return;
    attempts += 1;
    if (attempts < 60) setTimeout(retry, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
  window.addEventListener("fpl:prompt-tools-ready", retry);
  window.addEventListener("fpl:refinement-survivor-pack-ready", retry);
})();
