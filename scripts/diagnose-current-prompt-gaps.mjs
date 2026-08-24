import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../players.js", import.meta.url), "utf8");
globalThis.window = {
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  location: { pathname: "/admin.html" }, setTimeout, clearTimeout
};
window.window = window;
globalThis.document = {
  readyState: "complete", querySelector() { return null; }, querySelectorAll() { return []; },
  getElementById() { return null; }, addEventListener() {}, removeEventListener() {},
  createElement() { return { style: {}, dataset: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }; },
  head: { appendChild() {} }, body: { appendChild() {} }
};
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
globalThis.Event = class Event { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); } };
vm.runInThisContext(source, { filename: "players.js" });

const blank = value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value));
const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
const rows = players.flatMap(player => (player.seasons || []).map(record => ({ player, record })));
const seasons = [...new Set(rows.map(x => x.record.season))].sort();

console.log("CURRENT PROMPT GAP MATRIX");
for (const season of seasons) {
  const sr = rows.filter(x => x.record.season === season);
  const yellow = sr.filter(x => blank(x.record.yellowCards));
  const saves = sr.filter(x => blank(x.record.saves));
  if (yellow.length || saves.length) {
    console.log(`${season}: yellowCards=${yellow.length}, saves=${saves.length}`);
  }
}

console.log("\nMISSING SAVES ROWS");
for (const { player, record } of rows.filter(x => blank(x.record.saves))) {
  console.log(`${record.season}\t${player.playerId}\t${player.name}\t${record.club}\t${record.position}\tminutes=${record.minutes}`);
}

console.log("\nYELLOW CARD GAP SAMPLE / COUNTS BY CLUB");
for (const season of seasons) {
  const yellow = rows.filter(x => x.record.season === season && blank(x.record.yellowCards));
  if (!yellow.length) continue;
  const clubs = new Map();
  for (const { record } of yellow) clubs.set(record.club, (clubs.get(record.club) || 0) + 1);
  console.log(`${season}: ${yellow.length} rows`);
  console.log([...clubs.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([club,count]) => `${club}=${count}`).join(" | "));
  for (const { player, record } of yellow.slice(0, 20)) console.log(`  ${player.playerId}\t${player.name}\t${record.club}\t${record.position}\tminutes=${record.minutes}`);
}
