from pathlib import Path
import json,re

p=Path('js/admin-daily-generator-guard.js')
s=p.read_text()
s=s.replace('saved-library generation guard v2.6.7','saved-library generation guard v3.0.0')
s=s.replace('const VERSION = "2.6.7";','const VERSION = "3.0.0";')
s=s.replace('without percentage quotas and caps close semantic variants so one concept cannot flood a seven-day week.','with a fast scored reservoir: certify once, select 77, then hand off to the existing seven-day validator.')
insert='''  const GENERATOR_V3_ATTEMPTS = 10;\n  const GENERATOR_V3_POOL_MULTIPLIER = 3;\n  const GENERATOR_V3_POOL_BUFFER = 20;\n'''
s=s.replace('  const SEMANTIC_WAIT_MS = 10000;\n', '  const SEMANTIC_WAIT_MS = 10000;\n'+insert)

new_func=r'''  async function buildCertifiedReservoir() {
    const cutoverApi = window.FPL_DAILY_LIBRARY_CUTOVER_V1;
    const cutover = cutoverApi?.getState?.();
    if (!cutover?.ready) throw new Error(cutover?.reason || "The saved promoted library is not certified for Daily use.");
    const payload = await window.FPL_PROMPT_LIBRARY_SHARDS_V1?.buildRepositoryPackage?.();
    if (!payload?.manifest || !Array.isArray(payload.shards)) throw new Error("The saved Prompt Library shard package could not be read.");
    if (String(payload.manifest.promotionFingerprint || "") !== String(cutover.manifest?.promotionFingerprint || "")) {
      throw new Error("The saved shard package changed after Daily certification. Refresh Studio before generating.");
    }

    const positionNeeds = weeklyPositionNeeds();
    const limits = answerLimits();
    const usedIds = knownUsedSourceIds();
    const recentIds = knownRecentSourceIds(7);
    const runtimeCache = new Map();
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    const antiMetaRequired = Math.max(0, Number(minAntiMetaInput?.value) || 0) * DAYS_IN_BATCH;
    const poolTargets = Object.fromEntries(POSITION_ORDER.map(position => [
      position,
      Math.max(positionNeeds[position] * GENERATOR_V3_POOL_MULTIPLIER, positionNeeds[position] + GENERATOR_V3_POOL_BUFFER)
    ]));
    const pools = Object.fromEntries(POSITION_ORDER.map(position => [position, []]));

    // V3 deliberately samples the 18 families in round-robin order. Library size no longer
    // creates a quota: each family gets repeated opportunities to contribute good candidates.
    const queues = payload.shards.map(shard => ({
      family: String(shard.family || ""),
      rows: recordOrder(Array.isArray(shard.records) ? shard.records : [], usedIds, recentIds),
      cursor: 0
    })).filter(queue => queue.family && queue.rows.length);

    let scanned = 0;
    let progress = true;
    while (progress && POSITION_ORDER.some(position => pools[position].length < poolTargets[position])) {
      progress = false;
      for (const queue of queues) {
        const record = queue.rows[queue.cursor++];
        if (!record) continue;
        progress = true;
        const sourcePosition = String(record?.position || "").toUpperCase();
        const positions = POSITION_ORDER.includes(sourcePosition) ? [sourcePosition] : sourcePosition === "ANY" ? POSITION_ORDER : [];
        for (const position of positions) {
          if (pools[position].length >= poolTargets[position]) continue;
          const prompt = await certifyCandidate(record, position, limits, cutoverApi, runtimeCache);
          scanned += 1;
          if (prompt) pools[position].push({ record, prompt, position });
          if (scanned % 60 === 0) {
            setStatus(`Generator v3 · certifying candidates once · ${scanned.toLocaleString("en-GB")} checked…`, "working");
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const short = POSITION_ORDER.filter(position => pools[position].length < positionNeeds[position]);
    if (short.length) throw new Error(`Generator v3 could not certify enough ${short.join(", ")} prompts for the selected formation.`);

    const candidateBySource = new Map();
    for (const position of POSITION_ORDER) {
      for (const candidate of pools[position]) {
        const sourceId = String(candidate.record?.id || "");
        if (!sourceId) continue;
        if (!candidateBySource.has(sourceId)) candidateBySource.set(sourceId, []);
        candidateBySource.get(sourceId).push(candidate);
      }
    }

    const hash = value => {
      let h = 2166136261;
      for (const char of String(value || "")) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
      return h >>> 0;
    };

    const isAntiMeta = prompt => Array.isArray(prompt?.tags) && prompt.tags.includes("anti-meta");
    const familyOf = candidate => String(candidate?.prompt?.family || candidate?.record?.family || "");
    const sourceIdOf = candidate => String(candidate?.record?.id || "");
    const leaderOf = candidate => promptTopAnswerKey(candidate.prompt);

    function scoreCandidate(candidate, state, attempt) {
      const family = familyOf(candidate);
      const sourceId = sourceIdOf(candidate);
      const leader = leaderOf(candidate);
      const quality = Number(candidate.record?.qualityScore || 0);
      const familyLoad = Number(state.familyCounts.get(family) || 0);
      const leaderLoad = leader ? Number(state.leaderCounts.get(leader) || 0) : 0;
      const semanticLoad = semantic?.weeklyLoad ? Number(semantic.weeklyLoad(candidate.prompt, state.semanticCounts) || 0) : 0;
      const excluded = excludedTopPlayerId(candidate.prompt);
      const excludedLoad = excluded ? Number(state.leaderCounts.get(excluded) || 0) : 0;
      let score = quality;
      if (!usedIds.has(sourceId)) score += 28;
      else if (recentIds.has(sourceId)) score -= 32;
      else score -= 8;
      if (familyLoad === 0) score += 24;
      score -= familyLoad * 5;
      score -= leaderLoad * leaderLoad * 30;
      score -= semanticLoad * 8;
      score += excludedLoad * 35;
      if (family === "nationality" && state.nationalityCount < NATIONALITY_WEEKLY_TARGET) score += 90;
      if (family === "exclude-top-result" && state.excludeCount < EXCLUDE_TOP_RESULT_WEEKLY_MIN) score += 105;
      if (isAntiMeta(candidate.prompt) && state.antiMetaCount < antiMetaRequired) score += 42;
      score += (hash(`${sourceId}|${candidate.position}|${attempt}`) % 1000) / 10000;
      return score;
    }

    function createState() {
      return {
        selected: [], sourceIds: new Set(), positionCounts: new Map(), familyCounts: new Map(), leaderCounts: new Map(),
        semanticCounts: new Map(), nationalityCount: 0, excludeCount: 0, antiMetaCount: 0
      };
    }

    function commit(state, candidate) {
      const sourceId = sourceIdOf(candidate);
      const family = familyOf(candidate);
      const leader = leaderOf(candidate);
      state.selected.push(candidate);
      state.sourceIds.add(sourceId);
      state.positionCounts.set(candidate.position, Number(state.positionCounts.get(candidate.position) || 0) + 1);
      state.familyCounts.set(family, Number(state.familyCounts.get(family) || 0) + 1);
      if (leader) state.leaderCounts.set(leader, Number(state.leaderCounts.get(leader) || 0) + 1);
      if (semantic?.commitWeekly) semantic.commitWeekly(candidate.prompt, state.semanticCounts);
      if (family === "nationality") state.nationalityCount += 1;
      if (family === "exclude-top-result") state.excludeCount += 1;
      if (isAntiMeta(candidate.prompt)) state.antiMetaCount += 1;
    }

    function candidatesForPosition(position, state) {
      return pools[position].filter(candidate => !state.sourceIds.has(sourceIdOf(candidate)));
    }

    function reserveSpecial(state, predicate, target, attempt) {
      while (state.selected.filter(item => predicate(item)).length < target) {
        const choices = [];
        for (const position of POSITION_ORDER) {
          if (Number(state.positionCounts.get(position) || 0) >= positionNeeds[position]) continue;
          for (const candidate of candidatesForPosition(position, state)) if (predicate(candidate)) choices.push(candidate);
        }
        if (!choices.length) return false;
        choices.sort((a, b) => scoreCandidate(b, state, attempt) - scoreCandidate(a, state, attempt));
        commit(state, choices[0]);
      }
      return true;
    }

    let best = null;
    for (let attempt = 0; attempt < GENERATOR_V3_ATTEMPTS; attempt += 1) {
      const state = createState();
      if (!reserveSpecial(state, candidate => familyOf(candidate) === "nationality", NATIONALITY_WEEKLY_TARGET, attempt)) continue;
      if (!reserveSpecial(state, candidate => familyOf(candidate) === "exclude-top-result", EXCLUDE_TOP_RESULT_WEEKLY_MIN, attempt)) continue;
      if (!reserveSpecial(state, candidate => isAntiMeta(candidate.prompt), antiMetaRequired, attempt)) continue;

      while (state.selected.length < WEEKLY_PROMPTS) {
        const remainingPositions = POSITION_ORDER.filter(position => Number(state.positionCounts.get(position) || 0) < positionNeeds[position]);
        if (!remainingPositions.length) break;
        remainingPositions.sort((a, b) => {
          const aNeed = positionNeeds[a] - Number(state.positionCounts.get(a) || 0);
          const bNeed = positionNeeds[b] - Number(state.positionCounts.get(b) || 0);
          const aAvail = candidatesForPosition(a, state).length;
          const bAvail = candidatesForPosition(b, state).length;
          return (aAvail / Math.max(1, aNeed)) - (bAvail / Math.max(1, bNeed)) || POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b);
        });
        const position = remainingPositions[0];
        const choices = candidatesForPosition(position, state);
        if (!choices.length) break;
        choices.sort((a, b) => scoreCandidate(b, state, attempt) - scoreCandidate(a, state, attempt));
        commit(state, choices[0]);
      }

      if (state.selected.length !== WEEKLY_PROMPTS || state.sourceIds.size !== WEEKLY_PROMPTS) continue;
      if (POSITION_ORDER.some(position => Number(state.positionCounts.get(position) || 0) !== positionNeeds[position])) continue;
      if (state.nationalityCount < NATIONALITY_WEEKLY_TARGET || state.excludeCount < EXCLUDE_TOP_RESULT_WEEKLY_MIN || state.antiMetaCount < antiMetaRequired) continue;

      const prompts = state.selected.map(item => item.prompt);
      const diversity = topAnswerDiversityAudit(prompts);
      const maxLeader = diversity.repeatedPlayers.length ? Math.max(...diversity.repeatedPlayers.map(item => item.count)) : 1;
      const familyLoads = [...state.familyCounts.values()];
      const familyConcentration = familyLoads.reduce((sum, count) => sum + count * count, 0);
      const recentCount = state.selected.filter(item => recentIds.has(sourceIdOf(item))).length;
      const objective = diversity.repeatSlots * 120 + maxLeader * 45 + familyConcentration * 2 + recentCount * 35;
      if (!best || objective < best.objective) best = { state, diversity, objective };

      setStatus(`Generator v3 · scored attempt ${attempt + 1}/${GENERATOR_V3_ATTEMPTS} · ${diversity.uniquePlayers}/77 unique top answers…`, "working");
      await new Promise(resolve => setTimeout(resolve, 0));
      if (diversity.repeatSlots <= 8 && maxLeader <= 3) break;
    }

    if (!best) throw new Error("Generator v3 could not assemble a valid 77-prompt reservoir from the certified candidate pool.");

    const prompts = Object.freeze(best.state.selected.map(item => Object.freeze(item.prompt)));
    const ids = new Set(prompts.map(prompt => String(prompt.id)));
    const familyCounts = Object.fromEntries(best.state.familyCounts);
    const frozenTopAnswerDiversity = Object.freeze({
      ...best.diversity,
      repeatedPlayers: Object.freeze(best.diversity.repeatedPlayers.map(item => Object.freeze({ ...item })))
    });
    const plan = Object.freeze({
      version: VERSION,
      source: "generator-v3-fast-scored-reservoir",
      promotionFingerprint: String(payload.manifest.promotionFingerprint || ""),
      total: WEEKLY_PROMPTS,
      targets: Object.freeze({ ...familyCounts }),
      excludeTopResultTarget: Number(best.state.excludeCount || 0),
      positionNeeds: Object.freeze({ ...positionNeeds }),
      cycleFamilies: Object.freeze([]),
      knownUsedSourceIds: usedIds.size,
      recentSourceIds: recentIds.size,
      runtimeCandidatesChecked: scanned,
      leaderRepairSwaps: 0,
      leaderSearchNodes: 0,
      leaderSearchBestDepth: 0,
      antiMetaCount: best.state.antiMetaCount,
      nationalityCount: best.state.nationalityCount,
      topAnswerDiversity: frozenTopAnswerDiversity,
      semanticDiversityVersion: String(window.FPL_DAILY_SEMANTIC_DIVERSITY?.version || ""),
      semanticWeeklyCap: DAYS_IN_BATCH
    });
    return { prompts, ids, plan };
  }
'''
pat=r'  async function buildCertifiedReservoir\(\) \{.*?\n  function installGenerationSnapshot\(reservoir\) \{'
s2,n=re.subn(pat,new_func+'\n  function installGenerationSnapshot(reservoir) {',s,flags=re.S)
if n!=1: raise SystemExit(f'buildCertifiedReservoir replacement count={n}')
s=s2
s=s.replace('setStatus("Building the proportional 77-prompt generation reservoir from unused saved prompts…", "working");','setStatus("Generator v3 · building a fast scored 77-prompt reservoir…", "working");')
s=s.replace('77 runtime-certified prompts locked · ${reservoir.plan.topAnswerDiversity.uniquePlayers}/77 unique top-answer players · 18-family cycle · ${reservoir.plan.targets?.["exclude-top-result"] || 0} Exclude Top Result relief prompts · ${reservoir.plan.cycleFamilies.length ? `${reservoir.plan.cycleFamilies.length} family cycle reset(s)` : "unused prompts preferred"}. Generating week…','77 prompts locked by Generator v3 · ${reservoir.plan.topAnswerDiversity.uniquePlayers}/77 unique top-answer players · ${reservoir.plan.targets?.["exclude-top-result"] || 0} Exclude Top Result prompts · unused prompts preferred. Generating week…')
s=s.replace('the 18-family targets were preserved, no same-day semantic clashes or repeated top-answer players were allowed','the fast scored reservoir was consumed, and no same-day semantic clashes or repeated top-answer players were allowed')
p.write_text(s)

# Update manifest cache versions.
mp=Path('config/asset-manifest.json')
data=json.loads(mp.read_text())
data['assets']['assetManifestRuntime']['version']='4.0.10-generator-v3'
data['assets']['adminDailyGeneratorGuard']['version']='3.0.0-fast-scored-reservoir'
mp.write_text(json.dumps(data,indent=2)+'\n')

# Replace obsolete v2 reservoir-specific assertions with v3 invariants.
vp=Path('scripts/verify-weekly-certified-snapshot-race.mjs')
v=vp.read_text().replace("'saved-library generation guard v2.6.7'","'saved-library generation guard v3.0.0'")
start="assert(guard.includes('function topAnswerDiversityAudit(prompts)')"
end="assert(!batch.includes('Regenerate from a later rotation point rather than relaxing the nationality quota.')"
a=v.index(start)
b=v.index(end)
replacement='''assert(guard.includes('function topAnswerDiversityAudit(prompts)'), '77-prompt reservoir does not audit top-answer player uniqueness.');\nassert(guard.includes('const promptTopAnswerCache = new WeakMap();'), 'Top-answer diversity still recalculates prompt stats instead of caching them per prompt.');\nassert(guard.includes('const GENERATOR_V3_ATTEMPTS = 10;'), 'Generator v3 does not use a bounded scored-attempt budget.');\nassert(guard.includes('GENERATOR_V3_POOL_MULTIPLIER = 3'), 'Generator v3 candidate pool is missing its compact multiplier.');\nassert(guard.includes('Generator v3 · certifying candidates once'), 'Generator v3 does not expose one-pass certification progress.');\nassert(guard.includes('source: "generator-v3-fast-scored-reservoir"'), 'Generator v3 plan identity is missing.');\nassert(guard.includes('score -= leaderLoad * leaderLoad * 30'), 'Generator v3 does not strongly penalise repeated top-answer leaders.');\nassert(guard.includes('score -= familyLoad * 5'), 'Generator v3 does not softly balance prompt families.');\nassert(guard.includes('excludedLoad * 35'), 'Exclude Top Result is not rewarded when it relieves an over-used leader.');\nassert(guard.includes('NATIONALITY_WEEKLY_TARGET'), 'Generator v3 lost the weekly nationality floor.');\nassert(guard.includes('EXCLUDE_TOP_RESULT_WEEKLY_MIN'), 'Generator v3 lost the Exclude Top Result floor.');\nassert(!guard.includes('.sort((heft, right) =>'), 'Generator guard contains the broken leader-repair sorter spelling.');\nassert(guard.includes('Same-day top answers must be unique.'), 'Final weekly certification does not reject same-day repeated leaders.');\n'''
v=v[:a]+replacement+v[b:]
vp.write_text(v)
