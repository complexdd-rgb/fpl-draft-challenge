from pathlib import Path
import json


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected one match, found {text.count(old)}')
    return text.replace(old, new, 1)

p = Path('js/admin-daily-generator-guard.js')
s = p.read_text()
s = replace_once(s,
'''/* FPL Challenge Studio — Daily Challenge scheduler + saved-library generation guard v3.0.1.
   Builds one immutable 77-prompt reservoir from the structurally certified promoted library,
   runtime-retests each selected prompt, preserves exact rotation, keeps all 18 families represented
   with a fast scored reservoir: shortlist from stored evidence, runtime-certify only selected prompts, then hand off to the existing seven-day validator. */''',
'''/* FPL Challenge Studio — Daily Challenge scheduler + saved-library generation guard v3.0.2.
   Builds one immutable 77-prompt reservoir from the structurally certified promoted library,
   runtime-retests selected prompts, preserves exact rotation, keeps all 18 families represented
   with a fast scored reservoir: shortlist from stored evidence, immediately replace runtime failures, then hand off to the existing seven-day validator. */''',
'header')
s = replace_once(s, '  const VERSION = "3.0.1";', '  const VERSION = "3.0.2";', 'version')

old = '''    function reserveSpecial(state, predicate, target, attempt) {
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
'''

new = '''    let best = null;
    let runtimeCandidatesChecked = 0;

    async function certifyChoice(candidate, attempt, phase) {
      if (candidate.runtimeCertified) return true;
      if (candidate.invalid) return false;
      if (runtimeCandidatesChecked % 5 === 0) {
        setStatus(`Generator v3 · runtime-certifying ${phase} · attempt ${attempt + 1}/${GENERATOR_V3_ATTEMPTS} · ${runtimeCandidatesChecked + 1} checked…`, "working");
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const certified = await certifyCandidate(candidate.record, candidate.position, limits, cutoverApi, runtimeCache);
      runtimeCandidatesChecked += 1;
      if (!certified) {
        candidate.invalid = true;
        return false;
      }
      candidate.prompt = certified;
      candidate.leaderKey = promptTopAnswerKey(certified);
      candidate.runtimeCertified = true;
      return true;
    }

    async function reserveSpecial(state, predicate, target, attempt, phase) {
      while (state.selected.filter(item => predicate(item)).length < target) {
        const choices = [];
        for (const position of POSITION_ORDER) {
          if (Number(state.positionCounts.get(position) || 0) >= positionNeeds[position]) continue;
          for (const candidate of candidatesForPosition(position, state)) if (predicate(candidate)) choices.push(candidate);
        }
        if (!choices.length) return false;
        choices.sort((a, b) => scoreCandidate(b, state, attempt) - scoreCandidate(a, state, attempt));
        let committed = false;
        for (const candidate of choices) {
          if (!await certifyChoice(candidate, attempt, phase)) continue;
          commit(state, candidate);
          committed = true;
          break;
        }
        if (!committed) return false;
      }
      return true;
    }

    for (let attempt = 0; attempt < GENERATOR_V3_ATTEMPTS; attempt += 1) {
      const state = createState();
      if (!await reserveSpecial(state, candidate => familyOf(candidate) === "nationality", NATIONALITY_WEEKLY_TARGET, attempt, "nationality floor")) continue;
      if (!await reserveSpecial(state, candidate => familyOf(candidate) === "exclude-top-result", EXCLUDE_TOP_RESULT_WEEKLY_MIN, attempt, "Exclude Top Result floor")) continue;
      if (!await reserveSpecial(state, candidate => isAntiMeta(candidate.prompt), antiMetaRequired, attempt, "anti-meta floor")) continue;

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
        let committed = false;
        for (const candidate of choices) {
          if (!await certifyChoice(candidate, attempt, `${position} replacements`)) continue;
          commit(state, candidate);
          committed = true;
          break;
        }
        if (!committed) break;
      }

      if (state.selected.length !== WEEKLY_PROMPTS || state.sourceIds.size !== WEEKLY_PROMPTS) continue;
      if (POSITION_ORDER.some(position => Number(state.positionCounts.get(position) || 0) !== positionNeeds[position])) continue;
      if (state.nationalityCount < NATIONALITY_WEEKLY_TARGET || state.excludeCount < EXCLUDE_TOP_RESULT_WEEKLY_MIN || state.antiMetaCount < antiMetaRequired) continue;
'''

s = replace_once(s, old, new, 'selection/runtime block')
s = replace_once(s,
'    if (!best) throw new Error("Generator v3 could not assemble and runtime-certify a valid 77-prompt reservoir from the shortlisted candidate pool.");',
'    if (!best) throw new Error("Generator v3 exhausted the shortlisted runtime-valid replacements before it could assemble a valid 77-prompt reservoir.");',
'error copy')
s = replace_once(s, '      source: "generator-v3-runtime-shortlist",', '      source: "generator-v3-immediate-runtime-replacement",', 'plan source')
p.write_text(s)

# Cache/version bump.
manifest_path = Path('config/asset-manifest.json')
manifest = json.loads(manifest_path.read_text())
manifest['assets']['assetManifestRuntime']['version'] = '4.0.12-immediate-runtime-replacement'
manifest['assets']['adminDailyGeneratorGuard']['version'] = '3.0.2-immediate-runtime-replacement'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

for path in ['scripts/verify-weekly-certified-snapshot-race.mjs', 'scripts/verify-all-season-certification-gate.mjs']:
    q = Path(path)
    text = q.read_text().replace('saved-library generation guard v3.0.1', 'saved-library generation guard v3.0.2')
    q.write_text(text)

q = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
text = q.read_text()
text = text.replace("assert(guard.includes('Generator v3 · runtime-certifying selected prompts'), 'Generator v3 does not defer runtime certification to the selected reservoir.');",
                    "assert(guard.includes('async function certifyChoice(candidate, attempt, phase)'), 'Generator v3 does not runtime-certify ranked replacements in place.');\nassert(guard.includes('for (const candidate of choices)'), 'Generator v3 does not walk ranked replacements after a runtime failure.');")
text = text.replace('source: "generator-v3-runtime-shortlist"', 'source: "generator-v3-immediate-runtime-replacement"')
q.write_text(text)

q = Path('scripts/verify-prompt-studio-clean-reset.mjs')
text = q.read_text().replace("'4.0.11-runtime-shortlist'", "'4.0.12-immediate-runtime-replacement'")
q.write_text(text)
