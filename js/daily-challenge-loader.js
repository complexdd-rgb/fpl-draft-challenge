/* FPL Daily Challenge — UK challenge calendar loader with Supabase schedule priority. */
(() => {
  "use strict";

  const DEFAULT_TIMEZONE = "Europe/London";
  const SUPABASE_CHALLENGE_ENDPOINT = "https://sacfscnhvmfvbazbfgji.supabase.co/functions/v1/daily-challenge-public";
  const manifest = window.FPL_CHALLENGE_MANIFEST || null;
  const timezone = manifest?.timezone || DEFAULT_TIMEZONE;

  function zonedParts(date = new Date(), includeTime = false) {
    const options = { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" };
    if (includeTime) Object.assign(options, {hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
    return Object.fromEntries(new Intl.DateTimeFormat("en-GB", options).formatToParts(date)
      .filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  }

  function ukDateString(date = new Date()) {
    const parts = zonedParts(date, false);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function addCalendarDays(dateString, days) {
    const [year, month, day] = String(dateString).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return [date.getUTCFullYear(), String(date.getUTCMonth()+1).padStart(2,"0"), String(date.getUTCDate()).padStart(2,"0")].join("-");
  }

  function timezoneOffsetMs(epochMs) {
    const date = new Date(epochMs);
    const parts = zonedParts(date, true);
    const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    return representedAsUtc - Math.floor(epochMs/1000)*1000;
  }

  function ukMidnightEpoch(dateString) {
    const [year, month, day] = String(dateString).split("-").map(Number);
    const targetAsUtc = Date.UTC(year, month-1, day, 0, 0, 0);
    let guess = targetAsUtc;
    for (let i=0; i<3; i+=1) guess = targetAsUtc - timezoneOffsetMs(guess);
    return guess;
  }

  function millisecondsUntilUkDate(dateString, now = Date.now()) { return Math.max(0, ukMidnightEpoch(dateString)-now); }
  function millisecondsUntilNextUkMidnight(now = Date.now()) {
    const today = ukDateString(new Date(now));
    return millisecondsUntilUkDate(addCalendarDays(today, 1), now);
  }
  function formatCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(milliseconds)/1000));
    const days = Math.floor(totalSeconds/86400), hours = Math.floor((totalSeconds%86400)/3600), minutes = Math.floor((totalSeconds%3600)/60), seconds = totalSeconds%60;
    const clock = [hours,minutes,seconds].map(v=>String(v).padStart(2,"0")).join(":");
    return days>0 ? `${days}d ${clock}` : clock;
  }

  window.FPL_DAILY_TIME = {timezone, ukDateString, addCalendarDays, ukMidnightEpoch, millisecondsUntilUkDate, millisecondsUntilNextUkMidnight, formatCountdown};

  const officialDate = ukDateString();
  const entries = Array.isArray(manifest?.challenges)
    ? manifest.challenges.filter(entry => entry && /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date||"")) && entry.path)
        .slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)))
    : [];

  let archiveRequest = null;
  try {
    const candidate = new URLSearchParams(window.location.search).get("challenge");
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(candidate||"")) && candidate <= officialDate) archiveRequest = candidate;
  } catch {}

  const requestedDate = archiveRequest || officialDate;
  const exact = entries.find(entry => entry.date === requestedDate) || null;
  const past = entries.filter(entry => entry.date <= requestedDate);
  const selected = exact || past[past.length-1] || null;
  const future = archiveRequest ? null : (selected ? entries.find(entry => entry.date > selected.date) || null : entries.find(entry => entry.date >= officialDate) || null);
  const archiveMode = Boolean(archiveRequest && exact && exact.date < officialDate);

  const selectedPath = selected?.path || manifest?.fallbackPath || "todays-challenge.js";
  window.FPL_CHALLENGE_RUNTIME = {
    timezone,
    officialDate,
    requestedDate,
    selectedDate: selected?.date || null,
    selectedPath,
    selectedId: selected?.id || null,
    exactMatch: Boolean(exact),
    archiveMode,
    archiveRequest,
    selectionMode: archiveMode ? "archive-date" : exact ? "exact-date" : selected ? "latest-published" : "legacy-fallback",
    nextScheduledDate: future?.date || null,
    nextScheduledPath: future?.path || null,
    manifestVersion: manifest?.version ?? null,
    scheduleSource: "github-fallback"
  };

  const cacheToken = `${requestedDate}-${manifest?.version ?? 0}-${Date.now()}`;
  window.FPL_SUPABASE_CHALLENGE_LOADED = false;
  window.FPL_CHALLENGE_FALLBACK = { selectedPath, cacheToken };

  // Supabase-published dates take priority. The second script runs only after the remote
  // lookup finishes and loads the existing GitHub calendar when no server schedule exists
  // or the network is unavailable.
  const remoteUrl = new URL(SUPABASE_CHALLENGE_ENDPOINT);
  remoteUrl.searchParams.set("date", requestedDate);
  remoteUrl.searchParams.set("officialDate", officialDate);
  remoteUrl.searchParams.set("archive", archiveRequest ? "1" : "0");
  remoteUrl.searchParams.set("v", cacheToken);
  document.write(`<script src="${remoteUrl.toString().replace(/&/g,"&amp;")}"><\/script>`);
  document.write(`<script src="js/daily-challenge-fallback.js?v=${encodeURIComponent(cacheToken)}"><\/script>`);

  if (!archiveRequest) {
    const dateAtLoad = officialDate;
    window.addEventListener("load", () => {
      const rolloverTimer = window.setInterval(() => {
        if (ukDateString() !== dateAtLoad) {
          window.clearInterval(rolloverTimer);
          window.location.href = window.location.pathname;
        }
      }, 1000);
    }, {once:true});
  }
})();
