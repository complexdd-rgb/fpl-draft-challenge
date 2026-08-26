/* FPL Draft Challenge — mobile Results/Ranks compactness and overlap finishing pass. */
(() => {
  "use strict";

  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  if (runtime.archiveMode) return;

  const LEADERBOARD_COLLAPSE_KEY = "fpl-mobile-leaderboard-collapsed";
  const ACCOUNT_COLLAPSE_KEY = "fpl-mobile-account-collapsed";
  let accountObserver = null;
  let rootObserver = null;
  let decorateQueued = false;

  const readPreference = (key, fallback = false) => {
    try {
      const value = localStorage.getItem(key);
      if (value === "1") return true;
      if (value === "0") return false;
    } catch {}
    return fallback;
  };
  const writePreference = (key, value) => {
    try { localStorage.setItem(key, value ? "1" : "0"); } catch {}
  };

  function addStyles() {
    if (document.getElementById("mobileResultsCleanupStyles")) return;
    const style = document.createElement("style");
    style.id = "mobileResultsCleanupStyles";
    style.textContent = `
      #liveLeaderboardPanel .leaderboard-collapse-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex:0 0 auto}
      #liveLeaderboardPanel .leaderboard-collapse-toggle,
      #leaderboardAccount .leaderboard-account-collapse-toggle{
        display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:31px;padding:7px 10px;
        border:1px solid rgba(255,255,255,.11);border-radius:999px;background:rgba(255,255,255,.035);color:#e9f5ed;
        font:inherit;font-size:.57rem;font-weight:950;letter-spacing:.055em;text-transform:uppercase;cursor:pointer;
      }
      #liveLeaderboardPanel .leaderboard-collapse-toggle:hover,
      #leaderboardAccount .leaderboard-account-collapse-toggle:hover{background:rgba(255,255,255,.065)}
      #liveLeaderboardPanel .leaderboard-collapse-toggle:focus-visible,
      #leaderboardAccount .leaderboard-account-collapse-toggle:focus-visible{outline:2px solid var(--accent,#00ff87);outline-offset:2px}
      #liveLeaderboardPanel .leaderboard-collapse-icon,
      #leaderboardAccount .leaderboard-account-collapse-icon{font-size:.72rem;line-height:1}
      #liveLeaderboardPanel.is-collapsed > :not(.leaderboard-head){display:none!important}
      #leaderboardAccount .leaderboard-account-compact-label{display:none;min-width:0}
      #leaderboardAccount .leaderboard-account-compact-label strong,
      #leaderboardAccount .leaderboard-account-compact-label span{display:block}
      #leaderboardAccount .leaderboard-account-compact-label strong{font-size:.7rem;color:#fff}
      #leaderboardAccount .leaderboard-account-compact-label span{margin-top:2px;color:var(--muted);font-size:.58rem}
      #leaderboardAccount.is-account-collapsed > :not(.leaderboard-account-compact-label):not(.leaderboard-account-collapse-toggle){display:none!important}
      #leaderboardAccount.is-account-collapsed .leaderboard-account-compact-label{display:block}

      @media(max-width:700px){
        body.fpl-visual-overhaul-body .app{padding-bottom:calc(158px + env(safe-area-inset-bottom))!important}
        body.fpl-visual-overhaul-body.mobile-ui-complete .app{padding-bottom:calc(92px + env(safe-area-inset-bottom))!important}
        body.fpl-visual-overhaul-body .phase45-bottom-nav{bottom:max(8px,env(safe-area-inset-bottom))!important;width:calc(100% - 16px)!important}
        body.fpl-visual-overhaul-body:not(.mobile-ui-complete) .draft-progress-dock{bottom:calc(72px + env(safe-area-inset-bottom))!important}
        body.fpl-visual-overhaul-body.mobile-ui-complete .draft-progress-dock{position:relative!important;bottom:auto!important;z-index:2!important;margin-bottom:10px!important}

        #liveLeaderboardPanel{scroll-margin-top:12px}
        #liveLeaderboardPanel.is-collapsed{padding:12px 14px!important}
        #liveLeaderboardPanel.is-collapsed .leaderboard-head{flex-direction:row!important;align-items:center!important;gap:10px!important;padding:0!important}
        #liveLeaderboardPanel.is-collapsed .leaderboard-head > div:first-child{min-width:0;flex:1}
        #liveLeaderboardPanel.is-collapsed .leaderboard-head .overview-kicker{display:none!important}
        #liveLeaderboardPanel.is-collapsed .leaderboard-head h2{margin:0 0 2px!important;font-size:1.08rem!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #liveLeaderboardPanel.is-collapsed .leaderboard-head p{margin:0!important;max-width:190px;font-size:.61rem!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #liveLeaderboardPanel.is-collapsed .leaderboard-collapse-actions{gap:5px}
        #liveLeaderboardPanel.is-collapsed .leaderboard-state{padding:6px 8px!important;font-size:.5rem!important;white-space:nowrap}
        #liveLeaderboardPanel.is-collapsed .leaderboard-collapse-toggle{padding:6px 8px;min-height:29px}
        #liveLeaderboardPanel .leaderboard-tabs{display:grid!important;grid-template-columns:1fr 1fr;width:100%;box-sizing:border-box;margin:11px 0 2px!important}
        #liveLeaderboardPanel .leaderboard-tab{width:100%}
        #liveLeaderboardPanel .leaderboard-toolbar{margin:10px 0!important}
        #liveLeaderboardPanel .leaderboard-submit-card{margin:10px 0!important;padding:11px!important}
        #liveLeaderboardPanel .leaderboard-personal{margin:10px 0!important;padding:11px!important}
        #liveLeaderboardPanel .leaderboard-podium{margin:10px 0!important;gap:7px!important}
        #liveLeaderboardPanel .leaderboard-podium-card{padding:10px!important}

        #leaderboardAccount.mobile-account-collapsible{position:relative!important}
        #leaderboardAccount.mobile-account-collapsible.is-account-collapsed{
          display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:9px!important;
          padding:10px 11px!important;min-height:48px!important;
        }
        #leaderboardAccount.mobile-account-collapsible.is-account-collapsed .leaderboard-account-collapse-toggle{width:auto!important;min-width:66px}
        #leaderboardAccount.mobile-account-collapsible:not(.is-account-collapsed) .leaderboard-account-collapse-toggle{width:100%!important;margin-top:2px}

        #liveLeaderboardPanel .leaderboard-table th:nth-child(5),
        #liveLeaderboardPanel .leaderboard-table td:nth-child(5),
        #liveLeaderboardPanel .leaderboard-table th:nth-child(6),
        #liveLeaderboardPanel .leaderboard-table td:nth-child(6){display:none}
        #liveLeaderboardPanel .leaderboard-table th,
        #liveLeaderboardPanel .leaderboard-table td{padding:9px 7px!important;font-size:.7rem!important}
        #leaderboardAllTime .leaderboard-table th:nth-child(n+5),
        #leaderboardAllTime .leaderboard-table td:nth-child(n+5){display:none}

        #results{scroll-margin-top:12px}
        #results .result-hero{gap:10px!important}
        #results .score-card{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important}
        #results .score-card div{padding:9px 7px!important}
        #results .share-button-group{display:grid!important;grid-template-columns:1fr 1fr;gap:8px!important}
        #results .share-button-group .btn{width:100%}
      }

      @media(max-width:460px){
        #liveLeaderboardPanel .leaderboard-head{gap:8px!important}
        #liveLeaderboardPanel:not(.is-collapsed) .leaderboard-collapse-actions{width:100%;justify-content:space-between}
        #liveLeaderboardPanel:not(.is-collapsed) .leaderboard-collapse-toggle{margin-left:auto}
        #liveLeaderboardPanel.is-collapsed .leaderboard-head p{max-width:145px}
        #liveLeaderboardPanel .leaderboard-personal-grid{gap:8px!important}
        #results h2{font-size:1.04rem!important;line-height:1.25}
      }
    `;
    document.head.appendChild(style);
  }

  function setLeaderboardCollapsed(panel, collapsed, persist = false) {
    const value = Boolean(collapsed);
    panel.classList.toggle("is-collapsed", value);
    const button = panel.querySelector(".leaderboard-collapse-toggle");
    if (button) {
      button.setAttribute("aria-expanded", String(!value));
      button.setAttribute("aria-label", value ? "Expand leaderboard" : "Collapse leaderboard");
      const label = button.querySelector(".leaderboard-collapse-label");
      const icon = button.querySelector(".leaderboard-collapse-icon");
      if (label) label.textContent = value ? "Show" : "Hide";
      if (icon) icon.textContent = value ? "▾" : "▴";
    }
    if (persist) writePreference(LEADERBOARD_COLLAPSE_KEY, value);
  }

  function decorateLeaderboard() {
    const panel = document.getElementById("liveLeaderboardPanel");
    const head = panel?.querySelector(".leaderboard-head");
    const state = panel?.querySelector("#leaderboardState");
    if (!panel || !head || !state) return false;

    let actions = head.querySelector(".leaderboard-collapse-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "leaderboard-collapse-actions";
      state.replaceWith(actions);
      actions.appendChild(state);
    }
    if (!actions.querySelector(".leaderboard-collapse-toggle")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "leaderboard-collapse-toggle";
      button.innerHTML = '<span class="leaderboard-collapse-label">Hide</span><span class="leaderboard-collapse-icon" aria-hidden="true">▴</span>';
      button.addEventListener("click", () => setLeaderboardCollapsed(panel, !panel.classList.contains("is-collapsed"), true));
      actions.appendChild(button);
    }
    if (panel.dataset.mobileCollapseReady !== "1") {
      panel.dataset.mobileCollapseReady = "1";
      setLeaderboardCollapsed(panel, readPreference(LEADERBOARD_COLLAPSE_KEY, false));
    }
    return true;
  }

  function accountSignedIn(host) {
    return Boolean(host.querySelector("#leaderboardAccountSignOut")) || /syncing is on/i.test(host.textContent || "");
  }

  function setAccountCollapsed(host, collapsed, persist = false) {
    const value = Boolean(collapsed);
    host.classList.toggle("is-account-collapsed", value);
    const button = host.querySelector(".leaderboard-account-collapse-toggle");
    if (button) {
      button.setAttribute("aria-expanded", String(!value));
      const label = button.querySelector(".leaderboard-account-collapse-label");
      const icon = button.querySelector(".leaderboard-account-collapse-icon");
      if (label) label.textContent = value ? "Show" : "Hide";
      if (icon) icon.textContent = value ? "▾" : "▴";
    }
    if (persist) writePreference(ACCOUNT_COLLAPSE_KEY, value);
  }

  function decorateAccount() {
    const host = document.getElementById("leaderboardAccount");
    if (!host) return false;
    host.classList.add("mobile-account-collapsible");

    let compact = host.querySelector(":scope > .leaderboard-account-compact-label");
    if (!compact) {
      compact = document.createElement("div");
      compact.className = "leaderboard-account-compact-label";
      host.insertBefore(compact, host.firstChild);
    }
    const signedIn = accountSignedIn(host);
    compact.innerHTML = signedIn
      ? "<strong>Account synced</strong><span>Account & display settings</span>"
      : "<strong>Guest account</strong><span>Sign-in and sync settings</span>";

    let button = host.querySelector(":scope > .leaderboard-account-collapse-toggle");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "leaderboard-account-collapse-toggle";
      button.innerHTML = '<span class="leaderboard-account-collapse-label">Show</span><span class="leaderboard-account-collapse-icon" aria-hidden="true">▾</span>';
      button.addEventListener("click", () => setAccountCollapsed(host, !host.classList.contains("is-account-collapsed"), true));
      host.appendChild(button);
    }

    const prefStored = (() => { try { return localStorage.getItem(ACCOUNT_COLLAPSE_KEY); } catch { return null; } })();
    const collapsed = prefStored === null ? signedIn : readPreference(ACCOUNT_COLLAPSE_KEY, signedIn);
    setAccountCollapsed(host, collapsed);

    if (!accountObserver || accountObserver._host !== host) {
      accountObserver?.disconnect();
      accountObserver = new MutationObserver(() => scheduleDecorate());
      accountObserver._host = host;
      accountObserver.observe(host, { childList: true, subtree: false });
    }
    return true;
  }

  function syncCompletionChrome() {
    const progress = String(document.getElementById("dockProgress")?.textContent || "").replace(/\s/g, "");
    const complete = /^11\/11$/.test(progress) || !document.getElementById("results")?.classList.contains("hidden");
    document.body.classList.toggle("mobile-ui-complete", complete);
  }

  function installCompletionObserver() {
    const progress = document.getElementById("dockProgress");
    if (progress && progress.dataset.mobileCompleteObserver !== "1") {
      progress.dataset.mobileCompleteObserver = "1";
      new MutationObserver(syncCompletionChrome).observe(progress, { childList: true, subtree: true, characterData: true });
    }
    const results = document.getElementById("results");
    if (results && results.dataset.mobileCompleteObserver !== "1") {
      results.dataset.mobileCompleteObserver = "1";
      new MutationObserver(syncCompletionChrome).observe(results, { attributes: true, attributeFilter: ["class"] });
    }
    syncCompletionChrome();
  }

  function decorate() {
    addStyles();
    const leaderboardReady = decorateLeaderboard();
    const accountReady = decorateAccount();
    installCompletionObserver();
    if (leaderboardReady && accountReady && rootObserver) {
      rootObserver.disconnect();
      rootObserver = null;
    }
  }

  function scheduleDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(() => {
      decorateQueued = false;
      decorate();
    });
  }

  const start = () => {
    decorate();
    if (!document.getElementById("liveLeaderboardPanel") || !document.getElementById("leaderboardAccount")) {
      rootObserver = new MutationObserver(scheduleDecorate);
      rootObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    window.addEventListener("fpl:challenge-completed", syncCompletionChrome);
    window.addEventListener("fpl:account-auth-changed", scheduleDecorate);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
