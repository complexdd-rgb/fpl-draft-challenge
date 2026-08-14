import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value);
}

function replaceOnce(path, source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`${path}: could not find ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`${path}: ${label} matched more than once`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replaceRegexOnce(path, source, regex, replacement, label) {
  const matches = [...source.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`))];
  if (matches.length !== 1) throw new Error(`${path}: ${label} matched ${matches.length} times`);
  return source.replace(regex, replacement);
}

// ---------------------------------------------------------------------------
// leaderboard-config.js: keep the auth bridge early, but defer presentation
// modules until the result/leaderboard is actually useful.
// ---------------------------------------------------------------------------
{
  const path = 'js/leaderboard-config.js';
  let source = read(path);

  source = replaceOnce(
    path,
    source,
    `  window.FPL_ACCOUNT_AUTH = {\n    client: null,\n    _setSession(nextSession) { session = nextSession || null; },`,
    `  window.FPL_ACCOUNT_AUTH = {\n    client: null,\n    signedIn: false,\n    _setSession(nextSession) {\n      session = nextSession || null;\n      this.signedIn = Boolean(session);\n    },`,
    'account bridge session setter'
  );

  source = replaceRegexOnce(
    path,
    source,
    /\/\/ Daily Challenge Results v2[\s\S]*?\/\/ Studio-only publishing enhancement\./,
    `// Secondary live-game presentation is intentionally deferred. The core challenge and\n// verified-attempt bridge stay available immediately, while results/leaderboard extras only\n// download once the player can actually see or use them.\nif (!FPL_IS_STUDIO) {\n  const loadModule = (src, marker) => {\n    if (document.querySelector(\`script[\${marker}]\`)) return;\n    const script = document.createElement("script");\n    script.src = new URL(src, document.baseURI).toString();\n    script.async = true;\n    script.setAttribute(marker, "1");\n    document.head.appendChild(script);\n  };\n\n  const loadResultsV2 = () => {\n    if (window.FPL_LEADERBOARD_CONFIG.resultsV2) loadModule("js/results-v2.js", "data-results-v2");\n  };\n  const scheduleResultsV2 = () => {\n    requestAnimationFrame(() => {\n      if (typeof requestIdleCallback === "function") requestIdleCallback(loadResultsV2, { timeout: 1200 });\n      else setTimeout(loadResultsV2, 120);\n    });\n  };\n  const results = document.getElementById("results");\n  if (results && !results.classList.contains("hidden")) scheduleResultsV2();\n  else window.addEventListener("fpl:challenge-completed", scheduleResultsV2, { once: true });\n  window.FPL_LOAD_RESULTS_V2 = loadResultsV2;\n\n  let leaderboardExtrasLoaded = false;\n  const loadLeaderboardExtras = () => {\n    if (leaderboardExtrasLoaded) return;\n    leaderboardExtrasLoaded = true;\n    const live = window.FPL_LEADERBOARD_CONFIG;\n    if (live.enabled && live.teamSheets) loadModule("js/leaderboard-team-view.js", "data-leaderboard-team-view");\n    if (live.enabled && live.rankingRules) loadModule("js/leaderboard-ranking-rules.js", "data-leaderboard-ranking-rules");\n    if (live.enabled && live.allTimeLeaderboard) loadModule("js/leaderboard-all-time.js", "data-leaderboard-all-time");\n    if (live.enabled && live.playerProfile && live.accounts?.enabled) loadModule("js/player-profile.js", "data-player-profile");\n  };\n  window.addEventListener("fpl:leaderboard-visible", loadLeaderboardExtras, { once: true });\n  window.FPL_LOAD_LEADERBOARD_EXTRAS = loadLeaderboardExtras;\n}\n\n// Studio-only publishing enhancement.`,
    'eager secondary live modules'
  );

  source = replaceRegexOnce(
    path,
    source,
    /\n\/\/ Keep the All-Time helper copy[\s\S]*?\n}\s*$/,
    '\n',
    'broad All-Time copy observer'
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// leaderboard-client.js: render the section immediately, but do not fetch or
// poll it until the player scrolls reasonably near it or completes a result.
// ---------------------------------------------------------------------------
{
  const path = 'js/leaderboard-client.js';
  let source = read(path);

  source = replaceOnce(
    path,
    source,
    `  let lastRows = [];\n  let refreshTimer = null;`,
    `  let lastRows = [];\n  let refreshTimer = null;\n  let leaderboardActivated = false;\n  let activationObserver = null;\n  window.FPL_LEADERBOARD_ACTIVE = false;`,
    'leaderboard runtime variables'
  );

  source = replaceOnce(
    path,
    source,
    `    document.getElementById("leaderboardRefresh")?.addEventListener("click",()=>loadLeaderboard({manual:true}));\n    renderSkeleton();\n    enhanceMobileNav();`,
    `    document.getElementById("leaderboardRefresh")?.addEventListener("click",()=>{if(!leaderboardActivated)activateLeaderboard();else loadLeaderboard({manual:true});});\n    renderDeferredState();\n    enhanceMobileNav();`,
    'leaderboard shell initial render'
  );

  source = replaceOnce(
    path,
    source,
    `  function renderSkeleton(){const body=document.getElementById("leaderboardRows");if(!body)return;body.innerHTML=Array.from({length:5},()=>'<tr><td colspan="6"><div class="leaderboard-skeleton"></div></td></tr>').join("");}\n`,
    `  function renderSkeleton(){const body=document.getElementById("leaderboardRows");if(!body)return;body.innerHTML=Array.from({length:5},()=>'<tr><td colspan="6"><div class="leaderboard-skeleton"></div></td></tr>').join("");}\n  function renderDeferredState(){const body=document.getElementById("leaderboardRows");if(!body)return;body.innerHTML='<tr><td class="leaderboard-empty" colspan="6">Standings load automatically when you reach this section.</td></tr>';}\n`,
    'leaderboard skeleton helper'
  );

  source = replaceOnce(
    path,
    source,
    `  function onCompleted(event){const record=event.detail?.record;if(!record||record.official===false||runtime.archiveMode)return;pendingCompletedRecord=record;setState(STATUS.READY);setStatus("XI complete · ready for server verification.");setMessage("Enter or confirm your display name, then submit the result.","info");updateSubmitButton();}\n`,
    `  function onCompleted(event){const record=event.detail?.record;if(!record||record.official===false||runtime.archiveMode)return;pendingCompletedRecord=record;activateLeaderboard();setState(STATUS.READY);setStatus("XI complete · ready for server verification.");setMessage("Enter or confirm your display name, then submit the result.","info");updateSubmitButton();}\n`,
    'challenge completion handler'
  );

  source = replaceOnce(
    path,
    source,
    `      setMessage("");updateSubmitButton();window.dispatchEvent(new CustomEvent("fpl:leaderboard-updated",{detail:{challengeId:challenge.id,total:count,entries:rows,viewer:data.viewer||null}}));`,
    `      setMessage("");updateSubmitButton();const detail={challengeId:challenge.id,total:count,entries:rows,viewer:data.viewer||null};window.FPL_LEADERBOARD_LAST_UPDATE=detail;window.dispatchEvent(new CustomEvent("fpl:leaderboard-updated",{detail}));`,
    'leaderboard update event'
  );

  source = replaceOnce(
    path,
    source,
    `  function startRefreshLoop(){clearInterval(refreshTimer);const seconds=Math.max(15,Number(cfg.refreshSeconds)||60);refreshTimer=setInterval(()=>{if(document.visibilityState==="visible"&&navigator.onLine)loadLeaderboard();},seconds*1000);}\n  function networkChanged(){if(navigator.onLine){setState(STATUS.CONNECTING);setStatus("Connection restored · refreshing leaderboard…");loadLeaderboard({manual:true});}else handleError(new TypeError("Offline"));}\n\n  renderShell(); recoverCompletedRecord(); renderNameState();\n  window.addEventListener("fpl:attempt-started",onAttemptStarted); window.addEventListener("fpl:pick-attempt",onPickAttempt); window.addEventListener("fpl:challenge-completed",onCompleted); window.addEventListener("online",networkChanged); window.addEventListener("offline",networkChanged);\n  window.FPL_LEADERBOARD_REFRESH=()=>loadLeaderboard({manual:true});\n  const saved=readJson(submittedKey());if(saved)showPersonal(saved);updateSubmitButton();loadLeaderboard();startRefreshLoop();`,
    `  function startRefreshLoop(){clearInterval(refreshTimer);const seconds=Math.max(15,Number(cfg.refreshSeconds)||60);refreshTimer=setInterval(()=>{if(leaderboardActivated&&document.visibilityState==="visible"&&navigator.onLine)loadLeaderboard();},seconds*1000);}\n  function activateLeaderboard(){\n    if(leaderboardActivated)return;\n    leaderboardActivated=true;window.FPL_LEADERBOARD_ACTIVE=true;activationObserver?.disconnect();\n    setState(STATUS.CONNECTING);setStatus("Loading today’s verified standings…");renderSkeleton();loadLeaderboard({manual:true});startRefreshLoop();\n    window.dispatchEvent(new CustomEvent("fpl:leaderboard-visible"));\n  }\n  function installLazyActivation(){\n    const panel=document.getElementById("liveLeaderboardPanel");if(!panel)return;\n    if(!(\"IntersectionObserver\" in window)){setTimeout(activateLeaderboard,1200);return;}\n    activationObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))activateLeaderboard();},{rootMargin:"650px 0px"});\n    activationObserver.observe(panel);\n  }\n  function networkChanged(){if(navigator.onLine){if(leaderboardActivated){setState(STATUS.CONNECTING);setStatus("Connection restored · refreshing leaderboard…");loadLeaderboard({manual:true});}else{setState(STATUS.READY,"Standby");setStatus("Leaderboard ready when you reach this section.");}}else handleError(new TypeError("Offline"));}\n\n  renderShell(); recoverCompletedRecord(); renderNameState();\n  window.addEventListener("fpl:attempt-started",onAttemptStarted); window.addEventListener("fpl:pick-attempt",onPickAttempt); window.addEventListener("fpl:challenge-completed",onCompleted); window.addEventListener("online",networkChanged); window.addEventListener("offline",networkChanged);\n  window.FPL_LEADERBOARD_REFRESH=()=>{if(leaderboardActivated)loadLeaderboard({manual:true});};\n  window.FPL_LEADERBOARD_ACTIVATE=activateLeaderboard;\n  const saved=readJson(submittedKey());if(saved)showPersonal(saved);updateSubmitButton();installLazyActivation();\n  if(pendingCompletedRecord||saved){requestAnimationFrame(()=>setTimeout(activateLeaderboard,120));}else{setState(STATUS.READY,"Standby");setStatus("Leaderboard loads when you reach this section.");}`,
    'leaderboard startup/polling block'
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// leaderboard-team-view.js: when lazy-loaded, consume the core client's most
// recent payload instead of forcing a duplicate API refresh.
// ---------------------------------------------------------------------------
{
  const path = 'js/leaderboard-team-view.js';
  let source = read(path);
  source = replaceOnce(
    path,
    source,
    `  addStyles();\n  ensureModal();\n  // If the initial leaderboard response arrived before this enhancement script loaded,\n  // one safe refresh repopulates the event payload with the verified team-sheet fields.\n  setTimeout(() => {\n    enhanceLeaderboard();\n    if (typeof window.FPL_LEADERBOARD_REFRESH === "function") window.FPL_LEADERBOARD_REFRESH();\n  }, 250);`,
    `  addStyles();\n  const cached = window.FPL_LEADERBOARD_LAST_UPDATE;\n  if (cached) {\n    entries = Array.isArray(cached.entries) ? cached.entries : [];\n    viewer = cached.viewer || null;\n    enhanceLeaderboard();\n  }`,
    'team-view eager modal/duplicate refresh'
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// player-profile.js: the full profile is account-only, so guests should never
// download its cache/core modules merely because the browser became idle.
// ---------------------------------------------------------------------------
{
  const path = 'js/player-profile.js';
  let source = read(path);
  source = replaceOnce(path, source, `  let started = false;`, `  let started = false;\n  let scheduled = false;`, 'profile started state');
  source = replaceOnce(
    path,
    source,
    `  function scheduleAfterFirstPaint() {\n    requestAnimationFrame(() => requestAnimationFrame(() => {\n      if (typeof requestIdleCallback === "function") {\n        requestIdleCallback(loadCore, { timeout: 3500 });\n      } else {\n        setTimeout(loadCore, 900);\n      }\n    }));\n  }\n\n  if (document.readyState === "loading") {\n    document.addEventListener("DOMContentLoaded", scheduleAfterFirstPaint, { once: true });\n  } else {\n    scheduleAfterFirstPaint();\n  }\n\n  // If somebody somehow completes the challenge before the idle loader fires, profile sync\n  // becomes useful immediately and should no longer wait for the idle window.\n  window.addEventListener("fpl:challenge-completed", loadCore, { once: true });\n  window.FPL_LOAD_PLAYER_PROFILE_NOW = loadCore;`,
    `  function scheduleAfterFirstPaint() {\n    if (started || scheduled || !window.FPL_ACCOUNT_AUTH?.signedIn) return;\n    scheduled = true;\n    requestAnimationFrame(() => requestAnimationFrame(() => {\n      if (typeof requestIdleCallback === "function") {\n        requestIdleCallback(loadCore, { timeout: 2400 });\n      } else {\n        setTimeout(loadCore, 500);\n      }\n    }));\n  }\n\n  scheduleAfterFirstPaint();\n  window.addEventListener("fpl:account-auth-changed", event => {\n    if (event.detail?.signedIn) scheduleAfterFirstPaint();\n  });\n  window.addEventListener("fpl:challenge-completed", scheduleAfterFirstPaint, { once: true });\n  window.FPL_LOAD_PLAYER_PROFILE_NOW = loadCore;`,
    'unconditional profile idle loader'
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// leaderboard-all-time.js: account-aware copy lives with the component so no
// page-wide MutationObserver is needed just to patch one sentence later.
// ---------------------------------------------------------------------------
{
  const path = 'js/leaderboard-all-time.js';
  let source = read(path);
  source = replaceOnce(
    path,
    source,
    `All-Time identity is currently tied to this browser/device until accounts are added.`,
    `Sign in to sync your verified All-Time record across devices; guest play remains device-based.`,
    'All-Time account helper copy'
  );
  write(path, source);
}

console.log('Live performance pass 2 applied successfully.');
