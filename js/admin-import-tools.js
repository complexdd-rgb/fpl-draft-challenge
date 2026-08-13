/* FPL Challenge Studio · admin import-tools loader v16.0.7 */
(() => {
  "use strict";
  const load = (src, done) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    if (done) script.addEventListener("load", done, { once: true });
    document.head.appendChild(script);
  };
  load("js/admin-import-tools-base.js?v=16.0.1-unified1", () => {
    load("js/career-shape-rules.js?v=1.1.2-repair", () => {
      load("js/career-shape-workspace-repair.js?v=1.0.0", () => {
        load("js/career-shape-unified-generator.js?v=1.0.0", () => {
          load("js/career-shape-future-quality-guard.js?v=1.0.0", () => {
            load("js/career-shape-unified-fixes.js?v=1.0.1");
          });
        });
      });
    });
  });
})();

/* Validation Lab Career Shape agreement bridge · v1.0.0 */
(() => {
  "use strict";
  const MARK = "__careerShapeAgreementBridge";
  const norm = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[–—−]/g, "-").replace(/\s+/g, " ").trim();

  function familyFromText(text) {
    const value = norm(text);
    if (/won the premier league and also played for a relegated club.*recorded career/.test(value)) return "championAndRelegated";
    if (/won the premier league at some point.*recorded career/.test(value)) return "everChampion";
    if (/played for a top-four club at some point.*recorded career/.test(value)) return "everTopFour";
    if (/never played for a traditional big six club.*recorded premier league career/.test(value)) return "neverBigSix";
    if (/traditional big six clubs?.*recorded premier league career/.test(value)) return "bigSixClubCount";
    if (/consecutive recorded premier league seasons at the same club/.test(value)) return "consecutiveSameClub";
    if (/different managers across (?:their )?recorded premier league career/.test(value)) return "managerCount";
    if (/managers during a single recorded premier league season|stored managers during a single recorded premier league season/.test(value)) return "managersInSeason";
    return "";
  }

  function familyFromPrompt(prompt, fallbackText = "") {
    const source = `${prompt?.family || ""} ${prompt?.id || ""} ${prompt?.testSource || prompt?.studioRule?.source || ""}`;
    if (/championAndRelegated|everChampion.*everRelegated/i.test(source)) return "championAndRelegated";
    if (/everChampion/i.test(source)) return "everChampion";
    if (/everTopFour/i.test(source)) return "everTopFour";
    if (/neverBigSix/i.test(source)) return "neverBigSix";
    if (/bigSixClubs2|bigSixClubCount/i.test(source)) return "bigSixClubCount";
    if (/consecutiveSameClub|maxConsecutiveSameClub/i.test(source)) return "consecutiveSameClub";
    if (/managersInSeason|maxManagersInSeason/i.test(source)) return "managersInSeason";
    if (/managerCount/i.test(source)) return "managerCount";
    return familyFromText(prompt?.label || fallbackText);
  }

  function isCareerPrompt(prompt) {
    return Boolean(prompt && (/^career_shape_/i.test(String(prompt.id || "")) || String(prompt.family || "").includes("career-shape") || (prompt.tags || []).includes("career-shape")));
  }

  function numericRule(text, fallback) {
    const value = norm(text);
    let match = value.match(/\b(at least|exactly|at most|no more than|up to)\s+(\d+)\b/);
    if (match) return { operator: match[1] === "exactly" ? "eq" : /at most|no more than|up to/.test(match[1]) ? "lte" : "gte", value: Number(match[2]) };
    match = value.match(/\b(\d+)\+/);
    return match ? { operator: "gte", value: Number(match[1]) } : { operator: "gte", value: fallback };
  }

  const passesNumber = (actual, rule) => Number.isFinite(Number(actual)) && (rule.operator === "eq" ? Number(actual) === rule.value : rule.operator === "lte" ? Number(actual) <= rule.value : Number(actual) >= rule.value);
  const expectedNumber = rule => rule.operator === "eq" ? `Exactly ${rule.value}` : rule.operator === "lte" ? `At most ${rule.value}` : `At least ${rule.value}`;
  const check = (label, passed, actual, explanation, expected) => ({ label, passed: Boolean(passed), actual: String(actual ?? "Missing"), expected: String(expected || ""), explanation: String(explanation || "") });

  function careerChecks(record, prompt, family, sourceText) {
    const shape = record?._careerShape || {};
    const career = record?._career || {};
    const text = prompt?.label || sourceText || "";
    if (family === "everChampion") {
      const actual = shape.everChampion ?? career.everChampion;
      return [check("Recorded career: league champions", actual === true, actual ? "Yes" : "No", "Checks all positive-minute Premier League seasons in the recorded career, not only the selected season.", "At least one title-winning season")];
    }
    if (family === "everTopFour") {
      const actual = shape.everTopFour ?? career.everTopFour;
      return [check("Recorded career: top-four club", actual === true, actual ? "Yes" : "No", "Checks all positive-minute Premier League seasons in the recorded career, not only the selected season.", "At least one top-four season")];
    }
    if (family === "championAndRelegated") {
      const champion = shape.everChampion ?? career.everChampion;
      const relegated = shape.everRelegatedClub ?? career.everRelegatedClub;
      return [
        check("Recorded career: league champions", champion === true, champion ? "Yes" : "No", "Needs a positive-minute title-winning Premier League season somewhere in the recorded career.", "Yes"),
        check("Recorded career: relegated club", relegated === true, relegated ? "Yes" : "No", "Needs a positive-minute Premier League season for a relegated club somewhere in the recorded career.", "Yes")
      ];
    }
    if (family === "neverBigSix") return [check("Recorded career: never Big Six", shape.neverBigSix === true, shape.neverBigSix ? "Yes" : "No", "Checks the positive-minute Premier League club history.", "No recorded Big Six club")];
    const config = family === "consecutiveSameClub"
      ? ["maxConsecutiveSameClub", 4, "Consecutive seasons at one club"]
      : family === "managerCount"
        ? ["managerCount", 4, "Different managers in recorded career"]
        : family === "bigSixClubCount"
          ? ["bigSixClubCount", 2, "Traditional Big Six clubs in recorded career"]
          : family === "managersInSeason"
            ? ["maxManagersInSeason", 2, "Managers in one recorded season"]
            : null;
    if (!config) return [];
    const rule = numericRule(text, config[1]);
    const actual = shape[config[0]] ?? career[config[0]];
    return [check(config[2], passesNumber(actual, rule), Number.isFinite(Number(actual)) ? Number(actual) : "Missing", "Uses positive-minute Premier League career history.", expectedNumber(rule))];
  }

  function install() {
    const base = window.ValidationEngine;
    if (!base || base[MARK]) return;

    const resolvePrompt = input => {
      if (input && typeof input === "object" && typeof input.test === "function") return input;
      return base.getPromptLibrary().find(prompt => prompt.id === String(input || "")) || null;
    };

    const fixResult = (result, input) => {
      if (!result?.ok) return result;
      const prompt = resolvePrompt(input);
      const sourceText = prompt?.label || String(input || "");
      const family = familyFromPrompt(prompt, sourceText) || familyFromText(sourceText);
      if (!family) return result;
      const remove = new Set(family === "everChampion" ? ["League champions"] : family === "everTopFour" ? ["Top-four club"] : family === "championAndRelegated" ? ["League champions", "Relegated club"] : []);
      const checks = (result.checks || []).filter(item => !remove.has(item.label));
      const index = checks.findIndex(item => item.label === "Original prompt logic");
      const additions = careerChecks(result.record, prompt, family, sourceText);
      if (index >= 0) checks.splice(index, 0, ...additions); else checks.push(...additions);
      const failed = checks.filter(item => !item.passed);
      const original = checks.find(item => item.label === "Original prompt logic");
      const diagnosticPassed = checks.filter(item => item.label !== "Original prompt logic").every(item => item.passed);
      return { ...result, parsed: { ...(result.parsed || {}), recognised: true, careerShapeFamily: family }, checks, failed, passed: original ? original.passed === true && diagnosticPassed : diagnosticPassed };
    };

    const evaluatePrompt = (reference, season, input) => fixResult(base.evaluatePrompt(reference, season, input), input);

    function explorePrompt(input, options = {}) {
      const prompt = resolvePrompt(input);
      const sourceText = prompt?.label || String(input || "");
      const family = familyFromPrompt(prompt, sourceText) || familyFromText(sourceText);
      if (!family) return base.explorePrompt(input, options);
      const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
      const seasonFilter = options.season || "";
      const validByPlayer = new Map();
      const nearMisses = [];
      let checked = 0;
      let validSeasonCount = 0;
      for (const player of base.getPlayers()) {
        for (const season of player.seasons || []) {
          if (seasonFilter && season.season !== seasonFilter) continue;
          checked += 1;
          const result = evaluatePrompt(player, season.season, prompt || sourceText);
          if (!result.ok) continue;
          if (result.passed) {
            validSeasonCount += 1;
            const current = validByPlayer.get(player.playerId);
            if (!current || Number(result.record.points) > Number(current.record.points)) validByPlayer.set(player.playerId, result);
          } else {
            const failures = result.checks.filter(item => !item.passed && item.label !== "Original prompt logic");
            if (failures.length === 1 && Number(result.record.minutes) > 0) nearMisses.push({ result, failedRule: failures[0] });
          }
        }
      }
      const valid = [...validByPlayer.values()].sort((a, b) => Number(b.record.points) - Number(a.record.points) || a.player.name.localeCompare(b.player.name));
      nearMisses.sort((a, b) => Number(b.result.record.points) - Number(a.result.record.points));
      return { ok: true, prompt: prompt ? { id: prompt.id, label: prompt.label, position: prompt.position } : { id: "manual", label: sourceText }, checked, validPlayerCount: valid.length, validSeasonCount, valid: valid.slice(0, limit), nearMisses: nearMisses.slice(0, limit) };
    }

    function certifySeason(seasonLabel) {
      const result = base.certifySeason(seasonLabel);
      if (!result?.ok) return result;
      const careerPrompts = base.getPromptLibrary().filter(prompt => prompt?.enabled !== false && isCareerPrompt(prompt));
      if (!careerPrompts.length) return result;
      const careerIds = new Set(careerPrompts.map(prompt => String(prompt.id || "")));
      let oldMismatches = 0;
      let newMismatches = 0;
      const examples = [];
      const oldPassing = new Map(careerPrompts.map(prompt => [prompt.id, 0]));
      const newPassing = new Map(careerPrompts.map(prompt => [prompt.id, 0]));
      for (const player of base.getPlayers()) {
        if (!(player.seasons || []).some(item => item.season === seasonLabel)) continue;
        for (const prompt of careerPrompts) {
          const oldResult = base.evaluatePrompt(player, seasonLabel, prompt.id);
          if (!oldResult?.ok) continue;
          const newResult = fixResult(oldResult, prompt.id);
          const nativePassed = oldResult.checks.find(item => item.label === "Original prompt logic")?.passed === true;
          if (nativePassed !== oldResult.passed) oldMismatches += 1;
          if (nativePassed !== newResult.passed) {
            newMismatches += 1;
            if (examples.length < 25) examples.push(`${prompt.id} · ${player.name} · ${newResult.checks.filter(item => !item.passed && item.label !== "Original prompt logic").map(item => item.label).join(", ")}`);
          }
          if (oldResult.passed) oldPassing.set(prompt.id, (oldPassing.get(prompt.id) || 0) + 1);
          if (newResult.passed) newPassing.set(prompt.id, (newPassing.get(prompt.id) || 0) + 1);
        }
      }
      const agreement = result.tests?.find(test => test.id === "diagnostic-agreement");
      const corrected = Math.max(0, Number(result.promptSummary?.diagnosticMismatches || 0) - oldMismatches + newMismatches);
      if (agreement) {
        agreement.passed = corrected === 0;
        agreement.actual = `${corrected} disagreements`;
        agreement.details = [...(agreement.details || []).filter(detail => !careerIds.has(String(detail).split(" · ")[0])), ...examples].slice(0, 25);
      }
      if (result.promptSummary) result.promptSummary.diagnosticMismatches = corrected;
      const warning = result.warnings?.find(item => item.id === "no-answer-prompts");
      if (warning) {
        const oldZero = careerPrompts.filter(prompt => (oldPassing.get(prompt.id) || 0) === 0).length;
        const newZeroPrompts = careerPrompts.filter(prompt => (newPassing.get(prompt.id) || 0) === 0);
        const count = Math.max(0, Number(warning.count || 0) - oldZero + newZeroPrompts.length);
        warning.count = count;
        warning.details = [...(warning.details || []).filter(detail => !careerIds.has(String(detail).split(" · ")[0])), ...newZeroPrompts.map(prompt => `${prompt.id} · ${prompt.label}`)].slice(0, 25);
        if (result.promptSummary) result.promptSummary.noAnswerPrompts = count;
        if (!count) result.warnings = result.warnings.filter(item => item !== warning);
      }
      result.criticalFailures = (result.tests || []).filter(test => test.severity === "critical" && !test.passed).length;
      result.status = result.criticalFailures ? "Failed" : "Certified";
      result.certified = !result.criticalFailures;
      return result;
    }

    window.ValidationEngine = Object.freeze({
      ...base,
      parsePromptText(text, positionHint = "") {
        const parsed = base.parsePromptText(text, positionHint);
        const family = familyFromText(text);
        return family ? { ...parsed, recognised: true, careerShapeFamily: family } : parsed;
      },
      evaluatePrompt,
      explorePrompt,
      certifySeason,
      [MARK]: "1.0.0"
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
