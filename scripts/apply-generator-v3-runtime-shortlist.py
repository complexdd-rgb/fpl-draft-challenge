from pathlib import Path
import json, re

GUARD = Path('js/admin-daily-generator-guard.js')
s = GUARD.read_text()
s = s.replace('saved-library generation guard v3.0.0', 'saved-library generation guard v3.0.1')
s = s.replace('const VERSION = "3.0.0";', 'const VERSION = "3.0.1";')
s = s.replace('with a fast scored reservoir: certify once, select 77, then hand off to the existing seven-day validator.', 'with a fast scored reservoir: shortlist from stored evidence, runtime-certify only selected prompts, then hand off to the existing seven-day validator.')
s = s.replace('    const certified = Object.freeze(prompt);\n    cache.set(key, certified);', '    promptTopAnswerCache.set(prompt, stats?.bestAnswer || null);\n    const certified = Object.freeze(prompt);\n    cache.set(key, certified);')

new_func = r'''  async function buildCertifiedReservoir() {
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

    function materialiseShortlistCandidate(record, position) {
      const stored = Number(record?.qualityEvidence?.answerPlayers || 0);
      const sourcePosition = String(record?.position || "").toUpperCase();
      if (!Number.isFinite(stored) || stored < limits.min || (sourcePosition !== "ANY" && stored > limits.max)) return null;
      const prompt = cutoverApi.materialiseRecord(record, position);
      if (!prompt || typeof prompt.test !== "function") return null;
      prompt.tags = semanticTags(record, prompt);
      if (semantic?.fromRecord) prompt.semanticDiversity = semantic.fromRecord(record, position, prompt.label);
      return { record, prompt, position, storedAnswerPlayers: stored, invalid: false, leaderKey: "" };
    }

    // Shortlist cheaply from the already-certified quality evidence. Runtime player scans are
    // intentionally deferred until a prompt is actually selected for the provisional 77.
    const queues = payload.shards.map(shard => ({
      family: String(shard.family || ""),
      rows: recordOrder(Array.isArray(shard.records) ? shard.records : [], usedIds, recentIds),
      cursor: 0
    })).filter(queue => queue.family && queue.rows.length);

    let shortlisted = 0;
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
          const candidate = materialiseShortlistCandidate(record, position);
          if (!candidate) continue;
          pools[position].push(candidate);
          shortlisted += 1;
          if (shortlisted % 80 === 0) {
            setStatus(`Generator v3 · shortlisting from stored evidence · ${shortlisted.toLocaleString("en-GB")} candidates prepared…`, "working");
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const short = POSITION_ORDER.filter(position => pools[position].length < positionNeeds[position]);
    if (short.length) throw new Error(`Generator v3 could not shortlist enough ${short.join(", ")} prompts for the selected formation.`);

    const hash = value => {
      let h = 2166136261;
      for (const char of String(value || "")) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
      return h >>> 0;
    };

    const isAntiMeta = prompt => Array.isArray(prompt?.tags) && prompt.tags.includes("anti-meta");
    const familyOf = candidate => String(candidate?.prompt?.family || candidate?.record?.family || "");
    const sourceIdOf = candidate => String(candidate?.record?.id || "");
    const leaderOf = candidate => String(candidate?.leaderKey || "");

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
      return pools[position].filter(candidate => !candidate.invalid && !state.sourceIds.has(sourceIdOf(candidate)));
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
    let runtimeCandidatesChecked = 0;
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

      // Runtime-certify only the provisional 77. Successful prompts stay cached and are reused
      // by later scored attempts and by the seven-day generator; failures are removed from the pool.
      let runtimeFailed = false;
      for (let index = 0; index < state.selected.length; index += 1) {
        const candidate = state.selected[index];
        const certified = await certifyCandidate(candidate.record, candidate.position, limits, cutoverApi, runtimeCache);
        runtimeCandidatesChecked += 1;
        if (!certified) {
          candidate.invalid = true;
          runtimeFailed = true;
          break;
        }
        candidate.prompt = certified;
        candidate.leaderKey = promptTopAnswerKey(certified);
        if ((index + 1) % 10 === 0 || index + 1 === WEEKLY_PROMPTS) {
          setStatus(`Generator v3 · runtime-certifying selected prompts · attempt ${attempt + 1}/${GENERATOR_V3_ATTEMPTS} · ${index + 1}/${WEEKLY_PROMPTS}…`, "working");
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      if (runtimeFailed) continue;

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

    if (!best) throw new Error("Generator v3 could not assemble and runtime-certify a valid 77-prompt reservoir from the shortlisted candidate pool.");

    const prompts = Object.freeze(best.state.selected.map(item => Object.freeze(item.prompt)));
    const ids = new Set(prompts.map(prompt => String(prompt.id)));
    const familyCounts = Object.fromEntries(best.state.familyCounts);
    const frozenTopAnswerDiversity = Object.freeze({
      ...best.diversity,
      repeatedPlayers: Object.freeze(best.diversity.repeatedPlayers.map(item => Object.freeze({ ...item })))
    });
    const plan = Object.freeze({
      version: VERSION,
      source: "generator-v3-runtime-shortlist",
      promotionFingerprint: String(payload.manifest.promotionFingerprint || ""),
      total: WEEKLY_PROMPTS,
      targets: Object.freeze({ ...familyCounts }),
      excludeTopResultTarget: Number(best.state.excludeCount || 0),
      positionNeeds: Object.freeze({ ...positionNeeds }),
      cycleFamilies: Object.freeze([]),
      knownUsedSourceIds: usedIds.size,
      recentSourceIds: recentIds.size,
      runtimeCandidatesChecked,
      shortlistedCandidates: shortlisted,
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

pattern = re.compile(r'  async function buildCertifiedReservoir\(\) \{[\s\S]*?\n  \}\n\n  function installGenerationSnapshot', re.M)
match = pattern.search(s)
if not match:
    raise SystemExit('buildCertifiedReservoir block not found')
s = s[:match.start()] + new_func + '\n  function installGenerationSnapshot' + s[match.end():]
GUARD.write_text(s)

manifest_path = Path('config/asset-manifest.json')
manifest = json.loads(manifest_path.read_text())
manifest['assets']['assetManifestRuntime']['version'] = '4.0.11-runtime-shortlist'
manifest['assets']['adminDailyGeneratorGuard']['version'] = '3.0.1-runtime-shortlist'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

# Update exact-version and architecture assertions to the new runtime-shortlist boundary.
for file in ['scripts/verify-weekly-certified-snapshot-race.mjs', 'scripts/verify-all-season-certification-gate.mjs']:
    p = Path(file)
    text = p.read_text().replace('saved-library generation guard v3.0.0', 'saved-library generation guard v3.0.1')
    p.write_text(text)

p = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
text = p.read_text()
text = text.replace("assert(guard.includes('Generator v3 · certifying candidates once'), 'Generator v3 does not expose one-pass certification progress.');", "assert(guard.includes('Generator v3 · shortlisting from stored evidence'), 'Generator v3 does not expose stored-evidence shortlist progress.');\nassert(guard.includes('Generator v3 · runtime-certifying selected prompts'), 'Generator v3 does not defer runtime certification to the selected reservoir.');")
text = text.replace('source: "generator-v3-fast-scored-reservoir"', 'source: "generator-v3-runtime-shortlist"')
p.write_text(text)

p = Path('scripts/verify-prompt-studio-clean-reset.mjs')
text = p.read_text().replace("manifest.assets?.assetManifestRuntime?.version === '4.0.10-generator-v3'", "manifest.assets?.assetManifestRuntime?.version === '4.0.11-runtime-shortlist'")
p.write_text(text)
