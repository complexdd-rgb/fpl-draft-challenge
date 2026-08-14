/* FPL Challenge Studio — Quality Prompt Pack status v1.0.0
   Keeps the quality-pack result visible after Prompt Studio's manager status is re-rendered. */
(() => {
  "use strict";

  const PANEL_ID = "qualityPromptPackStatus";
  let attempts = 0;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render() {
    const pack = window.FPL_QUALITY_PROMPT_PACK_V1;
    const factory = document.getElementById("automaticPromptFactory");
    if (!pack?.ready || !factory) return false;

    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
    const ids = new Set(Array.isArray(pack.ids) ? pack.ids : []);
    const fiveStar = library.filter(prompt => ids.has(prompt?.id) && Number(prompt?.rating) === 5).length;
    const by = pack.byPosition || {};

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = PANEL_ID;
      panel.className = "quality-pack-status-card";
      const careerPanel = document.getElementById("careerShapeRulePanel");
      if (careerPanel?.parentNode === factory.parentNode) careerPanel.after(panel);
      else factory.before(panel);
    }

    panel.innerHTML = `
      <div class="quality-pack-status-head">
        <div>
          <small>QUALITY PROMPT PACK V1</small>
          <strong>${Number(pack.added || 0).toLocaleString("en-GB")} checked prompts added</strong>
        </div>
        <span>${fiveStar} rated 5★</span>
      </div>
      <div class="quality-pack-position-grid" aria-label="Quality prompt additions by position">
        <span><b>GK</b>${Number(by.GK || 0)}</span>
        <span><b>DEF</b>${Number(by.DEF || 0)}</span>
        <span><b>MID</b>${Number(by.MID || 0)}</span>
        <span><b>FWD</b>${Number(by.FWD || 0)}</span>
      </div>
      <p>Only candidates inside the position-aware answer-pool limits are kept, with near-duplicate pools rejected. No player names or answers are shown.</p>`;

    if (!document.getElementById("qualityPromptPackStatusStyles")) {
      const style = document.createElement("style");
      style.id = "qualityPromptPackStatusStyles";
      style.textContent = `
        .quality-pack-status-card{margin:12px 0;padding:14px;border:1px solid rgba(57,232,143,.18);border-radius:16px;background:linear-gradient(135deg,rgba(57,232,143,.06),rgba(98,201,255,.035))}
        .quality-pack-status-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .quality-pack-status-head small{display:block;color:#62c9ff;font-size:.64rem;font-weight:950;letter-spacing:.09em}
        .quality-pack-status-head strong{display:block;margin-top:4px;color:#f4fff8;font-size:.98rem}
        .quality-pack-status-head span{flex:0 0 auto;padding:5px 8px;border:1px solid rgba(57,232,143,.18);border-radius:999px;color:#63eaa1;font-size:.66rem;font-weight:900}
        .quality-pack-position-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px}
        .quality-pack-position-grid span{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 9px;border:1px solid rgba(174,226,199,.1);border-radius:10px;background:rgba(0,0,0,.1);color:#f4fff8;font-size:.76rem;font-weight:900}
        .quality-pack-position-grid b{color:#9bb7a8;font-size:.64rem;letter-spacing:.05em}
        .quality-pack-status-card p{margin:11px 0 0;color:#9bb7a8;font-size:.72rem;line-height:1.45}
        @media(max-width:420px){.quality-pack-position-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.quality-pack-status-head{align-items:center}.quality-pack-status-head strong{font-size:.9rem}}
      `;
      document.head.appendChild(style);
    }
    return true;
  }

  function retry() {
    if (render()) return;
    attempts += 1;
    if (attempts < 30) window.setTimeout(retry, 150);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
  window.addEventListener("fpl:prompt-tools-ready", retry);
})();
