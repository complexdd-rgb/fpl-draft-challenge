/* FPL Draft Challenge — Prompt Studio V3 automatic batch generator v3.5.0.
   Reuses the deliberate candidate generator as its parser-safe/database-tested engine.
   It creates temporary batches only; prompts enter V3 only after explicit Add actions and
   always remain disabled Drafts until human Test / Quality / Review / Approval. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_V3_AUTO_BATCH_GENERATOR?.ready) return;

  const VERSION = "3.5.0";
  const MAX_BATCH = 50;
  const DEFAULT_COUNT = 20;
  const POLL_MS = 120;
  const FAMILY_TIMEOUT_MS = 180000;
  const POSITIONS = Object.freeze(["GK", "DEF", "MID", "FWD"]);

  let installed = false;
  let running = false;
  let currentBatch = [];

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const clone = value => JSON.parse(JSON.stringify(value));
  const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  function v3() { return window.FPL_PROMPT_STUDIO_V3 || null; }
  function deliberate() { return window.FPL_PROMPT_STUDIO_V3_CANDIDATE_GENERATOR || null; }
  function root() { return document.getElementById("promptStudioV3"); }
  function state() { return v3()?.getState?.() || { prompts:[] }; }

  function shuffle(values) {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function familyLabel(id) {
    const family = v3()?.getFamilies?.()?.find?.(item => item.id === id);
    return family?.name || id;
  }

  function existingIds() {
    return new Set(state().prompts.map(prompt => prompt.id));
  }

  function deliberateNodes(host) {
    const form = host.querySelector("[data-v3-candidate-generator-form]");
    return {
      form,
      button:form?.querySelector("[data-v3-generate-candidates]") || null,
      status:host.querySelector("[data-v3-candidate-status]") || null
    };
  }

  async function runDeliberateFamily(host, settings) {
    const api = deliberate();
    const nodes = deliberateNodes(host);
    if (!api?.ready || !nodes.form || !nodes.button) throw new Error("Deliberate candidate generator is not ready.");

    nodes.form.elements.family.value = settings.family;
    nodes.form.elements.position.value = settings.position;
    nodes.form.elements.minAnswers.value = String(settings.minAnswers);
    nodes.form.elements.maxAnswers.value = String(settings.maxAnswers);
    nodes.form.elements.limit.value = String(settings.limit);

    const before = nodes.status?.textContent || "";
    nodes.form.requestSubmit();
    const started = Date.now();
    let sawRunning = nodes.button.disabled;

    while (Date.now() - started < FAMILY_TIMEOUT_MS) {
      if (nodes.button.disabled) sawRunning = true;
      const statusText = nodes.status?.textContent || "";
      if (sawRunning && !nodes.button.disabled) break;
      if (!sawRunning && statusText !== before && !/Testing candidate/i.test(statusText)) break;
      await delay(POLL_MS);
    }

    if (nodes.button.disabled) throw new Error(`Timed out while generating ${settings.family} candidates.`);
    return api.getCandidates?.() || [];
  }

  function comboPlan(positionMix) {
    const families = shuffle(deliberate()?.supportedFamilies || []);
    const positions = positionMix === "balanced" ? shuffle(POSITIONS) : [positionMix];
    const combos = [];
    for (let round = 0; round < 4; round += 1) {
      for (let index = 0; index < families.length; index += 1) {
        combos.push({
          family:families[(index + round) % families.length],
          position:positions[(index + round) % positions.length]
        });
      }
    }
    return combos;
  }

  function diversePick(pool, count, difficultyMix) {
    const candidates = shuffle(pool.filter(candidate => difficultyMix === "balanced" || candidate.difficulty === difficultyMix));
    const selected = [];
    const familyCounts = new Map();
    const positionCounts = new Map();
    const difficultyCounts = new Map();

    while (selected.length < count && candidates.length) {
      let bestIndex = 0;
      let bestScore = Infinity;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const score = (familyCounts.get(candidate.family) || 0) * 5
          + (positionCounts.get(candidate.position) || 0) * 3
          + (difficultyMix === "balanced" ? (difficultyCounts.get(candidate.difficulty) || 0) * 2 : 0)
          + Math.random();
        if (score < bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      const [candidate] = candidates.splice(bestIndex, 1);
      selected.push(candidate);
      familyCounts.set(candidate.family, (familyCounts.get(candidate.family) || 0) + 1);
      positionCounts.set(candidate.position, (positionCounts.get(candidate.position) || 0) + 1);
      difficultyCounts.set(candidate.difficulty, (difficultyCounts.get(candidate.difficulty) || 0) + 1);
    }
    return selected;
  }

  async function generateBatch(host) {
    if (running) return;
    const form = host.querySelector("[data-v3-auto-batch-form]");
    if (!form) return;
    const count = Math.max(1, Math.min(MAX_BATCH, Number(form.elements.count.value || DEFAULT_COUNT)));
    const positionMix = String(form.elements.position.value || "balanced");
    const difficultyMix = String(form.elements.difficulty.value || "balanced");
    const minAnswers = Math.max(1, Number(form.elements.minAnswers.value || 6));
    const maxAnswers = Math.max(minAnswers, Number(form.elements.maxAnswers.value || 100));
    const status = host.querySelector("[data-v3-auto-batch-status]");
    const progress = host.querySelector("[data-v3-auto-batch-progress] i");
    const generateButton = form.querySelector("[data-v3-auto-generate]");

    if (!deliberate()?.ready) return window.alert("The deliberate candidate generator must be ready first.");

    running = true;
    currentBatch = [];
    generateButton.disabled = true;
    if (progress) progress.style.width = "0%";
    renderResults(host);

    const existing = existingIds();
    const seen = new Set(existing);
    const pool = [];
    const combos = comboPlan(positionMix);
    const shortlistPerFamily = Math.max(4, Math.min(12, Math.ceil(count / 5)));
    const desiredPool = count + Math.max(8, Math.ceil(count * 0.4));
    const maxAttempts = Math.min(combos.length, Math.max(8, Math.ceil(count / 3) + 5));

    try {
      for (let attempt = 0; attempt < maxAttempts && pool.length < desiredPool; attempt += 1) {
        const combo = combos[attempt];
        if (status) status.textContent = `Generating ${familyLabel(combo.family)} · ${combo.position} (${attempt + 1}/${maxAttempts})…`;
        if (progress) progress.style.width = `${Math.round((attempt / maxAttempts) * 100)}%`;

        const candidates = await runDeliberateFamily(host, {
          ...combo,
          minAnswers,
          maxAnswers,
          limit:shortlistPerFamily
        });

        const usable = shuffle(candidates).filter(candidate => {
          if (!candidate?.id || seen.has(candidate.id)) return false;
          if (difficultyMix !== "balanced" && candidate.difficulty !== difficultyMix) return false;
          seen.add(candidate.id);
          return true;
        });

        const take = Math.max(2, Math.ceil(count / Math.min(12, deliberate().supportedFamilies.length || 12)));
        pool.push(...usable.slice(0, take + 1));
      }

      currentBatch = diversePick(pool, count, difficultyMix);
      if (progress) progress.style.width = "100%";
      if (status) {
        status.textContent = currentBatch.length === count
          ? `${currentBatch.length} varied, parser-safe candidates generated. Nothing has been saved yet.`
          : `${currentBatch.length}/${count} candidates matched the current rules. Widen the answer range or use Balanced difficulty for a full batch.`;
      }
    } catch (error) {
      if (status) status.textContent = `Automatic generation stopped: ${error?.message || error}`;
    } finally {
      running = false;
      generateButton.disabled = false;
      renderResults(host);
    }
  }

  function draftNotes(candidate) {
    return `[V3 automatic batch generator]\nFamily: ${candidate.family}\nMeasured: ${candidate.answers} players · ${candidate.seasons} seasons · ${candidate.clubs} clubs\nTarget answer pool: ${candidate.target?.minAnswers ?? "?"}–${candidate.target?.maxAnswers ?? "?"}\nRules: ${(candidate.rules || []).map(item => `${item.field}:${item.operator}:${item.value || "true"}${item.value2 ? `:${item.value2}` : ""}`).join(" | ")}\n\nThis is a disabled Draft only. It still requires real Test → all-season evidence → advisory Quality → human Review → human Approval.`;
  }

  function saveDraft(host, candidate) {
    if (!candidate || existingIds().has(candidate.id)) return false;
    const create = host.querySelector("[data-v3-create-form]");
    if (!create) return false;
    create.elements.id.value = candidate.id;
    create.elements.position.value = candidate.position;
    create.elements.label.value = candidate.wording;
    create.elements.difficulty.value = candidate.difficulty;
    create.elements.family.value = candidate.family;
    create.elements.notes.value = draftNotes(candidate);
    create.requestSubmit();
    return true;
  }

  function addOne(host, index) {
    const candidate = currentBatch[Number(index)];
    if (!candidate) return;
    if (!saveDraft(host, candidate)) return window.alert("That candidate is already in V3 or the Draft form is unavailable.");
    window.setTimeout(() => renderResults(host), 0);
  }

  function addAll(host) {
    const existing = existingIds();
    const pending = currentBatch.filter(candidate => !existing.has(candidate.id));
    if (!pending.length) return window.alert("Every candidate in this batch is already in V3.");
    if (!window.confirm(`Add all ${pending.length} generated candidates as disabled V3 Drafts?\n\nThey will NOT be tested, rated, approved or enabled automatically.`)) return;
    let added = 0;
    for (const candidate of pending) if (saveDraft(host, candidate)) added += 1;
    const status = host.querySelector("[data-v3-auto-batch-status]");
    if (status) status.textContent = `${added} prompt${added === 1 ? "" : "s"} added as disabled Drafts. Continue in Test when you are ready.`;
    window.setTimeout(() => renderResults(host), 0);
  }

  function renderResults(host) {
    const results = host.querySelector("[data-v3-auto-batch-results]");
    const addAllButton = host.querySelector("[data-v3-auto-add-all]");
    const clearButton = host.querySelector("[data-v3-auto-clear]");
    if (!results) return;

    if (!currentBatch.length) {
      results.innerHTML = '<div class="prompt-v3-empty">Choose a batch size and generate. Nothing enters V3 until you add it.</div>';
      if (addAllButton) addAllButton.disabled = true;
      if (clearButton) clearButton.disabled = true;
      return;
    }

    const existing = existingIds();
    const pendingCount = currentBatch.filter(candidate => !existing.has(candidate.id)).length;
    if (addAllButton) {
      addAllButton.disabled = pendingCount === 0;
      addAllButton.textContent = pendingCount ? `Add all ${pendingCount} to Drafts` : "All already in V3";
    }
    if (clearButton) clearButton.disabled = false;

    results.innerHTML = currentBatch.map((candidate, index) => `<article class="prompt-v3-auto-row">
      <div><h4>${esc(candidate.wording)}</h4><p>${candidate.answers} valid players · ${candidate.seasons} seasons · ${candidate.clubs} clubs</p><div class="prompt-v3-meta"><span>${esc(familyLabel(candidate.family))}</span><span>${esc(candidate.position)}</span><span>${esc(candidate.difficulty)}</span><span>Parser-safe</span></div></div>
      <button type="button" class="prompt-v3-button primary" data-v3-auto-add-one="${index}"${existing.has(candidate.id) ? " disabled" : ""}>${existing.has(candidate.id) ? "Already in V3" : "Add to Drafts"}</button>
    </article>`).join("");
  }

  function installStyles() {
    if (document.getElementById("promptV3AutoBatchStyles")) return;
    const style = document.createElement("style");
    style.id = "promptV3AutoBatchStyles";
    style.textContent = `
      .prompt-v3-auto-batch{display:grid;gap:14px;margin-bottom:14px;border-color:rgba(114,239,136,.3)!important;background:rgba(114,239,136,.035)!important}
      .prompt-v3-auto-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.prompt-v3-auto-head h3,.prompt-v3-auto-head p{margin:0}.prompt-v3-auto-head p{margin-top:5px;color:#b7c9bd}
      .prompt-v3-auto-form{display:grid;grid-template-columns:.7fr 1fr 1fr .8fr .8fr auto;gap:8px;align-items:end}.prompt-v3-auto-form label{display:grid;gap:5px;font-size:.76rem}.prompt-v3-auto-form select,.prompt-v3-auto-form input{width:100%;box-sizing:border-box;padding:9px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#06150d;color:#f2fff6}
      .prompt-v3-auto-progress{height:7px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.08)}.prompt-v3-auto-progress i{display:block;height:100%;width:0;background:#72ef88;transition:width .15s linear}
      .prompt-v3-auto-results{display:grid;gap:8px}.prompt-v3-auto-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:11px}.prompt-v3-auto-row h4,.prompt-v3-auto-row p{margin:0}.prompt-v3-auto-row p{margin-top:5px;color:#aebdb4;font-size:.78rem}
      @media(max-width:900px){.prompt-v3-auto-form{grid-template-columns:1fr 1fr}.prompt-v3-auto-form button{grid-column:1/-1}.prompt-v3-auto-row{grid-template-columns:1fr}.prompt-v3-auto-head{display:grid}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (installed) return true;
    const host = root();
    const createView = host?.querySelector('[data-v3-view="create"]');
    const createCard = createView?.querySelector('.prompt-v3-card');
    if (!host || !createView || !createCard || !v3()?.ready || !deliberate()?.ready) return false;
    if (createView.querySelector("[data-v3-auto-batch]")) { installed = true; return true; }

    installStyles();
    const panel = document.createElement("section");
    panel.className = "prompt-v3-card prompt-v3-auto-batch";
    panel.dataset.v3AutoBatch = "1";
    panel.innerHTML = `
      <div class="prompt-v3-auto-head"><div><p class="eyebrow">Automatic creator</p><h3>Generate a batch of new V3 prompts</h3><p>Choose how many prompts you want. V3 automatically mixes the supported families, checks each candidate against the real database and leaves the final Test / Quality / Approval decisions to you.</p></div><span class="prompt-v3-badge">20 recommended · 50 maximum</span></div>
      <form class="prompt-v3-auto-form" data-v3-auto-batch-form>
        <label>How many prompts<input name="count" type="number" min="1" max="${MAX_BATCH}" value="${DEFAULT_COUNT}"></label>
        <label>Position mix<select name="position"><option value="balanced" selected>Balanced positions</option><option value="GK">GK only</option><option value="DEF">DEF only</option><option value="MID">MID only</option><option value="FWD">FWD only</option></select></label>
        <label>Difficulty mix<select name="difficulty"><option value="balanced" selected>Balanced difficulty</option><option value="easy">Easy only</option><option value="medium">Medium only</option><option value="hard">Hard only</option></select></label>
        <label>Min answers<input name="minAnswers" type="number" min="1" value="6"></label>
        <label>Max answers<input name="maxAnswers" type="number" min="1" value="100"></label>
        <button type="submit" class="prompt-v3-button primary" data-v3-auto-generate>Generate batch</button>
      </form>
      <div class="prompt-v3-auto-progress" data-v3-auto-batch-progress><i></i></div>
      <p data-v3-auto-batch-status style="color:#aebdb4;margin:0">Ready. Generated prompts remain temporary until you add them to V3.</p>
      <div class="prompt-v3-actions"><button type="button" class="prompt-v3-button primary" data-v3-auto-add-all disabled>Add all to Drafts</button><button type="button" class="prompt-v3-button" data-v3-auto-clear disabled>Clear batch</button></div>
      <div class="prompt-v3-auto-results" data-v3-auto-batch-results></div>
    `;
    createView.insertBefore(panel, createCard);

    const deliberatePanel = host.querySelector("[data-v3-candidate-generator]");
    const deliberateTitle = deliberatePanel?.querySelector("h3");
    if (deliberateTitle) deliberateTitle.textContent = "Advanced deliberate family generator";

    panel.querySelector("[data-v3-auto-batch-form]").addEventListener("submit", event => {
      event.preventDefault();
      generateBatch(host);
    });
    panel.addEventListener("click", event => {
      const one = event.target.closest("[data-v3-auto-add-one]");
      if (one) return addOne(host, one.dataset.v3AutoAddOne);
      if (event.target.closest("[data-v3-auto-add-all]")) return addAll(host);
      if (event.target.closest("[data-v3-auto-clear]")) {
        currentBatch = [];
        const status = host.querySelector("[data-v3-auto-batch-status]");
        if (status) status.textContent = "Batch cleared. Nothing was deleted from V3.";
        renderResults(host);
      }
    });
    window.addEventListener("fpl:prompt-studio-v3-changed", () => renderResults(host));
    renderResults(host);

    installed = true;
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v3-auto-batch-ready", { detail:{ version:VERSION, maxBatch:MAX_BATCH } }));
    return true;
  }

  window.FPL_PROMPT_STUDIO_V3_AUTO_BATCH_GENERATOR = Object.freeze({
    ready:true,
    version:VERSION,
    maxBatch:MAX_BATCH,
    install,
    getBatch:() => clone(currentBatch)
  });

  const boot = () => {
    if (install()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (install() || attempts > 120) window.clearInterval(timer);
    }, 100);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true }); else boot();
})();
