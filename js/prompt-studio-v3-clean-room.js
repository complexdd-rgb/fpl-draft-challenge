/* FPL Draft Challenge — Prompt Studio V3 clean-room foundation.
   V3 is intentionally isolated from the legacy production prompt library. It starts empty and
   uses explicit human review. No analyser result can automatically rate, approve, enable,
   disable or delete a V3 prompt. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_V3?.version === "3.0.0") return;

  const VERSION = "3.0.0";
  const STORAGE_KEY = "fplPromptStudioV3CleanRoom";
  const VALID_STATUS = new Set(["draft", "tested", "review", "approved"]);
  let activeView = "library";
  let activeId = "";

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function emptyState() {
    return { schema:1, version:VERSION, prompts:[] };
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.schema !== 1 || !Array.isArray(parsed.prompts)) return emptyState();
      return {
        schema:1,
        version:VERSION,
        prompts: parsed.prompts.map(prompt => ({
          id:String(prompt?.id || ""),
          label:String(prompt?.label || ""),
          position:String(prompt?.position || "ANY"),
          difficulty:String(prompt?.difficulty || "medium"),
          family:String(prompt?.family || ""),
          notes:String(prompt?.notes || ""),
          status:VALID_STATUS.has(prompt?.status) ? prompt.status : "draft",
          enabled:false,
          testEvidence: prompt?.testEvidence && typeof prompt.testEvidence === "object" ? prompt.testEvidence : null,
          qualityReview: prompt?.qualityReview && typeof prompt.qualityReview === "object" ? prompt.qualityReview : null,
          createdAt:String(prompt?.createdAt || new Date().toISOString()),
          updatedAt:String(prompt?.updatedAt || prompt?.createdAt || new Date().toISOString())
        })).filter(prompt => prompt.id && prompt.label)
      };
    } catch (_) {
      return emptyState();
    }
  }

  let state = readState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v3-changed", { detail:census() }));
  }

  function census() {
    const prompts = state.prompts;
    return Object.freeze({
      total:prompts.length,
      draft:prompts.filter(p => p.status === "draft").length,
      tested:prompts.filter(p => p.status === "tested").length,
      review:prompts.filter(p => p.status === "review").length,
      approved:prompts.filter(p => p.status === "approved").length,
      enabled:0,
      disabled:prompts.length
    });
  }

  function families() {
    return Array.isArray(window.FPL_PROMPT_FAMILY_REGISTRY_V3?.families)
      ? window.FPL_PROMPT_FAMILY_REGISTRY_V3.families
      : [];
  }

  function legacyProductionCount() {
    const value = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.getState?.();
    return value?.ready ? Number(value.total || 0) : null;
  }

  function installStyles() {
    if (document.getElementById("promptStudioV3Styles")) return;
    const style = document.createElement("style");
    style.id = "promptStudioV3Styles";
    style.textContent = `
      .prompt-v3{display:grid;gap:18px}.prompt-v3-hero{display:grid;gap:12px;padding:18px;border:1px solid rgba(98,234,161,.25);border-radius:18px;background:rgba(5,24,17,.82)}
      .prompt-v3-hero h2,.prompt-v3-hero p{margin:0}.prompt-v3-badges{display:flex;flex-wrap:wrap;gap:8px}.prompt-v3-badge{padding:7px 10px;border-radius:999px;background:rgba(98,234,161,.09);border:1px solid rgba(98,234,161,.18);font-size:.78rem}
      .prompt-v3-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.prompt-v3-summary article,.prompt-v3-card{border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(5,20,14,.7);padding:14px}.prompt-v3-summary span{display:block;color:#9eb4a7;font-size:.75rem}.prompt-v3-summary strong{font-size:1.45rem}
      .prompt-v3-tabs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;position:sticky;top:8px;z-index:5;padding:6px;border-radius:14px;background:#07150f;border:1px solid rgba(255,255,255,.08)}.prompt-v3-tabs button{border:0;border-radius:10px;padding:10px;background:transparent;color:#d7e7dc}.prompt-v3-tabs button.active{background:#72ef88;color:#06120b;font-weight:800}
      .prompt-v3-view[hidden]{display:none}.prompt-v3-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.prompt-v3-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.prompt-v3-form .wide{grid-column:1/-1}.prompt-v3-form label{display:grid;gap:6px;font-size:.8rem}.prompt-v3-form input,.prompt-v3-form select,.prompt-v3-form textarea{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#06150d;color:#f2fff6}.prompt-v3-form textarea{min-height:90px;resize:vertical}
      .prompt-v3-actions{display:flex;flex-wrap:wrap;gap:8px}.prompt-v3-button{padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#0d281a;color:#effff4}.prompt-v3-button.primary{background:#72ef88;color:#07150f;font-weight:800}.prompt-v3-button.danger{border-color:rgba(255,109,130,.45);color:#ff9bad}.prompt-v3-button:disabled{opacity:.45}
      .prompt-v3-list{display:grid;gap:9px}.prompt-v3-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:12px}.prompt-v3-row h4,.prompt-v3-row p{margin:0}.prompt-v3-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.prompt-v3-meta span{font-size:.7rem;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.06)}
      .prompt-v3-empty{padding:24px;text-align:center;border:1px dashed rgba(255,255,255,.16);border-radius:14px;color:#9eb4a7}.prompt-v3-note{padding:12px;border-radius:12px;background:rgba(98,201,255,.07);border:1px solid rgba(98,201,255,.16);color:#bcd9e8}.prompt-v3-family-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.prompt-v3-family-grid article{padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.08)}
      @media(max-width:800px){.prompt-v3-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.prompt-v3-tabs{grid-template-columns:repeat(3,minmax(0,1fr));position:static}.prompt-v3-grid,.prompt-v3-form,.prompt-v3-family-grid{grid-template-columns:1fr}.prompt-v3-form .wide{grid-column:auto}.prompt-v3-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function promptById(id) {
    return state.prompts.find(prompt => prompt.id === id) || null;
  }

  function statusLabel(status) {
    return ({ draft:"Draft", tested:"Tested", review:"Awaiting review", approved:"Approved for future V3" })[status] || status;
  }

  function renderSummary(root) {
    const c = census();
    const node = root.querySelector("[data-v3-summary]");
    if (!node) return;
    node.innerHTML = [
      ["Total", c.total], ["Draft", c.draft], ["Tested", c.tested], ["Review", c.review], ["Approved", c.approved]
    ].map(([label,value]) => `<article><span>${label}</span><strong>${value.toLocaleString("en-GB")}</strong></article>`).join("");
  }

  function renderLibrary(root) {
    const host = root.querySelector("[data-v3-library]");
    if (!host) return;
    if (!state.prompts.length) {
      host.innerHTML = '<div class="prompt-v3-empty"><strong>V3 starts at zero prompts.</strong><br>Create the first draft when you are ready.</div>';
      return;
    }
    host.innerHTML = state.prompts.map(prompt => `<article class="prompt-v3-row">
      <div><h4>${esc(prompt.label)}</h4><p>${esc(prompt.id)}</p><div class="prompt-v3-meta"><span>${esc(prompt.position)}</span><span>${esc(prompt.difficulty)}</span><span>${esc(prompt.family || "No family")}</span><span>${esc(statusLabel(prompt.status))}</span><span>Disabled</span></div></div>
      <div class="prompt-v3-actions"><button class="prompt-v3-button" data-v3-select="${esc(prompt.id)}">Open</button><button class="prompt-v3-button danger" data-v3-delete="${esc(prompt.id)}">Delete</button></div>
    </article>`).join("");
  }

  function renderFamilyCoverage(root) {
    const host = root.querySelector("[data-v3-families]");
    if (!host) return;
    host.innerHTML = families().map(family => {
      const count = state.prompts.filter(prompt => prompt.family === family.id).length;
      return `<article><strong>${esc(family.name)}</strong><p>${esc(family.description)}</p><div class="prompt-v3-meta"><span>${esc(family.tier)}</span><span>${count} V3 prompt${count === 1 ? "" : "s"}</span></div></article>`;
    }).join("") || '<div class="prompt-v3-empty">Family registry is still loading.</div>';
  }

  function populateSelects(root) {
    const options = families().map(family => `<option value="${esc(family.id)}">${esc(family.name)}</option>`).join("");
    root.querySelectorAll("[data-v3-family-select]").forEach(select => {
      const current = select.value;
      select.innerHTML = `<option value="">Choose a family</option>${options}`;
      if ([...select.options].some(option => option.value === current)) select.value = current;
    });
    const promptOptions = state.prompts.map(prompt => `<option value="${esc(prompt.id)}">${esc(prompt.label)}</option>`).join("");
    root.querySelectorAll("[data-v3-prompt-select]").forEach(select => {
      const current = select.value || activeId;
      select.innerHTML = `<option value="">Choose a V3 prompt</option>${promptOptions}`;
      if ([...select.options].some(option => option.value === current)) select.value = current;
    });
  }

  function renderReview(root) {
    const host = root.querySelector("[data-v3-review]");
    if (!host) return;
    const rows = state.prompts.filter(prompt => prompt.status === "review" || prompt.status === "approved");
    host.innerHTML = rows.length ? rows.map(prompt => {
      const q = prompt.qualityReview;
      return `<article class="prompt-v3-row"><div><h4>${esc(prompt.label)}</h4><p>${esc(prompt.id)}</p><div class="prompt-v3-meta"><span>${esc(statusLabel(prompt.status))}</span><span>${q ? `${Number(q.rating || 0)}★ human quality` : "No human quality review"}</span><span>Disabled until V3 cutover</span></div>${q?.notes ? `<p>${esc(q.notes)}</p>` : ""}</div><div class="prompt-v3-actions"><button class="prompt-v3-button" data-v3-select="${esc(prompt.id)}">Open</button></div></article>`;
    }).join("") : '<div class="prompt-v3-empty">No prompts are waiting for human review yet.</div>';
  }

  function render(root) {
    renderSummary(root);
    renderLibrary(root);
    renderReview(root);
    renderFamilyCoverage(root);
    populateSelects(root);
  }

  function setView(root, view) {
    activeView = view;
    root.querySelectorAll("[data-v3-view]").forEach(section => section.hidden = section.dataset.v3View !== view);
    root.querySelectorAll("[data-v3-tab]").forEach(button => button.classList.toggle("active", button.dataset.v3Tab === view));
  }

  function createRoot() {
    const root = document.createElement("section");
    root.id = "promptStudioV3";
    root.className = "prompt-v3";
    const legacy = legacyProductionCount();
    root.innerHTML = `
      <div class="prompt-v3-hero">
        <div><p class="eyebrow">Clean-room rebuild</p><h2>Prompt Studio V3</h2><p>Start from zero. The existing production library stays frozen for the live game while V3 is rebuilt manually.</p></div>
        <div class="prompt-v3-badges"><span class="prompt-v3-badge">V3 library: isolated</span><span class="prompt-v3-badge">Quality: advisory + human decision</span><span class="prompt-v3-badge">Automatic promotion: off</span><span class="prompt-v3-badge">Legacy live pool: ${legacy === null ? "loading" : legacy}</span></div>
      </div>
      <div class="prompt-v3-summary" data-v3-summary></div>
      <nav class="prompt-v3-tabs" aria-label="Prompt Studio V3 sections">
        ${[["library","Library"],["create","Create"],["test","Test"],["quality","Quality"],["review","Review"],["families","Families"]].map(([id,label]) => `<button type="button" data-v3-tab="${id}">${label}</button>`).join("")}
      </nav>
      <section class="prompt-v3-view" data-v3-view="library"><div class="prompt-v3-card"><h3>V3 library</h3><p>Total always equals disabled while the clean-room build is underway. Approval does not make a prompt live.</p><div class="prompt-v3-list" data-v3-library></div></div></section>
      <section class="prompt-v3-view" data-v3-view="create" hidden><div class="prompt-v3-card"><h3>Create a draft</h3><p>Every new prompt enters V3 as a disabled draft.</p><form class="prompt-v3-form" data-v3-create-form><label>Prompt ID<input name="id" required placeholder="e.g. fwd_relegated_10_goals"></label><label>Position<select name="position"><option>ANY</option><option>GK</option><option>DEF</option><option>MID</option><option>FWD</option></select></label><label class="wide">Prompt wording<input name="label" required maxlength="180"></label><label>Difficulty<select name="difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></label><label>Family<select name="family" data-v3-family-select></select></label><label class="wide">Design notes<textarea name="notes" placeholder="What makes this a good prompt? What data/rule will it use?"></textarea></label><div class="wide prompt-v3-actions"><button class="prompt-v3-button primary" type="submit">Save disabled draft</button></div></form></div></section>
      <section class="prompt-v3-view" data-v3-view="test" hidden><div class="prompt-v3-card"><h3>Test evidence</h3><p class="prompt-v3-note">This first V3 slice records test evidence without changing approval automatically. Automated rule execution will be wired into this screen later.</p><form class="prompt-v3-form" data-v3-test-form><label class="wide">Prompt<select name="id" data-v3-prompt-select required></select></label><label>Valid answers<input name="answers" type="number" min="0"></label><label>Seasons represented<input name="seasons" type="number" min="0"></label><label>Clubs represented<input name="clubs" type="number" min="0"></label><label>Technical rule check<select name="technical"><option value="pass">Pass</option><option value="fail">Fail</option></select></label><label class="wide">Test notes<textarea name="notes"></textarea></label><div class="wide prompt-v3-actions"><button class="prompt-v3-button primary" type="submit">Save test evidence</button></div></form></div></section>
      <section class="prompt-v3-view" data-v3-view="quality" hidden><div class="prompt-v3-card"><h3>Human quality review</h3><p class="prompt-v3-note">Quality tools may eventually suggest values here, but only your saved review can change the V3 review state. No rescue bonus or automatic rating change is allowed.</p><form class="prompt-v3-form" data-v3-quality-form><label class="wide">Prompt<select name="id" data-v3-prompt-select required></select></label><label>Quality rating<select name="rating"><option value="1">1★</option><option value="2">2★</option><option value="3">3★</option><option value="4" selected>4★</option><option value="5">5★</option></select></label><label>Highest overlap %<input name="overlap" type="number" min="0" max="100"></label><label>Obviousness<select name="obviousness"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Decision<select name="decision"><option value="review">Send to review</option><option value="refine">Needs refinement</option><option value="reject">Reject / delete later</option></select></label><label class="wide">Review notes<textarea name="notes" required placeholder="Why is this rating appropriate?"></textarea></label><div class="wide prompt-v3-actions"><button class="prompt-v3-button primary" type="submit">Save human review</button></div></form></div></section>
      <section class="prompt-v3-view" data-v3-view="review" hidden><div class="prompt-v3-card"><h3>Review & approve</h3><p>Approval is a human decision and still does not enable the prompt in the live game. Production cutover will be a separate repository action.</p><div class="prompt-v3-list" data-v3-review></div><div class="prompt-v3-actions" style="margin-top:12px"><button class="prompt-v3-button primary" data-v3-approve type="button">Approve selected prompt for future V3</button><button class="prompt-v3-button" data-v3-keep-review type="button">Keep selected in review</button></div></div></section>
      <section class="prompt-v3-view" data-v3-view="families" hidden><div class="prompt-v3-card"><h3>Family coverage</h3><p>Build for coverage and variety rather than chasing an arbitrary prompt total.</p><div class="prompt-v3-family-grid" data-v3-families></div></div></section>
    `;
    return root;
  }

  function uniqueId(id) {
    return id && !state.prompts.some(prompt => prompt.id === id);
  }

  function bind(root) {
    root.addEventListener("click", event => {
      const tab = event.target.closest("[data-v3-tab]");
      if (tab) return setView(root, tab.dataset.v3Tab);
      const selected = event.target.closest("[data-v3-select]");
      if (selected) {
        activeId = selected.dataset.v3Select;
        populateSelects(root);
        setView(root, "review");
        return;
      }
      const remove = event.target.closest("[data-v3-delete]");
      if (remove) {
        const prompt = promptById(remove.dataset.v3Delete);
        if (!prompt || !window.confirm(`Delete V3 draft “${prompt.label}”?`)) return;
        state.prompts = state.prompts.filter(item => item.id !== prompt.id);
        if (activeId === prompt.id) activeId = "";
        saveState(); render(root); return;
      }
      if (event.target.closest("[data-v3-approve]")) {
        const prompt = promptById(activeId);
        if (!prompt) return window.alert("Choose a prompt first.");
        if (!prompt.testEvidence || prompt.testEvidence.technical !== "pass") return window.alert("Save passing technical test evidence first.");
        if (!prompt.qualityReview || prompt.qualityReview.decision !== "review") return window.alert("Save a human quality review that sends this prompt to review first.");
        prompt.status = "approved";
        prompt.enabled = false;
        prompt.updatedAt = new Date().toISOString();
        saveState(); render(root); return;
      }
      if (event.target.closest("[data-v3-keep-review]")) {
        const prompt = promptById(activeId);
        if (!prompt) return window.alert("Choose a prompt first.");
        prompt.status = "review"; prompt.enabled = false; prompt.updatedAt = new Date().toISOString();
        saveState(); render(root);
      }
    });

    root.querySelector("[data-v3-create-form]").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const id = String(data.get("id") || "").trim();
      const label = String(data.get("label") || "").trim();
      if (!uniqueId(id)) return window.alert("That V3 prompt ID already exists.");
      state.prompts.push({ id, label, position:String(data.get("position") || "ANY"), difficulty:String(data.get("difficulty") || "medium"), family:String(data.get("family") || ""), notes:String(data.get("notes") || ""), status:"draft", enabled:false, testEvidence:null, qualityReview:null, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
      activeId = id; saveState(); event.currentTarget.reset(); render(root); setView(root, "library");
    });

    root.querySelector("[data-v3-test-form]").addEventListener("submit", event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const prompt = promptById(String(data.get("id") || "")); if (!prompt) return;
      prompt.testEvidence = { answers:Number(data.get("answers") || 0), seasons:Number(data.get("seasons") || 0), clubs:Number(data.get("clubs") || 0), technical:String(data.get("technical") || "fail"), notes:String(data.get("notes") || ""), reviewedAt:new Date().toISOString() };
      prompt.status = prompt.testEvidence.technical === "pass" ? "tested" : "draft"; prompt.enabled = false; prompt.updatedAt = new Date().toISOString(); activeId = prompt.id; saveState(); render(root); setView(root, "quality");
    });

    root.querySelector("[data-v3-quality-form]").addEventListener("submit", event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const prompt = promptById(String(data.get("id") || "")); if (!prompt) return;
      if (!prompt.testEvidence) return window.alert("Record test evidence before quality review.");
      prompt.qualityReview = { rating:Number(data.get("rating") || 0), overlap:Number(data.get("overlap") || 0), obviousness:String(data.get("obviousness") || "medium"), decision:String(data.get("decision") || "refine"), notes:String(data.get("notes") || ""), humanReviewed:true, reviewedAt:new Date().toISOString() };
      prompt.status = prompt.qualityReview.decision === "review" ? "review" : "tested"; prompt.enabled = false; prompt.updatedAt = new Date().toISOString(); activeId = prompt.id; saveState(); render(root); setView(root, "review");
    });
  }

  function install() {
    const workspace = document.getElementById("workspace-prompts");
    if (!workspace) return false;
    if (document.getElementById("promptStudioV3")) return true;
    installStyles();

    // Keep the old V2/legacy manager in the DOM for production compatibility, but remove it from the
    // human Prompt Studio workflow. V3 state never mutates the legacy production library.
    const legacyPanel = document.getElementById("libraryManagerPanel");
    if (legacyPanel) {
      legacyPanel.hidden = true;
      legacyPanel.setAttribute("aria-hidden", "true");
      legacyPanel.dataset.v3LegacyProduction = "frozen";
    }

    const heading = workspace.querySelector(":scope > .workspace-heading");
    if (heading) {
      const title = heading.querySelector("h1");
      const copy = heading.querySelector("p:last-child");
      if (title) title.textContent = "Prompt Studio V3";
      if (copy) copy.textContent = "Clean-room prompt rebuild with manual testing, quality review and approval.";
    }

    const root = createRoot();
    workspace.appendChild(root);
    bind(root);
    render(root);
    setView(root, activeView);
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v3-ready", { detail:census() }));
    return true;
  }

  const api = Object.freeze({
    ready:true,
    version:VERSION,
    storageKey:STORAGE_KEY,
    install,
    getState:() => structuredClone(state),
    getCensus:census,
    getFamilies:() => families().slice()
  });
  window.FPL_PROMPT_STUDIO_V3 = api;

  const boot = () => {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts > 40) clearInterval(timer);
    }, 100);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true }); else boot();
})();
