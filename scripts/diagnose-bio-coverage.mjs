import fs from "node:fs";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
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

vm.runInThisContext(read("players.js"), { filename: "players.js" });
vm.runInThisContext(read("nationality-enrichment.js"), { filename: "nationality-enrichment.js" });

const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
const eligible = players.filter(player => (player.seasons || []).some(record => Number(record.minutes) > 0));
const blank = value => value === null || value === undefined || String(value).trim() === "";
const countMissing = (items, getter) => items.filter(item => blank(getter(item))).length;

console.log("BIO METADATA COVERAGE");
console.log(`All player objects: ${players.length}`);
console.log(`Positive-minute players: ${eligible.length}`);
console.log(`All players missing bio.dateOfBirth: ${countMissing(players, p => p.bio?.dateOfBirth)}`);
console.log(`Positive-minute players missing bio.dateOfBirth: ${countMissing(eligible, p => p.bio?.dateOfBirth)}`);
console.log(`All players missing effective bio.nationality: ${countMissing(players, p => p.bio?.nationality)}`);
console.log(`Positive-minute players missing effective bio.nationality: ${countMissing(eligible, p => p.bio?.nationality)}`);
console.log(`Nationality enrichment applied=${window.FPL_NATIONALITY_ENRICHMENT?.applied ?? "n/a"} mapped=${window.FPL_NATIONALITY_ENRICHMENT?.mapped ?? "n/a"}`);
console.log(`Nationality final residue applied=${window.FPL_NATIONALITY_FINAL_RESIDUE?.applied ?? "n/a"} mapped=${window.FPL_NATIONALITY_FINAL_RESIDUE?.mapped ?? "n/a"}`);
