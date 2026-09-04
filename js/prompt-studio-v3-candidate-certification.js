/* FPL Draft Challenge — Prompt Studio V3 candidate all-season certification v3.4.0.
   Read-only evidence for V3 candidates. It never rates, approves, enables, deletes or promotes a prompt. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_V3_CANDIDATE_CERTIFICATION?.ready) return;

  const VERSION = "3.4.0";
  const EVIDENCE_KEY = "fplPromptStudioV3CandidateAllSeasonEvidence";
  let installed = false;
  let running = false;

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  let evidenceStore = readJson(EVIDENCE_KEY, {});

  function saveEvidence() {
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(evidenceStore));
  }

  function v3() {
    return window.FPL_PROMPT_STUDIO_V3 || null;
  }

  function tester() {
    return window.FPL_PROMPT_STUDIO_V3_RULE_TESTER || null;
  }

  function engine() {
    return window.ValidationEngine || null;
  }

  function players() {
    return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  }

  function prompts() {
    return v3()?.getState?.().prompts || [];
  }

  function promptById(id) {
    return prompts().find(prompt => prompt.id === id) || null;
  }

  function fingerprint(prompt) {
    const test = tester()?.getTestDetail?.(prompt.id);
    return `${prompt.id}|${prompt.position || "ANY"}|${prompt.label}|${test?.testedAt || ""}`;
  }

  function seasonPlayers(season) {
    return players().filter(player => (player.seasons || []).some(record => record.season === season));
  }

  function promptOptions(selected = "") {
    return prompts().map(prompt => `<option value="${esc(prompt.id)}"${prompt.id === selected ? " selected" : ""}>${esc(prompt.label)}</option>`).join("");
  }

  function evidenceFor(promptId) {
    return evidenceStore[promptId] || null;
  }

  function seasonStatus(row) {
    if (row.runtimeErrors > 0 || row.zeroMinuteAccepted > 0) return "FAIL";
    return row.answers > 0 ? "ACTIVE" : "NO MATCH";
  }

  function renderEvidence(root, promptId) {
    const host = root.querySelector("[data-v3-candidate-cert-result]");
    if (!host) return;
    const prompt = promptById(promptId);
    if (!prompt) {
      host.innerHTML = '<div class="prompt-v3-empty">Choose a V3 prompt to inspect all-season candidate evidence.</div>';
      return;
    }

    const test = tester()?.getTestDetail?.(prompt.id);
    if (!test || test.technical !== "pass") {
      host.innerHTML = '<div class="prompt-v3-note"><strong>Real database Test required first.</strong><br>All-season candidate certification is available only after the prompt has a passing V3 technical Test.</div>';
      return;
    }

    const evidence = evidenceFor(prompt.id);
    if (!evidence) {
      host.innerHTML = '<div class="prompt-v3-note"><strong>Ready for all-season evidence.</strong><br>This is read-only candidate certification. It will not change quality, review, approval or production state.</div>';
      return;
    }

    const stale = evidence.fingerprint !== fingerprint(prompt);
    const rows = evidence.seasons || [];
    host.innerHTML = `<div class="prompt-v3-candidate-cert-result">
      <div class="prompt-v3-note"><strong>${stale ? "Evidence is stale — rerun required" : evidence.technical === "pass" ? "Candidate technical certification PASS" : "Candidate technical certification FAIL"}</strong><br>${esc(stale ? "The prompt wording, position or its real Test changed after this evidence was calculated." : `Read-only evidence calculated ${new Date(evidence.calculatedAt).toLocaleString("en-GB")}. No prompt state was changed.`)}</div>
      <div class="prompt-v3-test-metrics">
        <article><span>Supported seasons</span><strong>${Number(evidence.totalSeasons || 0).toLocaleString("en-GB")}</strong></article>
        <article><span>Active seasons</span><strong>${Number(evidence.activeSeasons || 0).toLocaleString("en-GB")}</strong></article>
        <article><span>Unique players</span><strong>${Number(evidence.uniquePlayers || 0).toLocaleString("en-GB")}</strong></article>
        <article><span>Runtime errors</span><strong>${Number(evidence.runtimeErrors || 0).toLocaleString("en-GB")}</strong></article>
        <article><span>Zero-minute answers</span><strong>${Number(evidence.zeroMinuteAccepted || 0).toLocaleString("en-GB")}</strong></article>
      </div>
      <div class="prompt-v3-cert-table-wrap"><table class="prompt-v3-cert-table"><thead><tr><th>Season</th><th>Players</th><th>Answers</th><th>Clubs</th><th>Errors</th><th>0 min</th><th>Status</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.season)}</td><td>${Number(row.playerRows).toLocaleString("en-GB")}</td><td>${Number(row.answers).toLocaleString("en-GB")}</td><td>${Number(row.clubs).toLocaleString("en-GB")}</td><td>${Number(row.runtimeErrors).toLocaleString("en-GB")}</td><td>${Number(row.zeroMinuteAccepted).toLocaleString("en-GB")}</td><td><strong>${esc(seasonStatus(row))}</strong></td></tr>`).join("")}</tbody></table></div>
      <p class="prompt-v3-note"><strong>How to read this:</strong> ACTIVE means the prompt has valid answers in that season. NO MATCH is not a technical failure; it can be expected for season-specific or naturally sparse prompts. FAIL is reserved for runtime errors or accepted zero-minute answers. Human quality and approval remain separate.</p>
    </div>`;
  }

  async function runCertification(root, promptId) {
    if (running) return;
    const prompt = promptById(promptId);
    const validation = engine();
    const ruleTester = tester();
    if (!prompt) return window.alert("Choose a V3 prompt first.");
    if (!validation?.evaluatePrompt || !validation?.getAllSeasonLabels || !players().length) return window.alert("Player database / Validation Engine is not ready yet.");
    const test = ruleTester?.getTestDetail?.(prompt.id);
    if (!test || test.technical !== "pass") return window.alert("Run and pass the real V3 database Test first.");

    const seasons = validation.getAllSeasonLabels();
    if (!seasons.length) return window.alert("No supported seasons are available.");

    running = true;
    const button = root.querySelector("[data-v3-run-candidate-cert]");
    const progress = root.querySelector("[data-v3-candidate-cert-progress] i");
    const status = root.querySelector("[data-v3-candidate-cert-status]");
    if (button) button.disabled = true;
    if (progress) progress.style.width = "0%";

    const seasonResults = [];
    const uniquePlayers = new Set();
    let totalRuntimeErrors = 0;
    let totalZeroMinuteAccepted = 0;
    let seasonIndex = 0;

    const runSeason = () => new Promise(resolve => {
      const season = seasons[seasonIndex];
      const rows = seasonPlayers(season);
      const validPlayers = new Set();
      const clubs = new Set();
      let runtimeErrors = 0;
      let zeroMinuteAccepted = 0;
      let index = 0;

      const chunk = () => {
        const end = Math.min(index + 150, rows.length);
        for (; index < end; index += 1) {
          const player = rows[index];
          let result;
          try { result = validation.evaluatePrompt(player, season, prompt.label); }
          catch (_) { runtimeErrors += 1; continue; }
          if (!result?.ok) { runtimeErrors += 1; continue; }
          if (!result.passed) continue;
          validPlayers.add(player.playerId);
          uniquePlayers.add(player.playerId);
          if (result.record?.club) clubs.add(String(result.record.club));
          if (!(Number(result.record?.minutes) > 0)) zeroMinuteAccepted += 1;
        }
        const seasonFraction = rows.length ? index / rows.length : 1;
        const overall = ((seasonIndex + seasonFraction) / seasons.length) * 100;
        if (progress) progress.style.width = `${Math.round(overall)}%`;
        if (status) status.textContent = `${season} · checked ${index.toLocaleString("en-GB")} / ${rows.length.toLocaleString("en-GB")} players`;
        if (index < rows.length) window.setTimeout(chunk, 0);
        else {
          totalRuntimeErrors += runtimeErrors;
          totalZeroMinuteAccepted += zeroMinuteAccepted;
          seasonResults.push({ season, playerRows:rows.length, answers:validPlayers.size, clubs:clubs.size, runtimeErrors, zeroMinuteAccepted });
          resolve();
        }
      };
      chunk();
    });

    try {
      while (seasonIndex < seasons.length) {
        await runSeason();
        seasonIndex += 1;
      }
      const activeSeasons = seasonResults.filter(row => row.answers > 0).length;
      const runtimeErrors = totalRuntimeErrors;
      const zeroMinuteAccepted = totalZeroMinuteAccepted;
      const technical = runtimeErrors === 0 && zeroMinuteAccepted === 0 && uniquePlayers.size > 0 ? "pass" : "fail";
      evidenceStore[prompt.id] = {
        version:VERSION,
        promptId:prompt.id,
        label:prompt.label,
        fingerprint:fingerprint(prompt),
        technical,
        totalSeasons:seasons.length,
        activeSeasons,
        noMatchSeasons:seasonResults.length - activeSeasons,
        uniquePlayers:uniquePlayers.size,
        runtimeErrors,
        zeroMinuteAccepted,
        seasons:seasonResults,
        calculatedAt:new Date().toISOString()
      };
      saveEvidence();
      if (status) status.textContent = `Finished · ${activeSeasons}/${seasons.length} seasons active · ${uniquePlayers.size.toLocaleString("en-GB")} unique players · ${technical.toUpperCase()}`;
      if (progress) progress.style.width = "100%";
      renderEvidence(root, prompt.id);
    } finally {
      running = false;
      if (button) button.disabled = false;
    }
  }

  function installStyles() {
    if (document.getElementById("promptStudioV3CandidateCertificationStyles")) return;
    const style = document.createElement("style");
    style.id = "promptStudioV3CandidateCertificationStyles";
    style.textContent = `
      .prompt-v3-candidate-cert{display:grid;gap:12px;margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,.1)}
      .prompt-v3-candidate-cert label{display:grid;gap:6px;font-size:.8rem}.prompt-v3-candidate-cert select{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#06150d;color:#f2fff6}
      .prompt-v3-progress{height:8px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.08)}.prompt-v3-progress i{display:block;height:100%;width:0;background:#72ef88;transition:width .12s linear}
      .prompt-v3-cert-table-wrap{overflow:auto;border:1px solid rgba(255,255,255,.09);border-radius:12px}.prompt-v3-cert-table{width:100%;border-collapse:collapse;min-width:720px}.prompt-v3-cert-table th,.prompt-v3-cert-table td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;font-size:.78rem}.prompt-v3-cert-table th{color:#9eb4a7;background:rgba(255,255,255,.03);position:sticky;top:0}.prompt-v3-cert-table tbody tr:last-child td{border-bottom:0}
    `;
    document.head.appendChild(style);
  }

  function installCertification(root) {
    const view = root.querySelector('[data-v3-view="test"] .prompt-v3-card');
    if (!view || view.querySelector("[data-v3-candidate-cert]")) return false;
    const box = document.createElement("div");
    box.className = "prompt-v3-candidate-cert";
    box.dataset.v3CandidateCert = "1";
    box.innerHTML = `
      <div><h3>Candidate all-season certification</h3><p class="prompt-v3-note">Read-only evidence across every supported season. This cannot rate, approve, enable or promote a V3 prompt.</p></div>
      <label>V3 prompt<select data-v3-candidate-cert-select><option value="">Choose a V3 prompt</option>${promptOptions()}</select></label>
      <div class="prompt-v3-actions"><button type="button" class="prompt-v3-button primary" data-v3-run-candidate-cert>Run all-season candidate evidence</button></div>
      <div class="prompt-v3-progress" data-v3-candidate-cert-progress><i></i></div>
      <p data-v3-candidate-cert-status style="margin:0;color:#9eb4a7">Ready.</p>
      <div data-v3-candidate-cert-result><div class="prompt-v3-empty">Choose a prompt to inspect all-season evidence.</div></div>
    `;
    view.appendChild(box);
    const select = box.querySelector("[data-v3-candidate-cert-select]");
    select.addEventListener("change", () => renderEvidence(root, select.value));
    box.querySelector("[data-v3-run-candidate-cert]").addEventListener("click", () => runCertification(root, select.value));
    return true;
  }

  function refresh(root) {
    const select = root.querySelector("[data-v3-candidate-cert-select]");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Choose a V3 prompt</option>${promptOptions(current)}`;
    if ([...select.options].some(option => option.value === current)) select.value = current;
    renderEvidence(root, select.value);
  }

  function install() {
    if (installed) return true;
    const root = document.getElementById("promptStudioV3");
    if (!root || !v3() || !tester()) return false;
    installStyles();
    if (!installCertification(root)) return false;
    window.addEventListener("fpl:prompt-studio-v3-changed", () => refresh(root));
    installed = true;
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v3-candidate-certification-ready", { detail:{ version:VERSION } }));
    return true;
  }

  const api = Object.freeze({
    ready:true,
    version:VERSION,
    evidenceKey:EVIDENCE_KEY,
    install,
    getEvidence:id => clone(evidenceFor(id))
  });
  window.FPL_PROMPT_STUDIO_V3_CANDIDATE_CERTIFICATION = api;

  const boot = () => {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts > 100) clearInterval(timer);
    }, 100);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true }); else boot();
})();
