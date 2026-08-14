/* FPL Draft Challenge — Studio leaderboard status panel v2.0.0.
   Presentation + deployment-health checks only. No leaderboard scoring/submission logic lives here. */
(() => {
  "use strict";

  const mount = document.getElementById("leaderboardBackendStatus");
  const chip = document.getElementById("leaderboardBackendChip");
  if (!mount) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));

  function addStyles() {
    if (document.getElementById("leaderboardStudioStatusStyles")) return;
    const style = document.createElement("style");
    style.id = "leaderboardStudioStatusStyles";
    style.textContent = `
      .leaderboard-health-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .leaderboard-health-item{min-width:0;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025)}
      .leaderboard-health-item strong,.leaderboard-health-item span,.leaderboard-health-item small{display:block}
      .leaderboard-health-item span{font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.065em;color:var(--stage-muted,#9bb7a8)}
      .leaderboard-health-item strong{margin:5px 0 3px;font-size:.9rem;line-height:1.2}
      .leaderboard-health-item small{color:var(--stage-muted,#9bb7a8);font-size:.66rem;line-height:1.38;overflow-wrap:anywhere}
      .leaderboard-health-item.good strong{color:var(--stage-green,#39e88f)}
      .leaderboard-health-item.pending strong{color:var(--stage-blue,#62c9ff)}
      .leaderboard-health-item.bad strong{color:var(--stage-amber,#ffd477)}
      .leaderboard-health-actions{display:grid;grid-template-columns:1.35fr .65fr;gap:8px;margin-top:11px}
      .leaderboard-health-actions .button{min-width:0;margin:0}
      .leaderboard-health-message{margin-top:9px;padding:10px 12px;border-radius:12px;background:rgba(98,201,255,.06);border:1px solid rgba(98,201,255,.15);font-size:.7rem;line-height:1.45;color:var(--stage-muted,#9bb7a8)}
      .leaderboard-health-message.good{background:rgba(0,255,135,.055);border-color:rgba(0,255,135,.17);color:#b7f7d3}
      .leaderboard-health-message.bad{background:rgba(255,209,102,.055);border-color:rgba(255,209,102,.18);color:#ffe4a0}
      #leaderboardBackendChip.live{background:rgba(0,255,135,.12);border-color:rgba(0,255,135,.24);color:var(--stage-green,#39e88f)}
      @media(max-width:700px){
        .leaderboard-health-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .leaderboard-health-item{min-height:102px;padding:10px 11px;border-radius:13px}
        .leaderboard-health-item span{font-size:.58rem}
        .leaderboard-health-item strong{font-size:.82rem}
        .leaderboard-health-item small{font-size:.61rem}
        .leaderboard-health-actions{grid-template-columns:1fr 1fr}
        .leaderboard-health-actions .button{min-height:46px;padding:9px 8px;font-size:.72rem;line-height:1.2}
      }
      @media(max-width:380px){
        .leaderboard-health-item{padding-inline:9px}
        .leaderboard-health-actions{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function updatePanelHeading() {
    const panel = mount.closest(".stage-one-tool-panel, .panel") || mount.parentElement;
    if (!panel) return;
    const title = panel.querySelector("h2");
    const copy = panel.querySelector(".section-copy, .panel-heading p");
    if (title && /leaderboard deployment checker/i.test(title.textContent || "")) title.textContent = "Leaderboard status";
    if (copy && /supabase|publishable key|edge function/i.test(copy.textContent || "")) {
      copy.textContent = "Live connection, public browser configuration and leaderboard services in one place.";
    }
  }

  function setChip(text, state = "") {
    if (!chip) return;
    chip.textContent = text;
    chip.classList.toggle("ready-chip", state === "good");
    chip.classList.toggle("live", state === "good");
    chip.classList.toggle("warning-chip", state === "bad");
  }

  function maskProject(url) {
    const match = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(String(url || ""));
    return match ? `${match[1].slice(0,6)}…${match[1].slice(-4)} · eu-west-1` : "Project URL needs attention";
  }

  function evaluateConfig(cfg) {
    const key = String(cfg?.publishableKey || "");
    const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(cfg?.supabaseUrl || "")) && !/YOUR_PROJECT_REF/i.test(String(cfg?.supabaseUrl || ""));
    const dangerous = /service_role|sb_secret_/i.test(key);
    const keyOk = /^sb_publishable_[A-Za-z0-9._-]+$/.test(key) && !/REPLACE_ME/i.test(key) && !dangerous;
    const coreNames = [cfg?.functions?.start, cfg?.functions?.pick, cfg?.functions?.finish, cfg?.functions?.list].filter(Boolean);
    const extendedNames = [cfg?.functions?.allTime, cfg?.functions?.profile].filter(Boolean);
    const coreOk = coreNames.length === 4 && new Set(coreNames).size === 4;
    const extendedOk = extendedNames.length === 2 && new Set(extendedNames).size === 2;
    const configured = urlOk && keyOk && coreOk && cfg?.enabled === true;
    return { key, urlOk, keyOk, dangerous, coreNames, extendedNames, coreOk, extendedOk, configured };
  }

  function render(cfg) {
    addStyles();
    updatePanelHeading();
    const state = evaluateConfig(cfg);
    const refreshSeconds = Math.max(1, Number(cfg?.refreshSeconds) || 60);
    const checks = [
      ["Supabase project", state.urlOk, state.urlOk ? "Connected" : "Needs attention", state.urlOk ? maskProject(cfg.supabaseUrl) : "Production project URL is missing."],
      ["Browser key", state.keyOk, state.keyOk ? "Safe key loaded" : "Needs attention", state.dangerous ? "Secret/service-role keys must never be exposed here." : state.keyOk ? "Publishable browser credential detected." : "Browser-safe publishable key is missing."],
      ["Core leaderboard API", state.coreOk, state.coreOk ? "4 / 4 configured" : "Incomplete", state.coreOk ? state.coreNames.join(" · ") : "Start, pick, finish and list names are required."],
      ["Extended services", state.extendedOk, state.extendedOk ? "2 / 2 configured" : "Incomplete", state.extendedOk ? "All-Time leaderboard · synced player profile" : "All-Time and profile services are expected."],
      ["Live leaderboard", cfg?.enabled === true, cfg?.enabled === true ? "Enabled" : "Disabled", cfg?.enabled === true ? "Verified Daily Challenge submissions are live." : "Live submissions are currently switched off."],
      ["Updates", cfg?.realtimeReady === true || refreshSeconds > 0, cfg?.realtimeReady === true ? "Realtime ready" : `Polling · ${refreshSeconds}s`, cfg?.realtimeReady === true ? `Realtime hook ready · ${refreshSeconds}s polling fallback.` : `Leaderboard refreshes every ${refreshSeconds} seconds.`]
    ];

    setChip(state.configured ? "Checking live API…" : "Needs attention", state.configured ? "" : "bad");
    mount.innerHTML = `
      <div class="leaderboard-health-grid">
        ${checks.map(([label, ok, status, detail], index) => `
          <article class="leaderboard-health-item ${ok ? "good" : "bad"}"${index === 2 ? ' id="leaderboardApiCard"' : ""}>
            <span>${esc(label)}</span>
            <strong>${ok ? "✓" : "○"} ${esc(status)}</strong>
            <small>${esc(detail)}</small>
          </article>`).join("")}
      </div>
      <div class="leaderboard-health-actions">
        <button class="button primary" type="button" id="leaderboardHealthProbe" ${state.configured ? "" : "disabled"}>Run live health check</button>
        <button class="button secondary" type="button" id="leaderboardConfigCheck">Refresh status</button>
      </div>
      <div class="leaderboard-health-message" id="leaderboardHealthMessage">
        ${state.configured ? "Production configuration loaded. Checking the public leaderboard API…" : "The Studio could not read the complete production leaderboard configuration."}
      </div>`;

    document.getElementById("leaderboardConfigCheck")?.addEventListener("click", () => render(window.FPL_LEADERBOARD_CONFIG || {}));
    document.getElementById("leaderboardHealthProbe")?.addEventListener("click", () => probe(cfg));
    if (state.configured) window.setTimeout(() => probe(cfg, true), 80);
  }

  async function probe(cfg, automatic = false) {
    const button = document.getElementById("leaderboardHealthProbe");
    const message = document.getElementById("leaderboardHealthMessage");
    const apiCard = document.getElementById("leaderboardApiCard");
    if (!cfg?.supabaseUrl || !cfg?.functions?.list || !cfg?.publishableKey) return;
    if (button) {
      button.disabled = true;
      if (!automatic) button.textContent = "Checking…";
    }
    if (message) {
      message.classList.remove("good", "bad");
      message.textContent = "Contacting the public leaderboard API…";
    }

    try {
      const response = await fetch(`${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/${encodeURIComponent(cfg.functions.list)}`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "apikey":cfg.publishableKey },
        body: JSON.stringify({ challengeId:"studio-health-check", limit:1 }),
        cache: "no-store"
      });
      let body = {};
      try { body = await response.json(); } catch {}

      const reachable = response.status > 0 && response.status < 500;
      if (reachable) {
        setChip("Live", "good");
        if (apiCard) {
          apiCard.classList.remove("bad", "pending");
          apiCard.classList.add("good");
          const strong = apiCard.querySelector("strong");
          const small = apiCard.querySelector("small");
          if (strong) strong.textContent = "✓ API reachable";
          if (small) small.textContent = response.ok ? "Public leaderboard endpoint responded successfully." : `Edge Function responded (${response.status}); synthetic health-check challenge is not a live challenge.`;
        }
        if (message) {
          message.classList.add("good");
          message.textContent = response.ok
            ? "Live leaderboard health check passed. Supabase and the public leaderboard endpoint are responding."
            : `Leaderboard Edge Function is reachable (HTTP ${response.status}). ${body?.message || body?.error || "The synthetic Studio challenge is intentionally not a live challenge."}`;
        }
      } else {
        setChip("Needs attention", "bad");
        if (apiCard) apiCard.classList.add("bad");
        if (message) {
          message.classList.add("bad");
          message.textContent = `Leaderboard API responded with HTTP ${response.status}. ${body?.message || body?.error || "Check the Edge Function logs."}`;
        }
      }
    } catch (error) {
      setChip("Connection issue", "bad");
      if (apiCard) apiCard.classList.add("bad");
      if (message) {
        message.classList.add("bad");
        message.textContent = `Could not reach the leaderboard API: ${error?.message || error}`;
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Run live health check";
      }
    }
  }

  function waitForConfig() {
    if (window.FPL_LEADERBOARD_CONFIG) {
      render(window.FPL_LEADERBOARD_CONFIG);
      return;
    }

    setChip("Loading config…");
    mount.innerHTML = '<div class="leaderboard-health-message">Loading the production leaderboard configuration…</div>';

    const existing = [...document.scripts].find(script => /\/js\/leaderboard-config\.js(?:[?#]|$)/.test(script.src || ""));
    if (existing) {
      existing.addEventListener("load", () => render(window.FPL_LEADERBOARD_CONFIG || {}), { once:true });
      window.setTimeout(() => render(window.FPL_LEADERBOARD_CONFIG || {}), 1400);
      return;
    }

    const script = document.createElement("script");
    script.src = new URL("js/leaderboard-config.js?v=5.0.0-studio", document.baseURI).toString();
    script.async = false;
    script.dataset.studioLeaderboardConfig = "1";
    script.addEventListener("load", () => render(window.FPL_LEADERBOARD_CONFIG || {}), { once:true });
    script.addEventListener("error", () => {
      setChip("Config unavailable", "bad");
      mount.innerHTML = '<div class="leaderboard-health-message bad">Could not load the production leaderboard configuration.</div>';
    }, { once:true });
    document.head.appendChild(script);
  }

  waitForConfig();
})();

/* Studio status authority v1.0.0 — retired repair counters must not override a completed live audit. */
(() => {
  "use strict";
  const numberFrom = value => {
    const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };

  function syncFromAudit() {
    const auditText = document.getElementById("auditStatusTop")?.textContent?.trim() || "Not run";
    const playerCount = numberFrom(document.getElementById("auditPlayerCount")?.textContent);
    const auditHasRun = !/not run|loading|waiting/i.test(auditText) || playerCount > 0;
    if (!auditHasRun) return;

    const critical = numberFrom(document.getElementById("auditCriticalCount")?.textContent);
    const metadata = numberFrom(document.getElementById("auditInfoCount")?.textContent);
    const blockerPill = document.getElementById("stageOneBlockerPill");
    if (blockerPill) {
      blockerPill.classList.toggle("danger", critical > 0);
      blockerPill.classList.toggle("safe", critical === 0);
      blockerPill.textContent = critical > 0
        ? `${critical.toLocaleString()} blocker${critical === 1 ? "" : "s"}`
        : "No blockers";
    }

    const dashboardBadge = document.querySelector('[data-workspace-badge="dashboard"]');
    if (dashboardBadge) {
      dashboardBadge.textContent = critical > 0 ? String(critical) : "";
      dashboardBadge.hidden = critical === 0;
    }
    const databaseBadge = document.querySelector('[data-workspace-badge="database"]');
    if (databaseBadge) {
      databaseBadge.textContent = critical > 0 ? String(critical) : "✓";
      databaseBadge.hidden = false;
      databaseBadge.classList.toggle("danger", critical > 0);
    }

    const databaseStatus = document.getElementById("dashboardDatabaseStatus");
    if (databaseStatus) databaseStatus.textContent = `${critical.toLocaleString()} blockers · ${metadata.toLocaleString()} metadata gaps`;

    const nextTitle = document.getElementById("nextActionTitle");
    const nextCopy = document.getElementById("nextActionCopy");
    const nextButton = document.getElementById("nextActionButton");
    if (critical === 0 && nextTitle && nextCopy && nextButton && /database blocker/i.test(nextTitle.textContent || "")) {
      nextTitle.textContent = "Generate the next seven-day calendar";
      nextCopy.textContent = "The database has no blocking errors. Build and test the next dated challenge batch when you are ready.";
      nextButton.textContent = "Open Daily Challenge";
      nextButton.dataset.openWorkspace = "challenge";
      nextButton.dataset.targetTitle = "Challenge settings";
    }
  }

  function start() {
    window.setTimeout(syncFromAudit, 0);
    const observer = new MutationObserver(() => window.setTimeout(syncFromAudit, 0));
    ["auditStatusTop", "auditCriticalCount", "auditInfoCount", "auditPlayerCount", "repairBlockedCount"].forEach(id => {
      const element = document.getElementById(id);
      if (element) observer.observe(element, { childList:true, subtree:true, characterData:true });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
