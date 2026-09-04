/* FPL Challenge Studio — finishing layer v1.0.2
   Adds management visibility without changing game, scoring, prompt or database rules. */
(() => {
  "use strict";

  if (!document.querySelector(".studio-shell") && !document.querySelector('[data-workspace="dashboard"]')) return;

  const WORKSPACE_KEY = "fpl-studio-stage-one-workspace";
  const MANAGER_KEY = "fplChallengeStudioPromptManagerV1";
  const CERT_KEY = "fplStudioAllSeasonCertificationV1";
  const CERTIFICATION_POOL_WAIT_MS = 120000;
  const POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  let certificationCancelled = false;
  let scheduleState = null;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[character]));

  function numberFrom(value) {
    const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(dateText, amount) {
    const [year, month, day] = String(dateText || "").split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
    date.setDate(date.getDate() + amount);
    return localDateString(date);
  }

  function formatDate(dateText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))) return dateText || "—";
    const [year, month, day] = dateText.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", year:"numeric" }).format(new Date(year, month - 1, day, 12));
  }

  function addStyles() {
    if (document.getElementById("studioFinishStyles")) return;
    const style = document.createElement("style");
    style.id = "studioFinishStyles";
    style.textContent = `
      .studio-finish-panel{margin-top:14px;padding:18px;border:1px solid var(--stage-border,rgba(174,226,199,.15));border-radius:18px;background:var(--stage-surface,#0b1d16)}
      .studio-finish-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
      .studio-finish-head h2{margin:3px 0 0;font-size:1.18rem}.studio-finish-head p{margin:6px 0 0;color:var(--stage-muted,#9bb7a8);font-size:.76rem;line-height:1.5;max-width:720px}
      .studio-finish-kicker{display:block;color:var(--stage-green,#39e88f);font-size:.62rem;font-weight:950;text-transform:uppercase;letter-spacing:.1em}
      .studio-preflight-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .studio-preflight-item{min-width:0;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025)}
      .studio-preflight-item span,.studio-preflight-item strong,.studio-preflight-item small{display:block}.studio-preflight-item span{color:var(--stage-muted,#9bb7a8);font-size:.58rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em}.studio-preflight-item strong{margin:5px 0 3px;font-size:.84rem;line-height:1.25}.studio-preflight-item small{color:var(--stage-muted,#9bb7a8);font-size:.62rem;line-height:1.4}
      .studio-preflight-item.good strong{color:var(--stage-green,#39e88f)}.studio-preflight-item.warn strong{color:var(--stage-amber,#ffd477)}.studio-preflight-item.bad strong{color:var(--stage-red,#ff7f99)}
      .studio-preflight-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:12px 13px;border:1px solid rgba(98,201,255,.16);border-radius:14px;background:rgba(98,201,255,.05)}
      .studio-preflight-summary strong{font-size:.86rem}.studio-preflight-summary span{color:var(--stage-muted,#9bb7a8);font-size:.68rem;line-height:1.4}
      .studio-preflight-summary.good{border-color:rgba(57,232,143,.2);background:rgba(57,232,143,.055)}.studio-preflight-summary.good strong{color:var(--stage-green,#39e88f)}.studio-preflight-summary.bad{border-color:rgba(255,127,153,.22);background:rgba(255,127,153,.055)}.studio-preflight-summary.bad strong{color:var(--stage-red,#ff7f99)}
      .studio-finish-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.studio-finish-actions .button{margin:0}
      .all-season-progress{height:8px;margin:12px 0 6px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.06)}.all-season-progress>span{display:block;width:0;height:100%;background:linear-gradient(90deg,var(--stage-green,#39e88f),var(--stage-blue,#62c9ff));transition:width .2s ease}
      .all-season-status{color:var(--stage-muted,#9bb7a8);font-size:.68rem;line-height:1.45}
      .all-season-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.all-season-card{padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025)}.all-season-card span,.all-season-card strong,.all-season-card small{display:block}.all-season-card span{font-size:.62rem;font-weight:900;color:var(--stage-muted,#9bb7a8)}.all-season-card strong{margin:5px 0 3px;font-size:.76rem}.all-season-card small{color:var(--stage-muted,#9bb7a8);font-size:.56rem;line-height:1.35}.all-season-card.good strong{color:var(--stage-green,#39e88f)}.all-season-card.bad strong{color:var(--stage-red,#ff7f99)}.all-season-card.stale strong{color:var(--stage-amber,#ffd477)}
      .schedule-coverage{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin:12px 0;padding:11px 12px;border:1px solid rgba(98,201,255,.17);border-radius:14px;background:rgba(98,201,255,.045)}.schedule-coverage strong,.schedule-coverage span{display:block}.schedule-coverage strong{font-size:.76rem}.schedule-coverage span{margin-top:3px;color:var(--stage-muted,#9bb7a8);font-size:.62rem;line-height:1.4}.schedule-coverage-actions{display:flex;gap:7px}.schedule-coverage-actions button{min-height:38px;padding:7px 10px;font-size:.64rem}
      #studioUnsavedPill{border-color:rgba(255,212,119,.23);background:rgba(255,212,119,.07);color:var(--stage-amber,#ffd477)}
      @media(max-width:760px){.studio-preflight-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.all-season-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.studio-finish-panel{padding:14px}.studio-finish-head{display:block}.studio-finish-head .button{margin-top:10px}.schedule-coverage{grid-template-columns:1fr}.schedule-coverage-actions{display:grid;grid-template-columns:1fr 1fr}.studio-preflight-summary{align-items:flex-start;flex-direction:column}}
      @media(max-width:390px){.studio-preflight-grid,.all-season-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function retireOldImports() {
    try {
      if (localStorage.getItem(WORKSPACE_KEY) === "imports") localStorage.setItem(WORKSPACE_KEY, "dashboard");
    } catch {}
    document.querySelectorAll('[data-open-workspace="imports"],[data-workspace="imports"]').forEach(node => node.remove());
  }

  function cleanOverviewCopy() {
    const dashboard = document.querySelector('[data-workspace="dashboard"]');
    if (!dashboard) return;
    const heroCopy = dashboard.querySelector(".studio-hero .hero-copy");
    if (heroCopy && /import historical seasons/i.test(heroCopy.textContent || "")) {
      heroCopy.textContent = "Create the daily challenge, manage prompts, audit the player database, validate every season and monitor live services from one focused workspace.";
    }
    const generationCard = [...dashboard.querySelectorAll(".status-card")].find(card => /generation mode/i.test(card.textContent || ""));
    if (generationCard) {
      const value = generationCard.querySelector("strong");
      if (value) value.textContent = "Formation-aware";
    }
    const banner = dashboard.querySelector(".safety-banner");
    if (banner && /manual github upload/i.test(banner.textContent || "")) {
      const strong = banner.querySelector("strong");
      const copy = banner.querySelector("span,p");
      if (strong) strong.textContent = "Safe Studio workspace";
      if (copy) copy.textContent = "Prompt edits remain browser-local until exported. Validated challenge weeks can publish directly to Supabase when signed in.";
    }
  }

  function managerState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MANAGER_KEY) || "null");
      return parsed && typeof parsed === "object"
        ? { overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {}, customs: Array.isArray(parsed.customs) ? parsed.customs : [], deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [] }
        : { overrides:{}, customs:[], deletedIds:[] };
    } catch { return { overrides:{}, customs:[], deletedIds:[] }; }
  }

  function pendingEditCount() {
    const staticLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
    const byId = new Map(staticLibrary.map(prompt => [String(prompt.id || ""), prompt]));
    const state = managerState();
    let count = 0;

    for (const custom of state.customs) {
      const live = byId.get(String(custom?.id || ""));
      if (!live) { count += 1; continue; }
      const fields = ["label", "position", "difficulty", "rating", "cooldown", "enabled"];
      if (fields.some(field => custom?.[field] !== undefined && live?.[field] !== custom?.[field])) count += 1;
    }
    for (const [id, override] of Object.entries(state.overrides)) {
      const live = byId.get(id);
      if (!live) continue;
      if (override && typeof override === "object" && Object.entries(override).some(([field, value]) => live?.[field] !== value)) count += 1;
    }
    for (const id of state.deletedIds) if (byId.has(String(id))) count += 1;
    return count;
  }

  function installUnsavedPill() {
    const host = document.querySelector(".studio-topbar-status");
    if (!host) return;
    let pill = document.getElementById("studioUnsavedPill");
    if (!pill) {
      pill = document.createElement("span");
      pill.id = "studioUnsavedPill";
      pill.className = "topbar-pill";
      host.appendChild(pill);
    }
    const count = pendingEditCount();
    pill.hidden = count === 0;
    pill.textContent = `${count} local edit${count === 1 ? "" : "s"}`;
    pill.title = "Prompt changes stored in this browser that do not yet match the loaded prompt-library.js.";
  }

  function loadCertCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CERT_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {}; }
  }

  function saveCertCache(cache) {
    try { localStorage.setItem(CERT_KEY, JSON.stringify(cache)); } catch {}
  }

  function liveCertificationPromptLibrary() {
    const apiLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(apiLibrary)
      ? apiLibrary
      : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function certifiedPromptPoolState() {
    const snapshot = window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;
    if (Array.isArray(snapshot)) {
      return { ready:true, prompts:snapshot, expected:snapshot.length, actual:snapshot.length, reason:"Certification snapshot active." };
    }

    const meta = window.FPL_FOUR_STAR_LIBRARY;
    const library = liveCertificationPromptLibrary();
    const expected = Number(meta?.total);
    if (!meta?.ready) {
      return { ready:false, prompts:[], expected:0, actual:library.length, reason:"Quality Enforcement v2 is still finalising the certified prompt library." };
    }
    if (!Number.isInteger(expected) || expected <= 0) {
      return { ready:false, prompts:[], expected:0, actual:library.length, reason:"Certified prompt-library metadata is incomplete." };
    }

    const ids = library.map(prompt => String(prompt?.id || "")).filter(Boolean);
    const uniqueIds = new Set(ids);
    if (ids.length !== library.length || uniqueIds.size !== library.length) {
      return { ready:false, prompts:[], expected, actual:library.length, reason:"The live prompt library has missing or duplicate IDs." };
    }
    if (library.length !== expected) {
      return { ready:false, prompts:[], expected, actual:library.length, reason:`Certified metadata expects ${expected.toLocaleString("en-GB")} prompts but the live library currently has ${library.length.toLocaleString("en-GB")}.` };
    }

    const belowFloor = library.filter(prompt => Number(prompt?.rating || 0) < 4).length;
    if (belowFloor) {
      return { ready:false, prompts:[], expected, actual:library.length, reason:`${belowFloor.toLocaleString("en-GB")} prompt(s) are still below the 4★ certification floor.` };
    }
    return { ready:true, prompts:library.slice(), expected, actual:library.length, reason:"Certified 4★+ prompt library ready." };
  }

  function requestCertificationPromptTools() {
    window.FPL_STUDIO_BOOTSTRAP?.ensurePromptLoader?.();
    const loader = window.FPL_STUDIO_LOAD_PROMPT_TOOLS;
    if (typeof loader !== "function") return false;
    loader();
    return true;
  }

  async function waitForCertifiedPromptPool(status) {
    let current = certifiedPromptPoolState();
    if (current.ready) return current;

    return await new Promise(resolve => {
      let settled = false;
      const events = [
        "fpl:four-star-library-ready",
        "fpl:prompt-quality-enforcement-v2-ready",
        "fpl:prompt-tools-ready",
        "fpl:approved-prompt-baseline-ready",
        "fpl:refinement-survivor-pack-ready"
      ];
      const cleanup = () => {
        clearInterval(timer);
        clearTimeout(timeout);
        events.forEach(name => window.removeEventListener(name, refresh));
      };
      const finish = value => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };
      const refresh = () => {
        if (certificationCancelled) return finish({ ...certifiedPromptPoolState(), cancelled:true });
        requestCertificationPromptTools();
        current = certifiedPromptPoolState();
        if (current.ready) return finish(current);

        const progress = window.FPL_FOUR_STAR_LIBRARY_PROGRESS;
        if (progress?.state === "fail") {
          return finish({ ...current, failed:true, reason:String(progress.message || current.reason) });
        }
        if (status) {
          const hasProgress = Number(progress?.total) > 0 && Number.isFinite(Number(progress?.percent));
          const progressText = hasProgress
            ? ` · ${Math.round(Number(progress.percent))}% (${Number(progress.current || 0).toLocaleString("en-GB")} / ${Number(progress.total || 0).toLocaleString("en-GB")})`
            : "";
          status.textContent = `Finalising the certified 4★+ prompt library before season certification${progressText}. Certification has not started yet.`;
        }
      };
      const timer = setInterval(refresh, 250);
      const timeout = setTimeout(() => finish({ ...certifiedPromptPoolState(), timedOut:true }), CERTIFICATION_POOL_WAIT_MS);
      events.forEach(name => window.addEventListener(name, refresh));
      refresh();
    });
  }

  function certificationCoverage() {
    const engine = window.ValidationEngine;
    if (!engine?.getAllSeasonLabels || !engine?.getSeasonFingerprint) return { state:"warn", title:"Not available", detail:"Validation Engine has not loaded yet.", fresh:0, total:0 };
    const seasons = engine.getAllSeasonLabels();
    const poolState = certifiedPromptPoolState();
    if (!poolState.ready) {
      return { state:"warn", title:"Prompt pool pending", detail:`${poolState.reason} Current loading library: ${poolState.actual.toLocaleString("en-GB")} prompts.`, fresh:0, total:seasons.length };
    }
    const cache = loadCertCache();
    let fresh = 0;
    let failed = 0;
    for (const season of seasons) {
      const fingerprint = engine.getSeasonFingerprint(season);
      const entry = cache[season];
      if (entry?.fingerprint && entry.fingerprint === fingerprint) {
        fresh += 1;
        if (!entry.certified) failed += 1;
      }
    }
    if (failed) return { state:"bad", title:`${failed} failed`, detail:`${fresh} of ${seasons.length} seasons have current certification results.`, fresh, total:seasons.length };
    if (fresh === seasons.length && seasons.length) return { state:"good", title:`${fresh}/${seasons.length} certified`, detail:"Every supported season matches its last certified fingerprint.", fresh, total:seasons.length };
    return { state:"warn", title:`${fresh}/${seasons.length} current`, detail:"Run Certify All Seasons after database or prompt changes.", fresh, total:seasons.length };
  }

  function databaseCheck() {
    const statusText = document.getElementById("auditStatusTop")?.textContent?.trim() || "Not run";
    const playerCount = numberFrom(document.getElementById("auditPlayerCount")?.textContent);
    const ran = playerCount > 0 || !/not run|loading|waiting/i.test(statusText);
    if (!ran) return { state:"warn", label:"Database", title:"Audit not run", detail:"Open Database Health and run the read-only audit." };
    const blockers = numberFrom(document.getElementById("auditCriticalCount")?.textContent);
    const warnings = numberFrom(document.getElementById("auditWarningCount")?.textContent);
    return blockers
      ? { state:"bad", label:"Database", title:`${blockers} blocker${blockers === 1 ? "" : "s"}`, detail:`${warnings} warning${warnings === 1 ? "" : "s"} also reported.` }
      : { state:"good", label:"Database", title:"Audit clear", detail:`0 blockers · ${warnings} non-blocking warning${warnings === 1 ? "" : "s"}.` };
  }

  function promptCheck() {
    const engine = window.ValidationEngine;
    const library = engine?.getPromptLibrary?.() || (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
    const ids = new Set();
    let duplicates = 0;
    let invalid = 0;
    let enabled = 0;
    for (const prompt of library) {
      if (prompt?.enabled !== false) enabled += 1;
      const id = String(prompt?.id || "");
      if (ids.has(id)) duplicates += 1;
      ids.add(id);
      if (!id || !String(prompt?.label || "").trim() || !POSITIONS.has(prompt?.position) || typeof prompt?.test !== "function") invalid += 1;
    }
    if (duplicates || invalid) return { state:"bad", label:"Prompts", title:`${invalid + duplicates} definition issue${invalid + duplicates === 1 ? "" : "s"}`, detail:`${invalid} invalid · ${duplicates} duplicate IDs.` };
    return { state:"good", label:"Prompts", title:`${enabled.toLocaleString()} enabled`, detail:"Prompt definitions and IDs are structurally valid." };
  }

  function leaderboardCheck() {
    const chipText = document.getElementById("leaderboardBackendChip")?.textContent?.trim() || "";
    if (/live/i.test(chipText)) return { state:"good", label:"Leaderboard", title:"Live", detail:"Public Supabase leaderboard health check has passed." };
    const cfg = window.FPL_LEADERBOARD_CONFIG;
    const configured = cfg?.enabled === true && /^https:\/\//.test(String(cfg?.supabaseUrl || "")) && /^sb_publishable_/.test(String(cfg?.publishableKey || "")) && Boolean(cfg?.functions?.list);
    return configured
      ? { state:"warn", label:"Leaderboard", title:"Configured", detail:"Open Leaderboard or run its live health check to verify the endpoint." }
      : { state:"bad", label:"Leaderboard", title:"Needs attention", detail:"Production leaderboard configuration is incomplete." };
  }

  function scheduleDates() {
    const manifest = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges) ? window.FPL_CHALLENGE_MANIFEST.challenges : [];
    const local = manifest.map(item => String(item?.date || "")).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date));
    const server = Array.isArray(scheduleState?.scheduled) ? scheduleState.scheduled.map(item => String(item?.release_date || item?.releaseDate || "")).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)) : [];
    return [...new Set([...local, ...server])].sort();
  }

  function nextFreeDate() {
    const used = new Set(scheduleDates());
    let candidate = localDateString();
    for (let index = 0; index < 370; index += 1) {
      if (!used.has(candidate)) return candidate;
      candidate = addDays(candidate, 1);
    }
    return candidate;
  }

  function scheduleCheck() {
    const dates = scheduleDates();
    const last = dates.at(-1) || "";
    const today = localDateString();
    if (!dates.length) return { state:"warn", label:"Schedule", title:"No coverage", detail:"Generate or publish future Daily Challenges." };
    if (last < today) return { state:"bad", label:"Schedule", title:"Coverage expired", detail:`Last scheduled date was ${formatDate(last)}.` };
    return { state:"good", label:"Schedule", title:`Through ${formatDate(last)}`, detail:`${dates.length} known calendar date${dates.length === 1 ? "" : "s"} · next free ${formatDate(nextFreeDate())}.` };
  }

  function editsCheck() {
    const count = pendingEditCount();
    return count
      ? { state:"warn", label:"Browser edits", title:`${count} local edit${count === 1 ? "" : "s"}`, detail:"Export/upload the prompt library when you want these changes to become the repository baseline." }
      : { state:"good", label:"Browser edits", title:"No pending edits", detail:"Loaded prompt-library.js matches the browser manager state." };
  }

  function renderPreflight() {
    const host = document.getElementById("studioPreflightGrid");
    const summary = document.getElementById("studioPreflightSummary");
    if (!host || !summary) return;
    const certification = certificationCoverage();
    const checks = [databaseCheck(), promptCheck(), { state:certification.state, label:"Certification", title:certification.title, detail:certification.detail }, leaderboardCheck(), scheduleCheck(), editsCheck()];
    host.innerHTML = checks.map(item => `<article class="studio-preflight-item ${item.state}"><span>${esc(item.label)}</span><strong>${item.state === "good" ? "✓" : item.state === "bad" ? "!" : "○"} ${esc(item.title)}</strong><small>${esc(item.detail)}</small></article>`).join("");
    const bad = checks.filter(item => item.state === "bad").length;
    const warn = checks.filter(item => item.state === "warn").length;
    summary.className = `studio-preflight-summary ${bad ? "bad" : warn ? "" : "good"}`;
    summary.innerHTML = bad
      ? `<strong>Not ready</strong><span>${bad} blocking area${bad === 1 ? "" : "s"} need attention before treating the Studio as fully green.</span>`
      : warn
        ? `<strong>Core systems healthy</strong><span>${warn} check${warn === 1 ? "" : "s"} are still pending or browser-local.</span>`
        : `<strong>READY</strong><span>Database, prompts, certification, leaderboard, schedule and browser state are all current.</span>`;
    installUnsavedPill();
  }

  function installPreflight() {
    if (document.getElementById("studioPreflight")) return;
    const dashboard = document.querySelector('[data-workspace="dashboard"]');
    const anchor = dashboard?.querySelector(".dashboard-enhancements") || dashboard?.querySelector(".status-grid");
    if (!anchor) return;
    const panel = document.createElement("section");
    panel.id = "studioPreflight";
    panel.className = "studio-finish-panel";
    panel.innerHTML = `
      <div class="studio-finish-head"><div><span class="studio-finish-kicker">Release control</span><h2>Studio Preflight</h2><p>One view of the checks that matter before publishing or making a new baseline.</p></div><button id="studioPreflightRun" class="button secondary" type="button">Refresh checks</button></div>
      <div id="studioPreflightGrid" class="studio-preflight-grid"></div>
      <div id="studioPreflightSummary" class="studio-preflight-summary"></div>`;
    anchor.insertAdjacentElement("afterend", panel);
    document.getElementById("studioPreflightRun")?.addEventListener("click", renderPreflight);
    renderPreflight();
  }

  function freshCertificationEntries() {
    const engine = window.ValidationEngine;
    if (!engine?.getAllSeasonLabels || !engine?.getSeasonFingerprint) return [];
    const cache = loadCertCache();
    return engine.getAllSeasonLabels().map(season => {
      const fingerprint = engine.getSeasonFingerprint(season);
      const cached = cache[season];
      const fresh = cached?.fingerprint === fingerprint;
      return { season, fingerprint, fresh, cached };
    });
  }

  function renderCertificationMatrix() {
    const grid = document.getElementById("allSeasonGrid");
    const status = document.getElementById("allSeasonStatus");
    if (!grid || !status) return;
    const poolState = certifiedPromptPoolState();
    if (!poolState.ready) {
      grid.innerHTML = "";
      status.textContent = `Waiting for the certified 4★+ prompt library. ${poolState.reason} Current loading library: ${poolState.actual.toLocaleString("en-GB")} prompts. Certify All Seasons will wait automatically.`;
      renderPreflight();
      return;
    }
    const entries = freshCertificationEntries();
    let current = 0;
    let failed = 0;
    grid.innerHTML = entries.map(entry => {
      let state = "stale";
      let title = "Needs run";
      let detail = "Fingerprint not certified yet.";
      if (entry.fresh) {
        current += 1;
        state = entry.cached.certified ? "good" : "bad";
        title = entry.cached.certified ? "Certified" : "Failed";
        if (!entry.cached.certified) failed += 1;
        detail = `${Number(entry.cached.evaluations || 0).toLocaleString()} evaluations · ${Number(entry.cached.warnings || 0)} warnings`;
      }
      return `<article class="all-season-card ${state}"><span>${esc(entry.season)}</span><strong>${state === "good" ? "✓" : state === "bad" ? "!" : "○"} ${title}</strong><small>${esc(detail)}</small></article>`;
    }).join("");
    status.textContent = entries.length
      ? failed ? `${failed} current season certification${failed === 1 ? "" : "s"} failed.` : current === entries.length ? `All ${entries.length} supported seasons are certified against their current fingerprints.` : `${current} of ${entries.length} supported seasons have current certification results.`
      : "No season records are available.";
    renderPreflight();
  }

  async function certifyAllSeasons() {
    const engine = window.ValidationEngine;
    const run = document.getElementById("certifyAllSeasonsBtn");
    const cancel = document.getElementById("cancelAllSeasonsBtn");
    const bar = document.querySelector("#allSeasonProgress > span");
    const status = document.getElementById("allSeasonStatus");
    if (!engine?.certifySeason || !engine?.getAllSeasonLabels) return;

    certificationCancelled = false;
    if (run) { run.disabled = true; run.textContent = "Preparing certified prompts…"; }
    if (cancel) cancel.disabled = false;
    let certificationPool = null;

    try {
      const poolState = await waitForCertifiedPromptPool(status);
      if (certificationCancelled || poolState?.cancelled) {
        if (status) status.textContent = "All-season certification cancelled before the certified prompt pool was ready.";
        return;
      }
      if (!poolState?.ready) {
        if (status) {
          const suffix = poolState?.timedOut ? " The readiness wait timed out." : "";
          status.textContent = `Certification did not start. ${poolState?.reason || "The certified prompt library is not ready."}${suffix}`;
        }
        return;
      }

      certificationPool = Object.freeze(poolState.prompts.slice());
      window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL = certificationPool;
      const seasons = engine.getAllSeasonLabels();
      const cache = loadCertCache();
      if (status) status.textContent = `Certified prompt snapshot locked at ${certificationPool.length.toLocaleString("en-GB")} prompts. Starting all-season certification…`;

      for (let index = 0; index < seasons.length; index += 1) {
        if (certificationCancelled) break;
        const season = seasons[index];
        if (status) status.textContent = `Certifying ${season} · ${index + 1} of ${seasons.length} · ${certificationPool.length.toLocaleString("en-GB")} frozen certified prompts.`;
        if (bar) bar.style.width = `${Math.round((index / seasons.length) * 100)}%`;
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        const result = engine.certifySeason(season);
        if (result?.ok) {
          cache[season] = {
            fingerprint: result.fingerprint || engine.getSeasonFingerprint(season),
            certified: result.certified === true,
            status: result.status,
            certifiedAt: result.certifiedAt,
            evaluations: result.promptSummary?.evaluations || 0,
            runtimeErrors: result.promptSummary?.runtimeErrors || 0,
            disagreements: result.promptSummary?.diagnosticMismatches || 0,
            warnings: (result.warnings || []).reduce((sum, warning) => sum + Number(warning.count || 0), 0)
          };
          saveCertCache(cache);
        }
        renderCertificationMatrix();
      }
      if (bar) bar.style.width = certificationCancelled ? bar.style.width : "100%";
      if (status) status.textContent = certificationCancelled ? "All-season certification stopped after the current season." : "All-season certification complete.";
    } catch (error) {
      if (status) status.textContent = `Certification stopped: ${error?.message || error}`;
    } finally {
      if (window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL === certificationPool) delete window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;
      if (run) { run.disabled = false; run.textContent = "Certify all seasons"; }
      if (cancel) cancel.disabled = true;
      renderCertificationMatrix();
    }
  }

  function installAllSeasonCertification() {
    if (document.getElementById("allSeasonCertification")) return;
    const result = document.getElementById("validationHealthResult");
    const anchor = result?.closest(".stage-one-tool-panel,.panel") || result?.parentElement;
    if (!anchor) return;
    const panel = document.createElement("section");
    panel.id = "allSeasonCertification";
    panel.className = "studio-finish-panel";
    panel.innerHTML = `
      <div class="studio-finish-head"><div><span class="studio-finish-kicker">Regression suite</span><h2>Certify all seasons</h2><p>Run the same complete certification against every supported season after the certified 4★+ prompt library is ready. The final prompt set is frozen for the whole run, and results automatically become stale when player data or prompts change.</p></div></div>
      <div class="studio-finish-actions"><button id="certifyAllSeasonsBtn" class="button primary" type="button">Certify all seasons</button><button id="cancelAllSeasonsBtn" class="button secondary" type="button" disabled>Stop after this season</button></div>
      <div id="allSeasonProgress" class="all-season-progress"><span></span></div>
      <p id="allSeasonStatus" class="all-season-status">Checking saved certification fingerprints…</p>
      <div id="allSeasonGrid" class="all-season-grid"></div>`;
    anchor.insertAdjacentElement("afterend", panel);
    document.getElementById("certifyAllSeasonsBtn")?.addEventListener("click", certifyAllSeasons);
    document.getElementById("cancelAllSeasonsBtn")?.addEventListener("click", () => { certificationCancelled = true; });
    renderCertificationMatrix();
  }

  function currentScheduleState() {
    return scheduleState || window.FPL_STUDIO_SCHEDULE || null;
  }

  function renderScheduleCoverage() {
    scheduleState = currentScheduleState();
    const title = document.getElementById("scheduleCoverageTitle");
    const detail = document.getElementById("scheduleCoverageDetail");
    const useButton = document.getElementById("useNextFreeDateBtn");
    if (!title || !detail) return;
    const dates = scheduleDates();
    const last = dates.at(-1) || "";
    const next = nextFreeDate();
    const serverDates = Array.isArray(scheduleState?.scheduled) ? scheduleState.scheduled.length : 0;
    title.textContent = last ? `Coverage through ${formatDate(last)}` : "No future coverage loaded";
    detail.textContent = `${dates.length} known calendar date${dates.length === 1 ? "" : "s"}${serverDates ? ` · ${serverDates} confirmed in Supabase` : ""} · next free ${formatDate(next)}.`;
    if (useButton) {
      useButton.disabled = !/^\d{4}-\d{2}-\d{2}$/.test(next);
      useButton.dataset.nextDate = next;
    }
    renderPreflight();
  }

  function installScheduleCoverage() {
    if (document.getElementById("scheduleCoverage")) return;
    const chip = document.getElementById("batchManifestChip");
    const download = document.getElementById("downloadWeekBtn");
    const anchor = chip?.parentElement || download?.parentElement;
    if (!anchor) return;
    const panel = document.createElement("div");
    panel.id = "scheduleCoverage";
    panel.className = "schedule-coverage";
    panel.innerHTML = `<div><strong id="scheduleCoverageTitle">Checking schedule coverage…</strong><span id="scheduleCoverageDetail">Comparing the local manifest with the live publishing schedule.</span></div><div class="schedule-coverage-actions"><button id="useNextFreeDateBtn" class="button secondary" type="button">Use next free date</button><button id="refreshScheduleCoverageBtn" class="button secondary" type="button">Refresh</button></div>`;
    anchor.insertAdjacentElement("afterend", panel);
    document.getElementById("useNextFreeDateBtn")?.addEventListener("click", event => {
      const input = document.getElementById("batchStartDate");
      const next = event.currentTarget.dataset.nextDate || nextFreeDate();
      if (!input || !next) return;
      input.value = next;
      input.dispatchEvent(new Event("input", { bubbles:true }));
      input.dispatchEvent(new Event("change", { bubbles:true }));
      input.scrollIntoView({ behavior:"smooth", block:"center" });
    });
    document.getElementById("refreshScheduleCoverageBtn")?.addEventListener("click", () => {
      if (typeof window.FPL_STUDIO_SCHEDULE?.refresh === "function") window.FPL_STUDIO_SCHEDULE.refresh();
      renderScheduleCoverage();
    });
    renderScheduleCoverage();
  }

  function observeStatusChanges() {
    const observer = new MutationObserver(() => {
      installUnsavedPill();
      if (document.getElementById("studioPreflight")) renderPreflight();
    });
    for (const id of ["auditStatusTop", "auditCriticalCount", "auditWarningCount", "leaderboardBackendChip"]) {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { childList:true, subtree:true, characterData:true });
    }
    window.addEventListener("storage", event => { if (event.key === MANAGER_KEY || event.key === CERT_KEY) { installUnsavedPill(); renderCertificationMatrix(); renderPreflight(); } });
    window.addEventListener("focus", () => { installUnsavedPill(); renderPreflight(); });
    window.addEventListener("fpl:prompt-tools-ready", () => { installUnsavedPill(); renderCertificationMatrix(); renderPreflight(); });
    window.addEventListener("fpl:four-star-library-ready", () => { renderCertificationMatrix(); renderPreflight(); });
    window.addEventListener("fpl:prompt-library-changed", () => {
      if (!Array.isArray(window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL)) { renderCertificationMatrix(); renderPreflight(); }
    });
    window.addEventListener("fpl:schedule-status", event => { scheduleState = event.detail || window.FPL_STUDIO_SCHEDULE || null; renderScheduleCoverage(); });
  }

  function install() {
    addStyles();
    retireOldImports();
    cleanOverviewCopy();
    installUnsavedPill();
    installPreflight();
    installAllSeasonCertification();
    installScheduleCoverage();
    observeStatusChanges();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once:true });
  else install();
})();
