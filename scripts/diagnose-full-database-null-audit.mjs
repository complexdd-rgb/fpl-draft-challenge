import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../players.js", import.meta.url), "utf8");
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  location: { pathname: "/admin.html" },
  setTimeout,
  clearTimeout
};
window.window = window;
globalThis.document = {
  readyState: "complete",
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  addEventListener() {},
  removeEventListener() {},
  createElement() { return { style: {}, dataset: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }; },
  head: { appendChild() {} },
  body: { appendChild() {} }
};
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
globalThis.Event = class Event { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); } };
vm.runInThisContext(source, { filename: "players.js" });

const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
if (!players.length) throw new Error("FPL_PLAYERS did not load.");

const seasonRows = players.flatMap(player => (player.seasons || []).map(record => ({ player, record })));
const seasons = [...new Set(seasonRows.map(({ record }) => record.season).filter(Boolean))].sort();

const numericFields = [
  "points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves",
  "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice",
  "leaguePosition", "ageAtSeasonStart"
];
const textFields = ["season", "club", "position", "dateOfBirth"];
const booleanFields = ["champions", "topFour", "bottomHalf", "relegated", "promoted"];
const arrayFields = ["managers"];
const canonicalFields = [...textFields, ...numericFields, ...booleanFields, ...arrayFields];

const blank = value => value === null || value === undefined || value === "";
const finite = value => !blank(value) && Number.isFinite(Number(value));
const approvedNullStartingPrice = record => !finite(record.startingPrice)
  && record.pricePromptEligible === false
  && String(record.startingPriceStatus ?? record.source?.startingPriceStatus ?? "").trim().toUpperCase() === "APPROVED NULL";

const missing = Object.fromEntries(canonicalFields.map(field => [field, 0]));
const explicitNull = Object.fromEntries(canonicalFields.map(field => [field, 0]));
const invalid = Object.fromEntries(canonicalFields.map(field => [field, 0]));
const perSeason = Object.fromEntries(seasons.map(season => [season, {
  rows: 0,
  approvedNullStartingPrice: 0,
  missingStartingPriceUnapproved: 0,
  missingFinalPrice: 0,
  missingDob: 0,
  missingAge: 0,
  missingManagers: 0,
  missingLeaguePosition: 0,
  missingCoreNumeric: 0,
  missingOtherStats: 0
}]));

for (const { record } of seasonRows) {
  const bucket = perSeason[record.season] || null;
  if (bucket) bucket.rows += 1;

  for (const field of canonicalFields) {
    const value = record[field];
    if (value === null) explicitNull[field] += 1;
    if (blank(value)) missing[field] += 1;
  }

  for (const field of numericFields) {
    const value = record[field];
    if (!blank(value) && !Number.isFinite(Number(value))) invalid[field] += 1;
  }
  for (const field of textFields) {
    const value = record[field];
    if (!blank(value) && typeof value !== "string") invalid[field] += 1;
  }
  for (const field of booleanFields) {
    const value = record[field];
    if (!blank(value) && typeof value !== "boolean") invalid[field] += 1;
  }
  for (const field of arrayFields) {
    const value = record[field];
    if (!blank(value) && !Array.isArray(value)) invalid[field] += 1;
  }

  if (bucket) {
    if (approvedNullStartingPrice(record)) bucket.approvedNullStartingPrice += 1;
    else if (!finite(record.startingPrice)) bucket.missingStartingPriceUnapproved += 1;
    if (!finite(record.finalPrice)) bucket.missingFinalPrice += 1;
    if (blank(record.dateOfBirth)) bucket.missingDob += 1;
    if (!finite(record.ageAtSeasonStart)) bucket.missingAge += 1;
    if (!Array.isArray(record.managers) || record.managers.length === 0) bucket.missingManagers += 1;
    if (!finite(record.leaguePosition)) bucket.missingLeaguePosition += 1;
    if (["points", "minutes", "goals", "assists"].some(field => !finite(record[field]))) bucket.missingCoreNumeric += 1;
    if (["cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards"].some(field => !finite(record[field]))) bucket.missingOtherStats += 1;
  }
}

const playerFields = ["playerId", "name", "nationality"];
const playerMissing = Object.fromEntries(playerFields.map(field => [field, 0]));
const playerExplicitNull = Object.fromEntries(playerFields.map(field => [field, 0]));
for (const player of players) {
  for (const field of playerFields) {
    const value = player[field];
    if (value === null) playerExplicitNull[field] += 1;
    if (blank(value)) playerMissing[field] += 1;
  }
}

const approvedNullTotal = seasonRows.filter(({ record }) => approvedNullStartingPrice(record)).length;
const unapprovedStartingPriceMissing = seasonRows.filter(({ record }) => !finite(record.startingPrice) && !approvedNullStartingPrice(record)).length;

console.log("FULL DATABASE NULL / MISSING-FIELD AUDIT");
console.log(`Players: ${players.length.toLocaleString("en-GB")}`);
console.log(`Player-season rows: ${seasonRows.length.toLocaleString("en-GB")}`);
console.log(`Seasons: ${seasons.length} (${seasons.join(", ")})`);
console.log("");
console.log("PLAYER-LEVEL MISSING");
for (const field of playerFields) console.log(`${field}: missing=${playerMissing[field]} explicitNull=${playerExplicitNull[field]}`);
console.log("");
console.log("SEASON-FIELD MISSING / NULL / INVALID");
for (const field of canonicalFields) {
  const m = missing[field], n = explicitNull[field], i = invalid[field];
  if (m || n || i) console.log(`${field}: missing=${m} explicitNull=${n} invalidNonBlank=${i}`);
}
console.log("");
console.log(`Approved-null starting prices: ${approvedNullTotal}`);
console.log(`Unapproved/non-numeric missing starting prices: ${unapprovedStartingPriceMissing}`);
console.log(`Missing/non-numeric final prices: ${seasonRows.filter(({ record }) => !finite(record.finalPrice)).length}`);
console.log("");
console.log("PER-SEASON SUMMARY");
for (const season of seasons) console.log(`${season}: ${JSON.stringify(perSeason[season])}`);

const structuralMissing = seasonRows.filter(({ record }) =>
  !record.season || !record.club || !["GK", "DEF", "MID", "FWD"].includes(record.position)
  || ["points", "minutes", "goals", "assists"].some(field => !finite(record[field]))
  || !record.dateOfBirth || !finite(record.ageAtSeasonStart)
  || !finite(record.leaguePosition)
  || !Array.isArray(record.managers) || record.managers.length === 0
  || (!finite(record.startingPrice) && !approvedNullStartingPrice(record))
).length;
console.log("");
console.log(`Structural/required rows with at least one unresolved missing field: ${structuralMissing}`);
