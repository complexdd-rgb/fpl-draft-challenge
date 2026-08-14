/* FPL Challenge Studio — Quality Prompt Pack v2 status v1.0.0 */
(() => {
  "use strict";
  let attempts = 0;

  function render() {
    const pack = window.FPL_QUALITY_PROMPT_PACK_V2;
    const factory = document.getElementById("automaticPromptFactory");
    if (!pack?.ready || !factory) return false;

    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
    const ids = new Set(Array.isArray(pack.ids) ? pack.ids : []);
    const fiveStar = library.filter(prompt => ids.has(prompt?.id) && Number(prompt?.rating) === 5).length;
    const by = pack.byPosition || {};

    let panel = document.getElementById("qualityPromptPackV2Status");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "qualityPromptPackV2Status";
      panel.className = "quality-pack-v2-status-card";
      const v1 = document.getElementById("qualityPromptPackStatus");
      if (v1?.parentNode === factory.parentNode) v1.after(panel);
      else factory.before(panel);
    }

    panel.innerHTML = `
      <div class="quality-pack-v2-status-head">
        <div><small>QUALITY PROMPT PACK V2</small><strong>${Number(pack.added || 0).toLocaleString("en-GB")} checked prompts added</strong></div>
        <span>${fiveStar} rated 5★</span>
      </div>
      <div class="quality-pack-v2-position-grid">
        <span><b>GK</b>${Number(by.GK || 0)}</span><span><b>DEF</b>${Number(by.DEF || 0)}</span>
        <span><b>MID</b>${Number(by.MID || 0)}</span><span><b>FWD</b>${Number(by.FWD || 0)}</span>
      </div>
      <p>Different concepts from V1: value, age, discipline and specialist-stat combinations. Only position-aware answer pools survive and near-duplicate pools are rejected.</p>`;

    if (!document.getElementById("qualityPromptPackV2StatusStyles")) {
      const style = document.createElement("style");
      style.id = "qualityPromptPackV2StatusStyles";
      style.textContent = `.quality-pack-v2-status-card{margin:10px 0 12px;padding:14px;border:1px solid rgba(98,201,255,.22);border-radius:16px;background:linear-gradient(135deg,rgba(98,201,255,.065),rgba(57,232,143,.035))}.quality-pack-v2-status-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.quality-pack-v2-status-head small{display:block;color:#a4ff5c;font-size:.64rem;font-weight:950;letter-spacing:.09em}.quality-pack-v2-status-head strong{display:block;margin-top:4px;color:#f4fff8;font-size:.98rem}.quality-pack-v2-status-head span{flex:0 0 auto;padding:5px 8px;border:1px solid rgba(98,201,255,.2);border-radius:999px;color:#63eaa1;font-size:.66rem;font-weight:900}.quality-pack-v2-position-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px}.quality-pack-v2-position-grid span{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 9px;border:1px solid rgba(174,226,199,.1);border-radius:10px;background:rgba(0,0,0,.1);color:#f4fff8;font-size:.76rem;font-weight:900}.quality-pack-v2-position-grid b{color:#9bb7a8;font-size:.64rem}.quality-pack-v2-status-card p{margin:11px 0 0;color:#9bb7a8;font-size:.72rem;line-height:1.45}@media(max-width:420px){.quality-pack-v2-position-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.quality-pack-v2-status-head{align-items:center}.quality-pack-v2-status-head strong{font-size:.9rem}}`;
      document.head.appendChild(style);
    }
    return true;
  }

  function retry() {
    if (render()) return;
    attempts += 1;
    if (attempts < 40) setTimeout(retry, 150);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
  window.addEventListener("fpl:prompt-tools-ready", retry);
})();
