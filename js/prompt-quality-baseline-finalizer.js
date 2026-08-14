/* FPL Challenge Studio — quality prompt baseline finalizer v1.0.0
   Treats the approved 5-star V1/V2/V3 quality prompts as repository baseline prompts.
   V3 prompts that missed the 5-star gate stay available for inspection but are disabled. */
(() => {
  "use strict";

  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  let attempts = 0;

  function packIds(pack) {
    return new Set(Array.isArray(pack?.ids) ? pack.ids.map(String) : []);
  }

  function finalise() {
    const v1 = window.FPL_QUALITY_PROMPT_PACK_V1;
    const v2 = window.FPL_QUALITY_PROMPT_PACK_V2;
    const v3 = window.FPL_QUALITY_PROMPT_PACK_V3;
    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;
    if (!library || !v1?.ready || !v2?.ready || !v3?.ready) return false;

    const v1Ids = packIds(v1);
    const v2Ids = packIds(v2);
    const v3Ids = packIds(v3);
    const allIds = new Set([...v1Ids, ...v2Ids, ...v3Ids]);
    const approved = [];
    const withheld = [];

    for (const prompt of library) {
      if (!allIds.has(String(prompt?.id || ""))) continue;
      const tags = new Set(Array.isArray(prompt.tags) ? prompt.tags : []);
      tags.add("quality-pack");
      tags.add("quality-baseline");

      if (Number(prompt.rating) === 5) {
        tags.add("approved-5-star");
        tags.delete("quality-withheld");
        prompt.enabled = true;
        prompt._studioBuiltIn = true;
        prompt._studioCustom = false;
        approved.push(prompt);
      } else {
        tags.add("quality-withheld");
        tags.delete("approved-5-star");
        prompt.enabled = false;
        prompt._studioBuiltIn = true;
        prompt._studioCustom = false;
        withheld.push(prompt);
      }
      prompt.tags = [...tags];
    }

    const byPosition = Object.fromEntries(POSITIONS.map(position => [
      position,
      approved.filter(prompt => prompt.position === position).length
    ]));

    window.FPL_QUALITY_PROMPT_BASELINE = Object.freeze({
      ready: true,
      version: "1.0.0",
      approved: approved.length,
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
        <div><small>APPROVED QUALITY BASELINE</small><strong>${baseline.approved} permanent 5★ prompts</strong></div>
        <span>${baseline.withheld} V3 held back</span>
      </div>
      <div class="quality-baseline-grid">
        <span><b>GK</b>${Number(by.GK || 0)}</span>
        <span><b>DEF</b>${Number(by.DEF || 0)}</span>
        <span><b>MID</b>${Number(by.MID || 0)}</span>
        <span><b>FWD</b>${Number(by.FWD || 0)}</span>
      </div>
      <p>These prompts are now treated as built-in Studio baseline prompts and are available to Daily Challenge generation. Anything below the 5★ gate remains disabled.</p>`;

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
    if (attempts < 50) setTimeout(retry, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
  window.addEventListener("fpl:prompt-tools-ready", retry);
})();
