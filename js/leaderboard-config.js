/* FPL Draft Challenge — Phase 5A.5 leaderboard configuration.
   Supabase browser connection configured for production.
   Only the browser-safe publishable key belongs here; never add secret/service-role keys. */
window.FPL_LEADERBOARD_CONFIG = Object.freeze({
  enabled: true,
  supabaseUrl: "https://sacfscnhvmfvbazbfgji.supabase.co",
  publishableKey: "sb_publishable_5ULcqgRQoeWai65gFKm-jA_ORhrSysW",
  functions: Object.freeze({
    start: "leaderboard-start",
    pick: "leaderboard-pick",
    finish: "leaderboard-finish",
    list: "leaderboard-list",
    allTime: "leaderboard-all-time",
    profile: "leaderboard-profile"
  }),
  topLimit: 20,
  allTimeLimit: 50,
  displayNameMin: 2,
  displayNameMax: 20,
  refreshSeconds: 60,
  realtimeReady: true,
  teamSheets: true,
  rankingRules: true,
  allTimeLeaderboard: true,
  playerProfile: true,
  resultsV2: true,
  accounts: Object.freeze({
    enabled: true,
    provider: "email-magic-link",
    redirectUrl: "https://complexdd-rgb.github.io/fpl-draft-challenge/"
  }),
  dailyPublishing: Object.freeze({
    enabled: true,
    function: "daily-challenge-publish"
  }),
  mockMode: false
});

const FPL_IS_STUDIO = /\/admin(?:\.html)?$/i.test(window.location.pathname)
  || Boolean(document.querySelector("main.studio-shell"));

// Two legacy prompt-tool modules still register their initialisers against window.load.
// When their bundle is lazy-loaded after the real load event, replay one load event after
// that bundle arrives. Existing once:true listeners have already been removed, so this
// wakes only the newly-added Prompt Studio listeners without re-running the live app.
if (FPL_IS_STUDIO) {
  const latePromptObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLScriptElement) || !/\/js\/admin-import-tools-base\.js(?:\?|$)/.test(node.src)) continue;
        latePromptObserver.disconnect();
        node.addEventListener("load", () => {
          if (document.readyState === "complete") {
            queueMicrotask(() => window.dispatchEvent(new Event("load")));
          }
        }, { once: true });
        return;
      }
    }
  });
  latePromptObserver.observe(document.head, { childList: true });
}

// When accounts are enabled, install this tiny bridge synchronously before the static
// leaderboard client runs. Studio also keeps this bridge because direct challenge
// publishing uses the signed-in Supabase session without exposing privileged keys.
if (window.FPL_LEADERBOARD_CONFIG.enabled && window.FPL_LEADERBOARD_CONFIG.accounts?.enabled && !window.FPL_ACCOUNT_AUTH) {
  let ready = false;
  let session = null;
  let resolveReady;
  const readyPromise = new Promise(resolve => { resolveReady = resolve; });
  window.FPL_ACCOUNT_AUTH = {
    client: null,
    signedIn: false,
    _setSession(nextSession) {
      session = nextSession || null;
      this.signedIn = Boolean(session);
    },
    _markReady() { if (!ready) { ready = true; resolveReady?.(); } },
    async getAccessToken() {
      if (!ready) await Promise.race([readyPromise, new Promise(resolve => setTimeout(resolve, 1500))]);
      return session?.access_token || "";
    }
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = undefined) => {
    let url = "";
    try { url = input instanceof Request ? input.url : String(input); } catch {}
    const functionPrefix = `${String(window.FPL_LEADERBOARD_CONFIG.supabaseUrl).replace(/\/$/, "")}/functions/v1/leaderboard-`;
    if (!url.startsWith(functionPrefix)) return nativeFetch(input, init);

    const token = await window.FPL_ACCOUNT_AUTH.getAccessToken();
    if (!token) return nativeFetch(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set("Authorization", `Bearer ${token}`);
    return nativeFetch(input, { ...(init || {}), headers });
  };

  const account = document.createElement("script");
  account.src = new URL("js/leaderboard-account.js", document.baseURI).toString();
  account.async = true;
  account.dataset.leaderboardAccount = "1";
  account.onerror = () => window.FPL_ACCOUNT_AUTH?._markReady?.();
  document.head.appendChild(account);
}

// Live-game presentation modules are deliberately skipped in Challenge Studio. They have
// no admin DOM to enhance and previously created unnecessary network/parse work on every
// Studio visit.
if (!FPL_IS_STUDIO && !document.querySelector('script[data-ui-cleanup]')) {
  const cleanup = document.createElement("script");
  cleanup.src = new URL("js/ui-cleanup.js", document.baseURI).toString();
  cleanup.async = true;
  cleanup.dataset.uiCleanup = "1";
  document.head.appendChild(cleanup);
}

// Secondary live-game presentation is intentionally deferred. The core challenge and
// verified-attempt bridge stay available immediately, while results/leaderboard extras only
// download once the player can actually see or use them.
if (!FPL_IS_STUDIO) {
  const loadModule = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = true;
    script.setAttribute(marker, "1");
    document.head.appendChild(script);
  };

  const loadResultsV2 = () => {
    if (!window.FPL_LEADERBOARD_CONFIG.resultsV2) return;
    loadModule("js/results-v2.js", "data-results-v2");
    loadModule("js/results-polish-v3.js", "data-results-polish-v3");
  };
  const scheduleResultsV2 = () => {
    requestAnimationFrame(() => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(loadResultsV2, { timeout: 1200 });
      else setTimeout(loadResultsV2, 120);
    });
  };
  const results = document.getElementById("results");
  if (results && !results.classList.contains("hidden")) scheduleResultsV2();
  else window.addEventListener("fpl:challenge-completed", scheduleResultsV2, { once: true });
  window.FPL_LOAD_RESULTS_V2 = loadResultsV2;

  let leaderboardExtrasLoaded = false;
  const loadLeaderboardExtras = () => {
    if (leaderboardExtrasLoaded) return;
    leaderboardExtrasLoaded = true;
    const live = window.FPL_LEADERBOARD_CONFIG;
    if (live.enabled && live.teamSheets) loadModule("js/leaderboard-team-view.js", "data-leaderboard-team-view");
    if (live.enabled && live.rankingRules) loadModule("js/leaderboard-ranking-rules.js", "data-leaderboard-ranking-rules");
    if (live.enabled && live.allTimeLeaderboard) loadModule("js/leaderboard-all-time.js", "data-leaderboard-all-time");
    if (live.enabled && live.playerProfile && live.accounts?.enabled) loadModule("js/player-profile.js", "data-player-profile");
  };
  window.addEventListener("fpl:leaderboard-visible", loadLeaderboardExtras, { once: true });
  window.FPL_LOAD_LEADERBOARD_EXTRAS = loadLeaderboardExtras;
}

// Studio-only publishing enhancement. It reuses the validated seven-day ZIP package,
// sends the public challenge source plus private verifiers to Supabase, and never exposes
// service-role credentials in the browser.
if (window.FPL_LEADERBOARD_CONFIG.dailyPublishing?.enabled && document.getElementById("downloadWeekBtn") && !document.querySelector('script[data-admin-daily-publish]')) {
  const publisher = document.createElement("script");
  publisher.src = new URL("js/admin-daily-publish.js", document.baseURI).toString();
  publisher.async = true;
  publisher.dataset.adminDailyPublish = "1";
  document.head.appendChild(publisher);
}

// Studio finishing controls are admin-only. They aggregate existing health/certification
// state and never run an expensive audit or certification automatically.
if (FPL_IS_STUDIO && !document.querySelector('script[data-admin-studio-finish]')) {
  const finish = document.createElement("script");
  finish.src = new URL("js/admin-studio-finish.js?v=1.0.0", document.baseURI).toString();
  finish.async = true;
  finish.dataset.adminStudioFinish = "1";
  document.head.appendChild(finish);
}

// Relationship wording helper: career-overlap means same Premier League season(s), not
// teammates. Keep the rule unchanged while making Prompt Studio wording unambiguous.
if (FPL_IS_STUDIO && !document.querySelector('script[data-career-overlap-wording]')) {
  const overlapWording = document.createElement("script");
  overlapWording.src = new URL("js/career-overlap-wording.js?v=1.0.0", document.baseURI).toString();
  overlapWording.async = true;
  overlapWording.dataset.careerOverlapWording = "1";
  document.head.appendChild(overlapWording);
}

// Prompt-library additions imported from the latest Studio export (14 Aug 2026).
// Append only missing IDs so a stale browser export can never overwrite newer repository prompts.
if (FPL_IS_STUDIO && Array.isArray(window.FPL_PROMPT_LIBRARY)) {
  const promptAdditions20260814 = [
    {
      id: "auto_fwd_teammate_matthew_lowton_points_100_excluding_christian_benteke",
      position: "FWD",
      label: "Forward who played in the same Premier League season as a teammate of Matthew Lowton and scored 100+ FPL points — excluding Christian Benteke",
      fail: "That forward must play for the same club in the same Premier League season as Matthew Lowton and score at least 100 FPL points in that season. Excluding Christian Benteke.",
      difficulty: "hard",
      tags: ["auto-generated","teammate","relationship","club-season","points","anti-meta","excludes-top"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "source",
            "source": "p => ((p => ((p => (p.playerId !== \"matthew-lowton\" && Number(p.minutes) > 0 && [\"2012/13|Aston Villa\",\"2013/14|Aston Villa\",\"2014/15|Aston Villa\",\"2016/17|Burnley\",\"2017/18|Burnley\",\"2018/19|Burnley\",\"2019/20|Burnley\",\"2020/21|Burnley\",\"2021/22|Burnley\"].includes(String(p.season || \"\") + \"|\" + String(p.club || \"\"))))(p) && Number(p.points) >= 100))(p) && ![\"christian-benteke\"].includes(p.playerId))"
      },
      test: p => ((p => ((p => (p.playerId !== "matthew-lowton" && Number(p.minutes) > 0 && ["2012/13|Aston Villa","2013/14|Aston Villa","2014/15|Aston Villa","2016/17|Burnley","2017/18|Burnley","2018/19|Burnley","2019/20|Burnley","2020/21|Burnley","2021/22|Burnley"].includes(String(p.season || "") + "|" + String(p.club || ""))))(p) && Number(p.points) >= 100))(p) && !["christian-benteke"].includes(p.playerId))
    },
    {
      id: "auto_def_season_2013_14_points_50_excluding_seamus_coleman",
      position: "DEF",
      label: "Defender with 50+ FPL points in the 2013/14 season — excluding Séamus Coleman",
      fail: "That defender must score at least 50 FPL points in the 2013/14 season. Excluding Séamus Coleman.",
      difficulty: "easy",
      tags: ["auto-generated","season-rule","season-exact","points","anti-meta","excludes-top"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "source",
            "source": "p => ((p => (String(p.season || \"\") === \"2013/14\" && (Number.isFinite(p.points) && p.points >= 50) && (Number.isFinite(p.minutes) && p.minutes > 0)))(p) && ![\"seamus-coleman\"].includes(p.playerId))"
      },
      test: p => ((p => (String(p.season || "") === "2013/14" && (Number.isFinite(p.points) && p.points >= 50) && (Number.isFinite(p.minutes) && p.minutes > 0)))(p) && !["seamus-coleman"].includes(p.playerId))
    },
    {
      id: "auto_gk_assist_points_50",
      position: "GK",
      label: "Goalkeeper with an assist and at least 50 FPL points",
      fail: "That goalkeeper season must include an assist and at least 50 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","assist","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 1,
                        "value2": 0
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 50,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.assists) && p.assists >= 1) && (Number.isFinite(p.points) && p.points >= 50))
    },
    {
      id: "auto_def_mark_hughes_minutes_2500",
      position: "DEF",
      label: "Defender managed by Mark Hughes who played 2,500+ minutes",
      fail: "That defender season must have been managed by Mark Hughes and include at least 2,500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Mark Hughes",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Mark Hughes".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 2500))
    },
    {
      id: "auto_mid_first_g_points",
      position: "MID",
      label: "Midfielder whose first name starts with G and who scored at least 60 FPL points",
      fail: "That midfielder's first name must start with G and the season must score at least 60 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","name-rule","first-name","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "firstName",
                        "operator": "startsWith",
                        "value": "G",
                        "value2": ""
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 60,
                        "value2": 0
                  }
            ]
      },
      test: p => {
      const __rawName = String(p.name || p.playerName || "").trim();
      const __normaliseName = value => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d")
        .replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe")
        .replace(/’/g, "'")
        .replace(/[^a-z0-9'\-]+/g, " ")
        .trim();
      const __fullName = __normaliseName(__rawName);
      const __nameTokens = __fullName.split(/\s+/).filter(Boolean);
      const __firstName = __nameTokens[0] || "";
      const __surnameParticles = new Set(["al", "ap", "bin", "bint", "da", "das", "de", "del", "della", "den", "der", "di", "dos", "du", "el", "la", "le", "van", "von", "y"]);
      let __surnameStart = Math.max(0, __nameTokens.length - 1);
      while (__surnameStart > 0 && __surnameParticles.has(__nameTokens[__surnameStart - 1])) __surnameStart -= 1;
      const __surname = __nameTokens.slice(__surnameStart).join(" ");
      const __firstInitial = __firstName.charAt(0);
      const __surnameInitial = __surname.charAt(0);
      const __letterCount = value => String(value || "").replace(/[^a-z0-9]/g, "").length;
      return (__firstName.startsWith("g") && (Number.isFinite(p.points) && p.points >= 60));
    }
    }
  ];
  const existingPromptIds = new Set(window.FPL_PROMPT_LIBRARY.map(prompt => String(prompt?.id || "")));
  for (const prompt of promptAdditions20260814) {
    if (!prompt?.id || existingPromptIds.has(prompt.id)) continue;
    prompt._studioBuiltIn = false;
    prompt._studioCustom = true;
    window.FPL_PROMPT_LIBRARY.push(prompt);
    existingPromptIds.add(prompt.id);
  }
}
