/* FPL Challenge Studio — Prompt Refinement Incubator v1.1.1
   Takes promising 3★ prompts preserved by Quality Enforcement v2, creates controlled
   threshold variants, pre-scores them with the existing Quality Analyser, then persists
   one best candidate per parent for the normal full-library 4★+ enforcement pass. */
(() => {
  "use strict";

  if (window.__FPL_PROMPT_REFINEMENT_INCUBATOR_V1__) return;
  window.__FPL_PROMPT_REFINEMENT_INCUBATOR_V1__ = true;

  const VERSION = "1.1.1";
  const MANAGER_KEY = "fplChallengeStudioPromptManagerV1";
  const INCUBATOR_KEY = "fplPromptQualityIncubatorV2";
  const RUN_KEY = "fplPromptRefinementIncubatorRunV1";
  const RESOLVED_KEY = "fplPromptRefinementResolvedV1";
  const MAX_VARIANTS_PER_PARENT = 3;
  const HARD_OVERLAP = 0.97;
  const RESCUE_MAX_OVERLAP = 0.94;
  const RESCUE_MIN_RAW_SCORE = 66;
  const RESCUE_TARGET_SCORE = 72;
  const HARD_ISSUES = new Set(["broken-rule", "no-answers", "runtime-error", "invalid-rule"]);

  const RANGES = Object.freeze({
    GK: { narrow: 5, idealLow: 8, idealHigh: 35, broad: 70 },
    DEF: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    MID: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    FWD: { narrow: 6, idealLow: 12, idealHigh: 60, broad: 110 }
  });

  const NUMBER_FIELDS = new Set([
    "points", "minutes", "goals", "assists", "goalInvolvements", "cleanSheets", "bonus", "saves",
    "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice", "leaguePosition",
    "ageAtSeasonStart", "careerSeasonCount", "careerClubCount", "fullNameLength", "firstNameLength",
    "surnameLength", "nameWordCount"
  ]);

  const FIELD_STEPS = Object.freeze({
    points: 10, minutes: 250, goals: 1, assists: 1, goalInvolvements: 2, cleanSheets: 2,
    bonus: 5, saves: 10, goalsConceded: 5, yellowCards: 1, redCards: 1,
    startingPrice: 0.5, finalPrice: 0.5, leaguePosition: 1, ageAtSeasonStart: 1,
    careerSeasonCount: 1, careerClubCount: 1, fullNameLength: 1, firstNameLength: 1,
    surnameLength: 1, nameWordCount: 1,
    maxPointsGain: 10, maxGoalsGain: 1, maxMinutesGain: 250, maxClubSwitchPointsGain: 10,
    maxClubSwitchGoalsGain: 1, maxConsecutive2000Minutes: 1, maxConsecutive100Points: 1,
    maxConsecutiveScoringSeasons: 1, maxConsecutive8Goals: 1, tableBandCount: 1,
    maxClubsWithSameManager: 1
  });

  const SOURCE_FIELDS = Object.freeze(Object.keys(FIELD_STEPS).sort((a, b) => b.length - a.length));
  // Prefer story-defining thresholds over generic eligibility guards such as minutes > 0.
  const SOURCE_FIELD_PRIORITY = Object.freeze({
    points: 0, goals: 0, assists: 0, goalInvolvements: 0, cleanSheets: 0, bonus: 0, saves: 0,
    goalsConceded: 0, startingPrice: 0, finalPrice: 0, yellowCards: 0, redCards: 0,
    maxPointsGain: 1, maxGoalsGain: 1, maxClubSwitchPointsGain: 1, maxClubSwitchGoalsGain: 1,
    maxConsecutive2000Minutes: 1, maxConsecutive100Points: 1, maxConsecutiveScoringSeasons: 1,
    maxConsecutive8Goals: 1, tableBandCount: 1, maxClubsWithSameManager: 1, maxMinutesGain: 1,
    careerSeasonCount: 2, careerClubCount: 2, ageAtSeasonStart: 2, fullNameLength: 2,
    firstNameLength: 2, surnameLength: 2, nameWordCount: 2, leaguePosition: 3, minutes: 5
  });
  let busy = false;
  let installed = false;

  function library() {
    const api = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function players() {
    return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function readIncubator() {
    const live = window.FPL_PROMPT_QUALITY_INCUBATOR;
    if (live?.ready && Array.isArray(live.items)) return live.items.slice();
    const stored = readJson(INCUBATOR_KEY, null);
    return Array.isArray(stored?.items) ? stored.items.slice() : [];
  }

  function readManager() {
    const parsed = readJson(MANAGER_KEY, null);
    return parsed && typeof parsed === "object" ? {
      version: 1,
      overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
      customs: Array.isArray(parsed.customs) ? parsed.customs : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
    } : { version: 1, overrides: {}, customs: [], deletedIds: [] };
  }

  function resolvedParents() {
    const values = readJson(RESOLVED_KEY, []);
    return new Set(Array.isArray(values) ? values.map(value => String(value).toLowerCase()) : []);
  }

  function saveResolved(values) {
    writeJson(RESOLVED_KEY, [...values].sort());
  }

  function tagsOf(prompt) {
    return Array.isArray(prompt?.tags) ? prompt.tags.map(tag => String(tag).toLowerCase()) : [];
  }

  function lineageTag(parentId) {
    return `refined-from:${String(parentId || "").toLowerCase()}`;
  }

  function parentFromTags(prompt) {
    const tag = tagsOf(prompt).find(value => value.startsWith("refined-from:"));
    return tag ? tag.slice("refined-from:".length) : "";
  }

  function isRefinementCandidate(prompt) {
    return tagsOf(prompt).includes("refinement-candidate") || Boolean(parentFromTags(prompt));
  }

  function eligibleItems() {
    const resolved = resolvedParents();
    return readIncubator().filter(item => {
      const id = String(item?.id || "").toLowerCase();
      return id && !resolved.has(id) && !isRefinementCandidate(item) && Number(item?.qualityV2?.playerCount || 0) >= 3;
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundStep(value, step) {
    const places = step < 1 ? 1 : 0;
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  }

  function thresholdDirection(prompt) {
    const count = Number(prompt?.qualityV2?.playerCount || 0);
    const range = RANGES[prompt?.position] || RANGES.MID;
    if (count < range.idealLow) return "loosen";
    if (count > range.idealHigh) return "tighten";
    return "reshape";
  }

  function shiftedValue(value, operator, step, mode) {
    const current = Number(value);
    if (!Number.isFinite(current)) return null;
    const direction = mode === "loosen" ? -1 : 1;
    let delta = step * direction;
    if (operator === "lte" || operator === "lt" || operator === "<=" || operator === "<") delta *= -1;
    const next = roundStep(current + delta, step);
    return next < 0 && current >= 0 ? 0 : next;
  }

  function mutationModes(direction) {
    if (direction === "loosen") return ["loosen", "loosen", "tighten"];
    if (direction === "tighten") return ["tighten", "tighten", "loosen"];
    return ["loosen", "tighten", "tighten"];
  }

  function replaceFirstNumber(text, oldValue, newValue) {
    const source = String(text || "");
    const target = Number(oldValue);
    if (!Number.isFinite(target)) return source;
    let replaced = false;
    return source.replace(/-?\d+(?:\.\d+)?/g, token => {
      if (replaced || Number(token) !== target) return token;
      replaced = true;
      const decimals = token.includes(".") ? token.split(".")[1].length : 0;
      const next = Number(newValue);
      return Number.isFinite(next) ? (decimals ? next.toFixed(decimals) : String(next)) : String(newValue);
    });
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 58);
  }

  function uniqueId(base, reserved) {
    const existing = new Set(library().map(prompt => String(prompt?.id || "")));
    for (const value of reserved || []) existing.add(String(value));
    let id = slugify(base) || "refined_prompt";
    let suffix = 2;
    while (existing.has(id)) id = `${slugify(base).slice(0, 52)}_${suffix++}`;
    return id;
  }

  function normaliseCareerClub(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d")
      .replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/’/g, "'")
      .replace(/[^a-z0-9'\-]+/g, " ").trim();
  }

  function normaliseNameLiteral(value) {
    return normaliseCareerClub(value);
  }

  function numericAccessor(field) {
    if (field === "goalInvolvements") return "(p.goals + p.assists)";
    if (field === "fullNameLength") return "__letterCount(__fullName)";
    if (field === "firstNameLength") return "__letterCount(__firstName)";
    if (field === "surnameLength") return "__letterCount(__surname)";
    if (field === "nameWordCount") return "__nameTokens.length";
    if (field === "careerSeasonCount") return "Number(p._career?.seasonCount)";
    if (field === "careerClubCount") return "Number(p._career?.clubCount)";
    return `p.${field}`;
  }

  function conditionType(field) {
    if (NUMBER_FIELDS.has(field)) return "number";
    if (field === "season") return "season";
    if (field === "playedForBothClubs") return "clubPair";
    if (field === "careerOverlapWithPlayer") return "playerReference";
    if (field === "sameClubSeasonAsPlayer") return "teammateReference";
    if (["champions", "topFour", "bottomHalf", "relegated", "promoted", "outsideBigSix", "assistsMoreThanGoals", "returnedToFormerClub", "hyphenatedSurname", "sameInitials", "singleWordName"].includes(field)) return "boolean";
    if (["fullName", "firstName", "surname", "firstInitial", "surnameInitial"].includes(field)) return "nameText";
    if (field === "manager") return "manager";
    return "text";
  }

  function resolveCareerReference(value) {
    const result = window.FPL_CAREER_CONTEXT?.resolvePlayer?.(String(value || "").trim());
    return result?.ok ? result.player : null;
  }

  function conditionToExpression(condition) {
    const field = condition.field;
    const type = conditionType(field);
    const accessor = numericAccessor(field);
    if (type === "season") {
      const current = "Number.parseInt(String(p.season || \"\").slice(0, 4), 10)";
      const firstLabel = String(condition.value || ""), secondLabel = String(condition.value2 || "");
      const first = Number.parseInt(firstLabel.slice(0, 4), 10), second = Number.parseInt(secondLabel.slice(0, 4), 10);
      if (condition.operator === "equals") return `String(p.season || "") === ${JSON.stringify(firstLabel)}`;
      if (condition.operator === "before") return `(Number.isFinite(${current}) && ${current} < ${first})`;
      if (condition.operator === "after") return `(Number.isFinite(${current}) && ${current} > ${first})`;
      const low = Math.min(first, second), high = Math.max(first, second);
      return `(Number.isFinite(${current}) && ${current} >= ${low} && ${current} <= ${high})`;
    }
    if (type === "clubPair") {
      const first = JSON.stringify(normaliseCareerClub(condition.value));
      const second = JSON.stringify(normaliseCareerClub(condition.value2));
      return `(Array.isArray(p._career?.normalisedClubs) && p._career.normalisedClubs.includes(${first}) && p._career.normalisedClubs.includes(${second}))`;
    }
    if (type === "playerReference" || type === "teammateReference") {
      const reference = resolveCareerReference(condition.value);
      if (!reference) return "false";
      const anchorId = JSON.stringify(reference.playerId);
      if (type === "playerReference") return `(() => { const __anchor = window.FPL_CAREER_CONTEXT?.getPlayer?.(${anchorId}); return p.playerId !== ${anchorId} && Array.isArray(p._career?.seasonYears) && Array.isArray(__anchor?.seasonYears) && p._career.seasonYears.some(year => __anchor.seasonYears.includes(year)); })()`;
      return `(() => { const __anchor = window.FPL_CAREER_CONTEXT?.getPlayer?.(${anchorId}); const __clubKey = window.FPL_CAREER_CONTEXT?.normalise?.(p.club) || ""; const __key = String(p.season || "") + "|" + __clubKey; return p.playerId !== ${anchorId} && Number(p.minutes) > 0 && Array.isArray(__anchor?.clubSeasonKeys) && __anchor.clubSeasonKeys.includes(__key); })()`;
    }
    if (type === "number") {
      const value = Number(condition.value), value2 = Number(condition.value2), finite = `Number.isFinite(${accessor})`;
      if (condition.operator === "gte") return `(${finite} && ${accessor} >= ${value})`;
      if (condition.operator === "lte") return `(${finite} && ${accessor} <= ${value})`;
      if (condition.operator === "eq") return `(${finite} && ${accessor} === ${value})`;
      if (condition.operator === "gt") return `(${finite} && ${accessor} > ${value})`;
      if (condition.operator === "lt") return `(${finite} && ${accessor} < ${value})`;
      const low = Math.min(value, value2), high = Math.max(value, value2);
      return `(${finite} && ${accessor} >= ${low} && ${accessor} <= ${high})`;
    }
    if (type === "boolean") {
      let expression;
      if (field === "outsideBigSix") expression = `!["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club)`;
      else if (field === "assistsMoreThanGoals") expression = "p.assists > p.goals";
      else if (field === "returnedToFormerClub") expression = "p._career?.returnedToFormerClub === true";
      else if (field === "hyphenatedSurname") expression = "__surname.includes(\"-\")";
      else if (field === "sameInitials") expression = "(__nameTokens.length > 1 && Boolean(__firstInitial) && __firstInitial === __surnameInitial)";
      else if (field === "singleWordName") expression = "__nameTokens.length === 1";
      else expression = `p.${field} === true`;
      return condition.operator === "isFalse" ? `!(${expression})` : `(${expression})`;
    }
    if (type === "nameText") {
      const value = JSON.stringify(normaliseNameLiteral(condition.value));
      const nameAccessor = { fullName: "__fullName", firstName: "__firstName", surname: "__surname", firstInitial: "__firstInitial", surnameInitial: "__surnameInitial" }[field] || "__fullName";
      if (condition.operator === "notEquals") return `${nameAccessor} !== ${value}`;
      if (condition.operator === "startsWith") return `${nameAccessor}.startsWith(${value})`;
      if (condition.operator === "endsWith") return `${nameAccessor}.endsWith(${value})`;
      if (condition.operator === "contains") return `${nameAccessor}.includes(${value})`;
      return `${nameAccessor} === ${value}`;
    }
    const value = JSON.stringify(String(condition.value || "").trim());
    if (type === "manager") {
      const equals = `(Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === ${value}.toLowerCase()))`;
      if (condition.operator === "notEquals") return `!${equals}`;
      if (condition.operator === "contains") return `(Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase().includes(${value}.toLowerCase())))`;
      return equals;
    }
    if (condition.operator === "notEquals") return `String(p.club || "").toLowerCase() !== ${value}.toLowerCase()`;
    if (condition.operator === "contains") return `String(p.club || "").toLowerCase().includes(${value}.toLowerCase())`;
    return `String(p.club || "").toLowerCase() === ${value}.toLowerCase()`;
  }

  function compileBuilder(rule) {
    const joiner = rule.join === "any" ? " || " : " && ";
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    const expressions = conditions.map(conditionToExpression);
    const result = expressions.length > 1 ? `(${expressions.join(joiner)})` : expressions[0] || "false";
    const usesNames = conditions.some(condition => ["fullName", "firstName", "surname", "firstInitial", "surnameInitial", "fullNameLength", "firstNameLength", "surnameLength", "nameWordCount", "hyphenatedSurname", "sameInitials", "singleWordName"].includes(condition.field));
    if (!usesNames) return `p => ${result}`;
    return `p => { const __rawName=String(p.name||p.playerName||"").trim(); const __normaliseName=value=>String(value||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/ø/g,"o").replace(/ł/g,"l").replace(/[đð]/g,"d").replace(/þ/g,"th").replace(/æ/g,"ae").replace(/œ/g,"oe").replace(/’/g,"'").replace(/[^a-z0-9'\\-]+/g," ").trim(); const __fullName=__normaliseName(__rawName); const __nameTokens=__fullName.split(/\\s+/).filter(Boolean); const __firstName=__nameTokens[0]||""; const __surnameParticles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __surnameStart=Math.max(0,__nameTokens.length-1); while(__surnameStart>0&&__surnameParticles.has(__nameTokens[__surnameStart-1]))__surnameStart-=1; const __surname=__nameTokens.slice(__surnameStart).join(" "); const __firstInitial=__firstName.charAt(0); const __surnameInitial=__surname.charAt(0); const __letterCount=value=>String(value||"").replace(/[^a-z0-9]/g,"").length; return ${result}; }`;
  }

  function functionFromSource(source) {
    try {
      const fn = Function(`"use strict"; return (${source});`)();
      return typeof fn === "function" ? fn : null;
    } catch (_) { return null; }
  }

  function candidateTags(parent) {
    return [...new Set([lineageTag(parent.id), "refinement-candidate", "auto-refined", ...tagsOf(parent)])].slice(0, 12);
  }

  function makeCandidate(parent, source, studioRule, oldValue, newValue, index, reserved) {
    const test = functionFromSource(source);
    if (!test) return null;
    const id = uniqueId(`${parent.id}_refined_${index + 1}_${newValue}`, reserved);
    reserved.add(id);
    return {
      id,
      position: parent.position,
      label: replaceFirstNumber(parent.label, oldValue, newValue),
      fail: replaceFirstNumber(parent.fail, oldValue, newValue),
      difficulty: parent.difficulty || "medium",
      tags: candidateTags(parent),
      rating: 4,
      cooldown: Number(parent.cooldown || 10),
      enabled: true,
      studioRule,
      testSource: source,
      test,
      _studioBuiltIn: false,
      _studioCustom: true,
      _refinementParentId: String(parent.id)
    };
  }

  function builderVariants(parent, reserved) {
    const rule = parent?.studioRule;
    if (rule?.kind !== "builder" || !Array.isArray(rule.conditions)) return [];
    const numericIndex = rule.conditions.findIndex(condition => NUMBER_FIELDS.has(condition.field) && ["gte", "lte", "gt", "lt", "eq", "between"].includes(condition.operator));
    if (numericIndex < 0) return [];
    const condition = rule.conditions[numericIndex];
    const step = FIELD_STEPS[condition.field] || 1;
    const oldValue = Number(condition.value);
    if (!Number.isFinite(oldValue)) return [];
    const direction = thresholdDirection(parent);
    const modes = mutationModes(direction);
    const variants = [];
    for (let index = 0; index < MAX_VARIANTS_PER_PARENT; index += 1) {
      const scale = index === 1 ? 2 : 1;
      const mode = modes[index];
      const nextRule = JSON.parse(JSON.stringify(rule));
      const nextCondition = nextRule.conditions[numericIndex];
      let nextValue = shiftedValue(oldValue, condition.operator, step * scale, mode);
      if (condition.operator === "eq") nextValue = roundStep(oldValue + (mode === "loosen" ? -step * scale : step * scale), step);
      if (nextValue == null || nextValue === oldValue) continue;
      nextCondition.value = nextValue;
      if (condition.operator === "between") {
        const second = Number(condition.value2);
        if (!Number.isFinite(second)) continue;
        const low = Math.min(oldValue, second), high = Math.max(oldValue, second);
        const delta = step * scale;
        nextCondition.value = mode === "loosen" ? Math.max(0, low - delta) : low + delta;
        nextCondition.value2 = mode === "loosen" ? high + delta : Math.max(nextCondition.value, high - delta);
        nextValue = nextCondition.value;
      }
      const source = compileBuilder(nextRule);
      const candidate = makeCandidate(parent, source, nextRule, oldValue, nextValue, index, reserved);
      if (candidate) variants.push(candidate);
    }
    return variants;
  }

  function sourceMetricPriority(field, operator, value) {
    let priority = Number(SOURCE_FIELD_PRIORITY[field] ?? 2);
    // Positive-minute checks are eligibility sentinels; mutate them only as a last resort.
    if (field === "minutes" && [">", ">="].includes(operator) && Number(value) <= 0) priority += 100;
    return priority;
  }

  function sourceMetricMatch(source) {
    const matches = [];
    for (const field of SOURCE_FIELDS) {
      const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`((?:Number\\()?p\\.(?:_careerEvolution\\?\\.)?${escaped}(?:\\))?\\s*)(>=|<=|>|<)\\s*(-?\\d+(?:\\.\\d+)?)`);
      const match = pattern.exec(source);
      if (!match) continue;
      matches.push({
        field, pattern, match, sourceIndex: Number(match.index) || 0,
        priority: sourceMetricPriority(field, match[2], Number(match[3]))
      });
    }
    matches.sort((a, b) => a.priority - b.priority || a.sourceIndex - b.sourceIndex || a.field.localeCompare(b.field));
    return matches[0] || null;
  }

  function sourceVariants(parent, reserved) {
    const source = String(parent?.testSource || parent?.studioRule?.source || "").trim();
    if (!source) return [];
    const found = sourceMetricMatch(source);
    const direction = thresholdDirection(parent);
    if (!found) {
      const range = RANGES[parent.position] || RANGES.MID;
      const count = Number(parent?.qualityV2?.playerCount || 0);
      if (count <= range.idealHigh) return [];
      return [500, 1000, 1500].map((minutes, index) => {
        const wrapped = `p => ((${source})(p) && Number(p.minutes) >= ${minutes})`;
        const candidate = makeCandidate(parent, wrapped, { kind: "source", source: wrapped }, "", "", index, reserved);
        if (!candidate) return null;
        candidate.label = `${parent.label} and ${minutes.toLocaleString("en-GB")}+ minutes`;
        candidate.fail = `${parent.fail} The qualifying season must also have at least ${minutes.toLocaleString("en-GB")} minutes.`;
        return candidate;
      }).filter(Boolean);
    }

    const oldValue = Number(found.match[3]);
    const step = FIELD_STEPS[found.field] || 1;
    const modes = mutationModes(direction);
    const variants = [];
    for (let index = 0; index < MAX_VARIANTS_PER_PARENT; index += 1) {
      const scale = index === 1 ? 2 : 1;
      const nextValue = shiftedValue(oldValue, found.match[2], step * scale, modes[index]);
      if (nextValue == null || nextValue === oldValue) continue;
      const nextSource = source.replace(found.pattern, `${found.match[1]}${found.match[2]} ${nextValue}`);
      const candidate = makeCandidate(parent, nextSource, { kind: "source", source: nextSource }, oldValue, nextValue, index, reserved);
      if (candidate) variants.push(candidate);
    }
    return variants;
  }

  function variantsFor(parent, reserved) {
    const builder = builderVariants(parent, reserved);
    return builder.length ? builder : sourceVariants(parent, reserved);
  }

  function issueCodes(result) {
    const values = Array.isArray(result?.issues) ? result.issues : [];
    return values.map(issue => typeof issue === "string" ? issue : String(issue?.code || issue?.type || issue?.id || issue?.issue || "")).filter(Boolean);
  }

  function overlapValue(result) {
    const values = [result?.overlap?.max, result?.maxOverlap, result?.overlapMax, result?.highestOverlap]
      .map(Number).filter(Number.isFinite);
    return values.length ? Math.max(...values) : 0;
  }

  function familyBonus(prompt) {
    const tags = new Set(tagsOf(prompt));
    let bonus = 0;
    if (tags.has("career-evolution")) bonus += 6;
    if (tags.has("nationality")) bonus += 4;
    if (tags.has("manager") || tags.has("manager-journey")) bonus += 4;
    if (tags.has("career-shape")) bonus += 3;
    if (tags.has("career-total") || tags.has("career-seasons")) bonus += 2;
    if (tags.has("season-rule")) bonus += 2;
    if (tags.has("anti-meta")) bonus += 2;
    if (tags.has("position-journey") || tags.has("club-status-journey")) bonus += 2;
    return Math.min(8, bonus);
  }

  function decision(prompt, result) {
    const rawRating = Number(result?.suggestedRating || 0);
    const rawScore = Number.isFinite(Number(result?.score)) ? Number(result.score) : rawRating === 5 ? 85 : rawRating === 4 ? 72 : rawRating === 3 ? 58 : 0;
    const playerCount = Math.max(0, Number(result?.playerCount || 0));
    const overlap = overlapValue(result);
    const issues = issueCodes(result);
    const hardReject = Math.max(0, Number(result?.errorCount || 0)) > 0 || playerCount < 3 || ["broken", "poor"].includes(String(result?.quality || "").toLowerCase()) || overlap >= HARD_OVERLAP || issues.some(issue => HARD_ISSUES.has(issue));
    const bonus = hardReject ? 0 : familyBonus(prompt);
    const adjustedScore = Math.min(100, rawScore + bonus);
    if (hardReject) return { state: "rejected", rawRating, rawScore, adjustedScore, overlap, playerCount };
    if (rawRating >= 4) return { state: "certified", rawRating, rawScore, adjustedScore, overlap, playerCount };
    if (rawRating === 3 && rawScore >= RESCUE_MIN_RAW_SCORE && adjustedScore >= RESCUE_TARGET_SCORE && overlap < RESCUE_MAX_OVERLAP) return { state: "rescued", rawRating, rawScore, adjustedScore, overlap, playerCount };
    return { state: "incubator", rawRating, rawScore, adjustedScore, overlap, playerCount };
  }

  function serialiseCandidate(prompt) {
    return {
      id: prompt.id, position: prompt.position, label: prompt.label, fail: prompt.fail,
      difficulty: prompt.difficulty, tags: [...prompt.tags], rating: 4,
      cooldown: prompt.cooldown, enabled: true, studioRule: prompt.studioRule,
      testSource: prompt.testSource
    };
  }

  function persistCandidates(candidates) {
    const state = readManager();
    for (const prompt of candidates) {
      const serialised = serialiseCandidate(prompt);
      const index = state.customs.findIndex(item => String(item?.id || "") === prompt.id);
      if (index >= 0) state.customs[index] = serialised;
      else state.customs.push(serialised);
      state.deletedIds = state.deletedIds.filter(id => String(id) !== prompt.id);
    }
    writeJson(MANAGER_KEY, state);
  }

  function reconcilePreviousRun() {
    const run = readJson(RUN_KEY, null);
    if (!run || run.phase !== "validating" || !window.FPL_PROMPT_QUALITY_ENFORCEMENT_V2?.ready) return run;
    const liveIds = new Set(library().map(prompt => String(prompt?.id || "")));
    const candidateToParent = new Map((run.candidates || []).map(item => [String(item.id), String(item.parentId).toLowerCase()]));
    const promotedIds = [...candidateToParent.keys()].filter(id => liveIds.has(id));
    const promotedParents = new Set(promotedIds.map(id => candidateToParent.get(id)));
    const resolved = resolvedParents();
    for (const id of promotedParents) resolved.add(id);
    saveResolved(resolved);

    const state = readManager();
    const candidateIds = new Set(candidateToParent.keys());
    state.customs = state.customs.filter(item => {
      const id = String(item?.id || "");
      if (candidateIds.has(id) && !liveIds.has(id)) return false;
      if (promotedParents.has(id.toLowerCase())) return false;
      return true;
    });
    writeJson(MANAGER_KEY, state);

    const complete = {
      ...run,
      phase: "complete",
      promoted: promotedIds.length,
      unresolved: Math.max(0, Number(run.parentsAttempted || 0) - promotedParents.size),
      promotedParents: [...promotedParents],
      finishedAt: new Date().toISOString()
    };
    writeJson(RUN_KEY, complete);
    return complete;
  }

  function panel() {
    let node = document.getElementById("promptRefinementIncubatorPanel");
    if (node) return node;
    const anchor = document.getElementById("fourStarLibraryFloorStatus");
    const analyser = document.getElementById("promptQualityAnalyser");
    if (!analyser) return null;
    node = document.createElement("section");
    node.id = "promptRefinementIncubatorPanel";
    node.className = "prompt-refinement-incubator";
    node.innerHTML = `<div class="refinement-head"><div><span>REFINEMENT INCUBATOR</span><strong id="promptRefinementHeadline">Promising 3★ prompts</strong></div><span id="promptRefinementChip">Waiting…</span></div><div class="refinement-stats"><article><span>Held</span><strong id="promptRefinementHeld">0</strong></article><article><span>Ready to refine</span><strong id="promptRefinementReady">0</strong></article><article><span>Last promoted</span><strong id="promptRefinementPromoted">—</strong></article></div><button type="button" id="refinePromisingPromptsBtn">Refine promising prompts</button><p id="promptRefinementStatus">Waiting for Quality Enforcement v2.</p>`;
    if (anchor?.parentElement) anchor.insertAdjacentElement("afterend", node);
    else analyser.prepend(node);
    if (!document.getElementById("promptRefinementIncubatorStyles")) {
      const style = document.createElement("style");
      style.id = "promptRefinementIncubatorStyles";
      style.textContent = `.prompt-refinement-incubator{margin:14px 0;padding:14px;border:1px solid rgba(98,201,255,.2);border-radius:14px;background:rgba(98,201,255,.035)}.refinement-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.refinement-head div{display:grid;gap:3px}.refinement-head span{font-size:.66rem;font-weight:800;letter-spacing:.08em;color:#62c9ff}.refinement-head strong{font-size:.92rem;color:#eef9f3}.refinement-head>span{padding:5px 8px;border:1px solid rgba(98,201,255,.18);border-radius:999px;letter-spacing:0}.refinement-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.refinement-stats article{padding:9px;border:1px solid rgba(255,255,255,.08);border-radius:10px}.refinement-stats article span{display:block;font-size:.62rem;color:#8aa99a}.refinement-stats article strong{display:block;margin-top:2px;font-size:.94rem;color:#fff}.prompt-refinement-incubator button{width:100%;padding:10px 12px;border:0;border-radius:10px;font-weight:800;background:linear-gradient(90deg,#35e987,#9cff4f);color:#032412}.prompt-refinement-incubator button:disabled{opacity:.45}.prompt-refinement-incubator p{margin:9px 0 0;font-size:.7rem;line-height:1.45;color:#9bb6a8}`;
      document.head.appendChild(style);
    }
    node.querySelector("#refinePromisingPromptsBtn")?.addEventListener("click", () => void runRefinement());
    return node;
  }

  function setStatus(message, working = false) {
    const node = panel();
    if (!node) return;
    const status = node.querySelector("#promptRefinementStatus");
    const button = node.querySelector("#refinePromisingPromptsBtn");
    if (status) status.textContent = message;
    if (button) button.disabled = Boolean(working || busy);
  }

  function render() {
    const node = panel();
    if (!node) return;
    const held = readIncubator().filter(item => !isRefinementCandidate(item)).length;
    const ready = eligibleItems().length;
    const last = reconcilePreviousRun() || readJson(RUN_KEY, null);
    node.querySelector("#promptRefinementHeld").textContent = held.toLocaleString("en-GB");
    node.querySelector("#promptRefinementReady").textContent = ready.toLocaleString("en-GB");
    node.querySelector("#promptRefinementPromoted").textContent = last?.phase === "complete" ? Number(last.promoted || 0).toLocaleString("en-GB") : "—";
    node.querySelector("#promptRefinementChip").textContent = window.FPL_PROMPT_QUALITY_ENFORCEMENT_V2?.ready ? "Ready" : "Waiting…";
    const button = node.querySelector("#refinePromisingPromptsBtn");
    if (button) button.disabled = busy || ready === 0 || !window.FPL_PROMPT_QUALITY_ENFORCEMENT_V2?.ready;
    if (last?.phase === "complete") setStatus(`Last pass promoted ${last.promoted || 0} parent prompt${last.promoted === 1 ? "" : "s"}; ${last.unresolved || 0} remain available for another refinement strategy.`);
    else if (ready) setStatus(`${ready.toLocaleString("en-GB")} promising prompt${ready === 1 ? " is" : "s are"} ready for controlled threshold refinement.`);
    else if (window.FPL_PROMPT_QUALITY_ENFORCEMENT_V2?.ready) setStatus("No unresolved promising prompts currently need refinement.");
  }

  async function runRefinement() {
    if (busy) return;
    const engine = window.FPL_PROMPT_QUALITY_ENGINE;
    const sourceParents = eligibleItems();
    if (typeof engine?.analyseLibrary !== "function" || !players().length || !sourceParents.length) return render();
    busy = true;
    const reserved = new Set();
    const candidates = [];
    const byParent = new Map();
    for (const parent of sourceParents) {
      const variants = variantsFor(parent, reserved);
      if (!variants.length) continue;
      byParent.set(String(parent.id), variants);
      candidates.push(...variants);
    }
    if (!candidates.length) {
      busy = false;
      setStatus("The remaining incubated prompts do not contain a safely tunable threshold yet. They have been left untouched.");
      render();
      return;
    }

    setStatus(`Testing ${candidates.length.toLocaleString("en-GB")} controlled variants from ${byParent.size.toLocaleString("en-GB")} promising prompts…`, true);
    try {
      const results = await engine.analyseLibrary(candidates, players(), {
        progress: (current, total) => {
          if (!total) return;
          const percent = Math.round((current / total) * 100);
          if (percent % 5 === 0) setStatus(`Refining promising prompts… ${percent}%`, true);
        }
      });
      const resultById = new Map(results.map(result => [String(result?.id || ""), result]));
      const selected = [];
      for (const [parentId, variants] of byParent) {
        const scored = variants.map(prompt => ({ prompt, result: resultById.get(prompt.id) }))
          .filter(item => item.result)
          .map(item => ({ ...item, decision: decision(item.prompt, item.result) }))
          .filter(item => ["certified", "rescued"].includes(item.decision.state))
          .sort((a, b) => b.decision.adjustedScore - a.decision.adjustedScore || b.decision.rawScore - a.decision.rawScore || a.decision.overlap - b.decision.overlap);
        if (!scored.length) continue;
        selected.push({ ...scored[0].prompt, _refinementParentId: parentId });
      }

      if (!selected.length) {
        writeJson(RUN_KEY, { version: 1, phase: "complete", parentsAttempted: byParent.size, promoted: 0, unresolved: byParent.size, finishedAt: new Date().toISOString() });
        setStatus(`No variant reached a provisional 4★ standard. The ${byParent.size.toLocaleString("en-GB")} parent ideas remain safely incubated.`, false);
        busy = false;
        render();
        return;
      }

      persistCandidates(selected);
      const run = {
        version: 1,
        phase: "validating",
        parentsAttempted: byParent.size,
        variantsTested: candidates.length,
        candidates: selected.map(prompt => ({ id: prompt.id, parentId: prompt._refinementParentId })),
        startedAt: new Date().toISOString()
      };
      writeJson(RUN_KEY, run);
      setStatus(`${selected.length.toLocaleString("en-GB")} best variants reached provisional 4★ quality. Reloading once so full-library v2 enforcement can certify them against the entire prompt pool…`, true);
      setTimeout(() => window.location.reload(), 180);
    } catch (error) {
      console.error("Prompt refinement incubator failed.", error);
      busy = false;
      setStatus(`Refinement could not finish: ${String(error?.message || error || "Unknown error")}`);
      render();
    }
  }

  function install() {
    if (installed) return;
    const analyser = document.getElementById("promptQualityAnalyser");
    if (!analyser) return;
    installed = true;
    panel();
    render();
  }

  function boot() {
    install();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  window.addEventListener("fpl:prompt-quality-incubator-ready", render);
  window.addEventListener("fpl:prompt-quality-enforcement-v2-ready", render);
  window.addEventListener("fpl:prompt-tools-ready", boot);

  window.FPL_PROMPT_REFINEMENT_INCUBATOR = Object.freeze({
    version: VERSION,
    getItems: () => readIncubator().slice(),
    getEligible: () => eligibleItems().slice(),
    refine: () => runRefinement()
  });
})();