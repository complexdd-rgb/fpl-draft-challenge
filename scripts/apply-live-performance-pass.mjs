import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  const first = html.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source was not found.`);
  if (html.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: expected source occurs more than once.`);
  html = html.slice(0, first) + after + html.slice(first + before.length);
  console.log(`patched: ${label}`);
}

replaceOnce(
  'live player database',
  '<script src="players.js?v=12.3.0"></script>',
  '<script src="players-live.js?v=1.0.0"></script>'
);

replaceOnce(
  'season row initialisation',
  'const flatSeasons = groupedPlayers.flatMap(player => player.seasons.map(season => ({...season,playerId:player.playerId,name:player.name})));',
  `const playerById = new Map();\nconst recordByKey = new Map();\nconst flatSeasons = [];\nfor (const player of groupedPlayers) {\n  playerById.set(player.playerId, player);\n  for (const season of Array.isArray(player.seasons) ? player.seasons : []) {\n    // Use the existing certified/live row object rather than cloning every season.\n    // Career Context attaches _career to these same objects before the game engine runs.\n    if (season.playerId == null) season.playerId = player.playerId;\n    if (season.name == null) season.name = player.name;\n    flatSeasons.push(season);\n    recordByKey.set(\`${'${player.playerId}'}\\u0000${'${season.season}'}\`, season);\n  }\n}`
);

replaceOnce(
  'indexed player and season lookups',
  'const getPlayer=id=>groupedPlayers.find(p=>p.playerId===id);\nconst getRecord=(playerId,season)=>flatSeasons.find(p=>p.playerId===playerId&&p.season===season);',
  'const getPlayer=id=>playerById.get(id);\nconst getRecord=(playerId,season)=>recordByKey.get(`${playerId}\\u0000${season}`);'
);

replaceOnce(
  'Phase 4.5 desktop refresh loop',
  '  const refresh = () => { renderHero(); renderLivePitch(); renderExtendedStats(); renderAchievements(); const countdown = document.getElementById("phase45HeroCountdown"); if (countdown && runtime.nextScheduledDate && typeof dailyTime.millisecondsUntilUkDate === "function" && typeof dailyTime.formatCountdown === "function" && !runtime.archiveMode) { const remain = dailyTime.millisecondsUntilUkDate(runtime.nextScheduledDate); countdown.textContent = remain > 0 ? dailyTime.formatCountdown(remain) : "Ready"; } };\n  const grid = document.getElementById("grid"); const results = document.getElementById("results"); if (grid) { const observer = new MutationObserver(refresh); observer.observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]}); if (results) observer.observe(results,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]}); }\n  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=formation-1").catch(() => {});\n  refresh(); setInterval(refresh, 1000);',
  `  const updatePhase45Countdown = () => {\n    const countdown = document.getElementById("phase45HeroCountdown");\n    if (countdown && runtime.nextScheduledDate && typeof dailyTime.millisecondsUntilUkDate === "function" && typeof dailyTime.formatCountdown === "function" && !runtime.archiveMode) {\n      const remain = dailyTime.millisecondsUntilUkDate(runtime.nextScheduledDate);\n      countdown.textContent = remain > 0 ? dailyTime.formatCountdown(remain) : "Ready";\n    }\n  };\n  const refresh = () => { renderHero(); renderLivePitch(); renderExtendedStats(); renderAchievements(); updatePhase45Countdown(); };\n  let phase45RefreshQueued = false;\n  const schedulePhase45Refresh = () => {\n    if (phase45RefreshQueued) return;\n    phase45RefreshQueued = true;\n    requestAnimationFrame(() => { phase45RefreshQueued = false; refresh(); });\n  };\n  const grid = document.getElementById("grid");\n  const results = document.getElementById("results");\n  if (grid) {\n    const observer = new MutationObserver(schedulePhase45Refresh);\n    observer.observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});\n    if (results) observer.observe(results,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});\n  }\n  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=formation-1").catch(() => {});\n  refresh();\n  setInterval(() => { if (document.visibilityState === "visible") updatePhase45Countdown(); }, 1000);\n  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") updatePhase45Countdown(); });`
);

// Guardrails: the old hot paths must be gone and the new data/index paths present.
const required = [
  'players-live.js?v=1.0.0',
  'const playerById = new Map();',
  'const recordByKey = new Map();',
  'const schedulePhase45Refresh = () =>',
  'updatePhase45Countdown();'
];
for (const token of required) if (!html.includes(token)) throw new Error(`Missing expected result: ${token}`);
for (const token of [
  'players.js?v=12.3.0',
  'groupedPlayers.flatMap(player => player.seasons.map(season => ({...season,playerId:player.playerId,name:player.name})))',
  'const getPlayer=id=>groupedPlayers.find',
  'refresh(); setInterval(refresh, 1000);'
]) {
  if (html.includes(token)) throw new Error(`Old performance path still present: ${token}`);
}

fs.writeFileSync(path, html);
console.log('Live performance migration completed safely.');
