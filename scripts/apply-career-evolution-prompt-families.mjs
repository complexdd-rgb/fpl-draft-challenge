import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, source, updated) => {
  if (source !== updated) {
    fs.writeFileSync(path, updated);
    console.log('Updated ' + path);
  }
};
const requireOnce = (source, token, label) => {
  const count = source.split(token).length - 1;
  if (count !== 1) throw new Error(`${label} count was ${count}, expected 1.`);
};

// Extend the career context with reusable evolution facts that are available in Studio and live play.
{
  const path = 'js/career-context.js';
  const source = read(path);
  let updated = source
    .replace('/* FPL career relationship context · v1.4.5', '/* FPL career relationship context · v1.5.0')
    .replace('    version: "1.4.5",', '    version: "1.5.0",');

  if (!updated.includes('window.FPL_CAREER_EVOLUTION_CONTEXT')) {
    const marker = '  for (const player of players) {\n    if (!player || player.playerId == null) continue;\n    const summary = summariesByKey.get(String(player.playerId))?.publicSummary;';
    requireOnce(updated, marker, 'career attachment marker');
    const block = String.raw`
  const careerEvolutionByKey = new Map();
  const sourcePlayerByKey = new Map(players.filter(Boolean).map(player => [String(player.playerId), player]));
  const knownNumber = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const tableBand = value => {
    const position = Number(value);
    if (!Number.isFinite(position)) return "";
    if (position <= 4) return "1-4";
    if (position <= 8) return "5-8";
    if (position <= 12) return "9-12";
    if (position <= 17) return "13-17";
    return "18-20";
  };
  const maxConsecutive = (sequence, predicate) => {
    let best = 0, run = 0, previousYear = null;
    for (const row of sequence) {
      const qualifies = Boolean(predicate(row));
      if (!qualifies) run = 0;
      else run = previousYear != null && row.year === previousYear + 1 ? run + 1 : 1;
      best = Math.max(best, run);
      previousYear = row.year;
    }
    return best;
  };

  for (const player of players) {
    if (!player || player.playerId == null) continue;
    const positive = (Array.isArray(player.seasons) ? player.seasons : [])
      .filter(isPositiveSeason)
      .map(record => ({ record, year: seasonStart(record.season), clubKey: normalise(record.club), position: String(record.position || "") }))
      .filter(row => Number.isFinite(row.year))
      .sort((a, b) => a.year - b.year);

    const byYear = new Map();
    for (const row of positive) {
      if (!byYear.has(row.year)) byYear.set(row.year, {
        year: row.year,
        clubs: new Set(), positions: new Set(), managers: new Set(),
        minutes: 0, goals: 0, goalsKnown: false, points: 0, pointsKnown: false
      });
      const year = byYear.get(row.year);
      if (row.clubKey) year.clubs.add(row.clubKey);
      if (row.position) year.positions.add(row.position);
      year.minutes += Number(row.record.minutes) || 0;
      if (knownNumber(row.record.goals)) { year.goals += Number(row.record.goals); year.goalsKnown = true; }
      if (knownNumber(row.record.points)) { year.points += Number(row.record.points); year.pointsKnown = true; }
      for (const manager of Array.isArray(row.record.managers) ? row.record.managers : []) {
        const key = normalise(manager);
        if (key) year.managers.add(key);
      }
    }
    const sequence = [...byYear.values()].sort((a, b) => a.year - b.year);
    const positions = new Set(positive.map(row => row.position).filter(Boolean));
    const tableBands = new Set(positive.map(row => tableBand(row.record.leaguePosition)).filter(Boolean));
    const managerClubs = new Map();
    for (const row of positive) {
      if (!row.clubKey) continue;
      for (const manager of Array.isArray(row.record.managers) ? row.record.managers : []) {
        const key = normalise(manager);
        if (!key) continue;
        if (!managerClubs.has(key)) managerClubs.set(key, new Set());
        managerClubs.get(key).add(row.clubKey);
      }
    }

    let maxPointsGain = -Infinity;
    let maxGoalsGain = -Infinity;
    let maxMinutesGain = -Infinity;
    let maxClubSwitchPointsGain = -Infinity;
    let maxClubSwitchGoalsGain = -Infinity;
    let bounceBack120After70 = false;
    let bounceBack2500After1500 = false;
    let midToFwd = false, defToMid = false, fwdToMid = false, midToDef = false;

    for (let index = 1; index < sequence.length; index += 1) {
      const previous = sequence[index - 1];
      const current = sequence[index];
      if (current.year !== previous.year + 1) continue;
      if (previous.pointsKnown && current.pointsKnown) {
        const gain = current.points - previous.points;
        maxPointsGain = Math.max(maxPointsGain, gain);
        if (previous.points < 70 && current.points >= 120) bounceBack120After70 = true;
      }
      if (previous.goalsKnown && current.goalsKnown) maxGoalsGain = Math.max(maxGoalsGain, current.goals - previous.goals);
      maxMinutesGain = Math.max(maxMinutesGain, current.minutes - previous.minutes);
      if (previous.minutes < 1500 && current.minutes >= 2500) bounceBack2500After1500 = true;

      const sharedClub = [...previous.clubs].some(club => current.clubs.has(club));
      const switchedClub = previous.clubs.size > 0 && current.clubs.size > 0 && !sharedClub;
      if (switchedClub && previous.pointsKnown && current.pointsKnown) maxClubSwitchPointsGain = Math.max(maxClubSwitchPointsGain, current.points - previous.points);
      if (switchedClub && previous.goalsKnown && current.goalsKnown) maxClubSwitchGoalsGain = Math.max(maxClubSwitchGoalsGain, current.goals - previous.goals);

      if (previous.positions.has('MID') && current.positions.has('FWD')) midToFwd = true;
      if (previous.positions.has('DEF') && current.positions.has('MID')) defToMid = true;
      if (previous.positions.has('FWD') && current.positions.has('MID')) fwdToMid = true;
      if (previous.positions.has('MID') && current.positions.has('DEF')) midToDef = true;
    }

    const evolution = Object.freeze({
      playerId: player.playerId,
      positionCount: positions.size,
      positions: freezeArray(positions),
      changedPosition: positions.size >= 2,
      midToFwd, defToMid, fwdToMid, midToDef,
      maxPointsGain: Number.isFinite(maxPointsGain) ? maxPointsGain : null,
      maxGoalsGain: Number.isFinite(maxGoalsGain) ? maxGoalsGain : null,
      maxMinutesGain: Number.isFinite(maxMinutesGain) ? maxMinutesGain : null,
      maxClubSwitchPointsGain: Number.isFinite(maxClubSwitchPointsGain) ? maxClubSwitchPointsGain : null,
      maxClubSwitchGoalsGain: Number.isFinite(maxClubSwitchGoalsGain) ? maxClubSwitchGoalsGain : null,
      bounceBack120After70,
      bounceBack2500After1500,
      maxConsecutive2000Minutes: maxConsecutive(sequence, row => row.minutes >= 2000),
      maxConsecutive100Points: maxConsecutive(sequence, row => row.pointsKnown && row.points >= 100),
      maxConsecutiveScoringSeasons: maxConsecutive(sequence, row => row.goalsKnown && row.goals >= 1),
      maxConsecutive8Goals: maxConsecutive(sequence, row => row.goalsKnown && row.goals >= 8),
      everPromotedClub: positive.some(row => row.record.promoted === true),
      everRelegatedClub: positive.some(row => row.record.relegated === true),
      everChampion: positive.some(row => row.record.champions === true),
      everTopFour: positive.some(row => row.record.topFour === true),
      everBottomHalf: positive.some(row => row.record.bottomHalf === true),
      tableBandCount: tableBands.size,
      tableBands: freezeArray(tableBands),
      sameManagerDifferentClubs: [...managerClubs.values()].some(clubs => clubs.size >= 2),
      maxClubsWithSameManager: Math.max(0, ...[...managerClubs.values()].map(clubs => clubs.size))
    });
    careerEvolutionByKey.set(String(player.playerId), evolution);
    for (const record of Array.isArray(player.seasons) ? player.seasons : []) {
      try { Object.defineProperty(record, '_careerEvolution', { value: evolution, configurable: true, enumerable: true, writable: false }); }
      catch (_) { record._careerEvolution = evolution; }
    }
  }

  window.FPL_CAREER_EVOLUTION_CONTEXT = Object.freeze({
    version: '1.0.0',
    getPlayer: playerId => careerEvolutionByKey.get(String(playerId)) || null,
    nationalityForPlayer: playerId => String(sourcePlayerByKey.get(String(playerId))?.bio?.nationality || '').trim()
  });

`;
    updated = updated.replace(marker, block + marker);
  }
  write(path, source, updated);
}

// Add Career Evolution as a checked-by-default source in the main generator.
{
  const path = 'admin.html';
  const source = read(path);
  let updated = source;
  const nationality = '          <label class="check-label"><input id="factoryIncludeNationalityFamily" type="checkbox" checked> Include Nationality Family (nationality + stats)</label>';
  const evolution = '          <label class="check-label"><input id="factoryIncludeCareerEvolutionFamilies" type="checkbox" checked> Include Career Evolution (change, streak, position, status, nationality-career + manager journeys)</label>';
  if (!updated.includes(evolution)) {
    requireOnce(updated, nationality, 'Nationality Family checkbox');
    updated = updated.replace(nationality, nationality + '\n' + evolution);
  }
  updated = updated.replace(/js\/career-context\.js\?v=[^"]+/g, 'js/career-context.js?v=1.5.0');
  write(path, source, updated);
}

// Cache-bust the live page too, because saved Career Evolution prompts rely on _careerEvolution.
{
  const path = 'index.html';
  const source = read(path);
  const updated = source.replace(/js\/career-context\.js\?v=[^"]+/g, 'js/career-context.js?v=1.5.0');
  write(path, source, updated);
}

{
  const path = 'js/admin-import-tools-base.js';
  const source = read(path);
  let updated = source;
  updated = updated.replace(
    '      includeNationalityFamily: document.querySelector("#factoryIncludeNationalityFamily"),',
    '      includeNationalityFamily: document.querySelector("#factoryIncludeNationalityFamily"),\n      includeCareerEvolutionFamilies: document.querySelector("#factoryIncludeCareerEvolutionFamilies"),'
  );
  updated = updated.replace(
    '    const includeNationalityFamily = elements.includeNationalityFamily?.checked !== false;',
    '    const includeNationalityFamily = elements.includeNationalityFamily?.checked !== false;\n    const includeCareerEvolutionFamilies = elements.includeCareerEvolutionFamilies?.checked !== false;'
  );
  updated = updated.replace(
    '    if (includeNationalityFamily && !window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Nationality Family");',
    '    if (includeNationalityFamily && !window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Nationality Family");\n    if (includeCareerEvolutionFamilies && !window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Career Evolution");'
  );
  updated = updated.replace(
    '    if (!window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-nationality-family-generator.js?v=1.1.1", "FPL_NATIONALITY_FAMILY_GENERATOR"]);',
    '    if (!window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-nationality-family-generator.js?v=1.1.1", "FPL_NATIONALITY_FAMILY_GENERATOR"]);\n    if (!window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-career-evolution-family-generator.js?v=1.0.0", "FPL_CAREER_EVOLUTION_FAMILY_GENERATOR"]);'
  );
  updated = updated.replace(
    'includeQualityFamilies, includeNationalityFamily }) {',
    'includeQualityFamilies, includeNationalityFamily, includeCareerEvolutionFamilies }) {'
  );
  updated = updated.replace(
    '    if (includeNationalityFamily && window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_NATIONALITY_FAMILY_GENERATOR);',
    '    if (includeNationalityFamily && window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_NATIONALITY_FAMILY_GENERATOR);\n    if (includeCareerEvolutionFamilies && window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR);'
  );
  updated = updated.replace(
    '          includeQualityFamilies, includeNationalityFamily',
    '          includeQualityFamilies, includeNationalityFamily, includeCareerEvolutionFamilies'
  );
  updated = updated.replace(
    '      <article><span>Nationality family</span><strong>${currentBatch.filter(item => item.tags.includes("nationality")).length}</strong></article>`;',
    '      <article><span>Nationality family</span><strong>${currentBatch.filter(item => item.tags.includes("nationality")).length}</strong></article>\n      <article><span>Career Evolution</span><strong>${currentBatch.filter(item => item.tags.includes("career-evolution")).length}</strong></article>`;'
  );
  updated = updated.replace(
    '            ${prompt.tags.includes("nationality") ? \'<span class="relation">Nationality</span>\' : ""}',
    '            ${prompt.tags.includes("nationality") ? \'<span class="relation">Nationality</span>\' : ""}\n            ${prompt.tags.includes("career-evolution") ? \'<span class="relation">Career evolution</span>\' : ""}'
  );
  write(path, source, updated);
}

for (const path of ['js/prompt-target-survivor-generator.js', 'js/prompt-target-auto-explorer.js']) {
  const source = read(path);
  let updated = source;
  updated = updated.replace(
    '      includeNationalityFamily: el("factoryIncludeNationalityFamily")',
    '      includeNationalityFamily: el("factoryIncludeNationalityFamily"),\n      includeCareerEvolutionFamilies: el("factoryIncludeCareerEvolutionFamilies")'
  );
  updated = updated.replace(
    '      includeNationalityFamily: elements.includeNationalityFamily?.checked !== false',
    '      includeNationalityFamily: elements.includeNationalityFamily?.checked !== false,\n      includeCareerEvolutionFamilies: elements.includeCareerEvolutionFamilies?.checked !== false'
  );
  updated = updated.replace(
    '    if (elements.includeNationalityFamily && settings.includeNationalityFamily != null) elements.includeNationalityFamily.checked = Boolean(settings.includeNationalityFamily);',
    '    if (elements.includeNationalityFamily && settings.includeNationalityFamily != null) elements.includeNationalityFamily.checked = Boolean(settings.includeNationalityFamily);\n    if (elements.includeCareerEvolutionFamilies && settings.includeCareerEvolutionFamilies != null) elements.includeCareerEvolutionFamilies.checked = Boolean(settings.includeCareerEvolutionFamilies);'
  );
  updated = updated.replace(
    '      includeNationalityFamily: c.includeNationalityFamily?.checked !== false',
    '      includeNationalityFamily: c.includeNationalityFamily?.checked !== false,\n      includeCareerEvolutionFamilies: c.includeCareerEvolutionFamilies?.checked !== false'
  );
  updated = updated.replace(
    '    if (c.includeNationalityFamily && settings.includeNationalityFamily != null) c.includeNationalityFamily.checked = Boolean(settings.includeNationalityFamily);',
    '    if (c.includeNationalityFamily && settings.includeNationalityFamily != null) c.includeNationalityFamily.checked = Boolean(settings.includeNationalityFamily);\n    if (c.includeCareerEvolutionFamilies && settings.includeCareerEvolutionFamilies != null) c.includeCareerEvolutionFamilies.checked = Boolean(settings.includeCareerEvolutionFamilies);'
  );
  updated = updated.replace(
    '      Boolean(settings.includeNationalityFamily), settings.minimum, settings.maximum',
    '      Boolean(settings.includeNationalityFamily), Boolean(settings.includeCareerEvolutionFamilies), settings.minimum, settings.maximum'
  );
  write(path, source, updated);
}

for (const path of [
  'js/career-context.js',
  'js/prompt-career-evolution-family-generator.js',
  'js/admin-import-tools-base.js',
  'js/prompt-target-survivor-generator.js',
  'js/prompt-target-auto-explorer.js'
]) execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });

execFileSync(process.execPath, ['scripts/verify-career-evolution-prompt-families.mjs'], { stdio: 'inherit' });
