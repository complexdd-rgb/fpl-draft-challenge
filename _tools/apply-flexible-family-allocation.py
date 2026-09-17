from pathlib import Path
import json
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


p = Path('js/admin-daily-generator-guard.js')
s = p.read_text()
s = replace_once(s, 'saved-library generation guard v2.6.5.', 'saved-library generation guard v2.7.0.', 'guard header')
s = replace_once(s, 'const VERSION = "2.6.5";', 'const VERSION = "2.7.0";', 'guard version')
s = replace_once(
    s,
    '  const EXCLUDE_TOP_RESULT_WEEKLY_MIN = 4;\n  const EXCLUDE_TOP_RESULT_WEEKLY_MAX = 8;',
    '  const EXCLUDE_TOP_RESULT_WEEKLY_MIN = 4;\n  const EXCLUDE_TOP_RESULT_WEEKLY_MAX = 10;\n  const ORDINARY_FAMILY_WEEKLY_MIN = 1;\n  const ORDINARY_FAMILY_WEEKLY_MAX = 6;',
    'family bounds constants'
)
s = replace_once(
    s,
    '   runtime-retests each selected prompt, preserves exact rotation, matches the real 18-family\n   proportions and caps close semantic variants so one concept cannot flood a seven-day week. */',
    '   runtime-retests each selected prompt, preserves exact rotation, represents all 18 families\n   without enforcing source-library percentages, and caps close semantic variants so one concept cannot flood a seven-day week. */',
    'guard header description'
)

pattern = re.compile(r'''  function allocateFamilyTargets\(familyIndex, excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN\) \{.*?\n  \}\n\n  function semanticTags''', re.S)
match = pattern.search(s)
if not match:
    raise SystemExit('allocateFamilyTargets block not found')
new_allocator = r'''  function allocateFamilyTargets(familyIndex, excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN) {
    const rows = (familyIndex || []).filter(row => Number(row?.total || 0) > 0);
    if (!rows.length) return null;
    const nationality = rows.find(row => row.family === "nationality");
    const exclusion = rows.find(row => row.family === "exclude-top-result");
    if (!nationality || !exclusion) return null;

    // Family source size is deliberately NOT used as a weekly percentage. The curated source
    // only decides whether a family exists; generation uses balanced minimum/maximum bounds.
    const targets = Object.fromEntries(rows.map(row => [row.family, 0]));
    targets.nationality = NATIONALITY_WEEKLY_TARGET;
    targets["exclude-top-result"] = Math.max(
      EXCLUDE_TOP_RESULT_WEEKLY_MIN,
      Math.min(EXCLUDE_TOP_RESULT_WEEKLY_MAX, Number(excludeTarget || EXCLUDE_TOP_RESULT_WEEKLY_MIN))
    );

    const ordinary = rows
      .filter(row => !["nationality", "exclude-top-result"].includes(row.family))
      .map(row => String(row.family))
      .sort((left, right) => left.localeCompare(right));
    for (const family of ordinary) targets[family] = ORDINARY_FAMILY_WEEKLY_MIN;

    let remaining = WEEKLY_PROMPTS - Object.values(targets).reduce((sum, value) => sum + Number(value || 0), 0);
    if (remaining < 0 || !ordinary.length) return null;

    // Rotate which families receive the spare balanced slots as exclusion relief changes, so
    // no family is permanently favoured by alphabetical/source order. Ordinary families stay
    // within a small safety ceiling; the selector can therefore favour quality/diversity rather
    // than recreating the promoted-library percentages.
    const rotationOffset = Math.max(0, Number(targets["exclude-top-result"] || 0) - EXCLUDE_TOP_RESULT_WEEKLY_MIN) % ordinary.length;
    let cursor = 0;
    let stalled = 0;
    while (remaining > 0) {
      const family = ordinary[(rotationOffset + cursor) % ordinary.length];
      cursor += 1;
      if (Number(targets[family] || 0) >= ORDINARY_FAMILY_WEEKLY_MAX) {
        stalled += 1;
        if (stalled >= ordinary.length) return null;
        continue;
      }
      targets[family] += 1;
      remaining -= 1;
      stalled = 0;
    }
    return targets;
  }

  function semanticTags'''
s = s[:match.start()] + new_allocator + s[match.end():]

s = replace_once(
    s,
    '      throw new Error("The 18-family weekly target could not be allocated to 77 prompt slots, even with Exclude Top Result relief.");',
    '      throw new Error("The flexible 18-family weekly bounds could not be allocated to 77 prompt slots.");',
    'target-plan failure wording'
)
s = s.replace('The proportional pool contains ${antiMetaCount} anti-meta prompts', 'The flexible family pool contains ${antiMetaCount} anti-meta prompts')
s = s.replace('      // Use the smallest Exclude Top Result relief level that can produce a valid reservoir.\n      // This preserves the normal family mix when possible, while allowing extra exclusion\n      // prompts to displace over-concentrated superstar-led slots only when needed.',
              '      // Use the first balanced family-bound plan that can produce a valid reservoir.\n      // Family counts are not tied to promoted-library percentages; Exclude Top Result may\n      // expand within its safety bounds when that improves leader diversity.')
s = s.replace('The saved 18-family library could not build a 77-prompt reservoir while preserving formation, semantic and max-three leader constraints, even after increasing Exclude Top Result relief from ${EXCLUDE_TOP_RESULT_WEEKLY_MIN} to ${EXCLUDE_TOP_RESULT_WEEKLY_MAX} prompts and running bounded alternate-choice search.',
              'The saved 18-family library could not build a 77-prompt reservoir while preserving formation, semantic and max-three leader constraints across the flexible family-bound plans and bounded alternate-choice search.')
s = s.replace('setStatus("Building the proportional 77-prompt generation reservoir from unused saved prompts…", "working");',
              'setStatus("Building the flexible 77-prompt generation reservoir from unused saved prompts…", "working");')
s = s.replace('18-family cycle · ${reservoir.plan.targets?.["exclude-top-result"] || 0} Exclude Top Result relief prompts',
              '18-family flexible mix · ${reservoir.plan.targets?.["exclude-top-result"] || 0} Exclude Top Result prompts')
s = s.replace('the 18-family targets were preserved, no same-day semantic clashes',
              'the flexible 18-family bounds were preserved, no same-day semantic clashes')

s = replace_once(
    s,
    '        targets: Object.freeze({ ...targets }),\n        excludeTopResultTarget: Number(targets["exclude-top-result"] || 0),',
    '        targets: Object.freeze({ ...targets }),\n        familyAllocationMode: "balanced-bounds",\n        ordinaryFamilyMin: ORDINARY_FAMILY_WEEKLY_MIN,\n        ordinaryFamilyMax: ORDINARY_FAMILY_WEEKLY_MAX,\n        excludeTopResultTarget: Number(targets["exclude-top-result"] || 0),',
    'plan family allocation metadata'
)
p.write_text(s)

# Update the main weekly verifier to protect the new non-proportional policy.
q = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
t = q.read_text()
t = t.replace('saved-library generation guard v2.6.5', 'saved-library generation guard v2.7.0')
t = t.replace("assert(guard.includes('EXCLUDE_TOP_RESULT_WEEKLY_MAX = 8'), 'Exclude Top Result does not have its bounded dynamic-relief ceiling.');",
              "assert(guard.includes('EXCLUDE_TOP_RESULT_WEEKLY_MAX = 10'), 'Exclude Top Result does not have its flexible safety ceiling.');")
t = t.replace("assert(guard.includes('for (let excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN; excludeTarget <= EXCLUDE_TOP_RESULT_WEEKLY_MAX; excludeTarget += 1)'), 'Reservoir does not escalate Exclude Top Result relief when the base family mix is leader-concentrated.');",
              "assert(guard.includes('for (let excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN; excludeTarget <= EXCLUDE_TOP_RESULT_WEEKLY_MAX; excludeTarget += 1)'), 'Reservoir does not try flexible family-bound plans across the Exclude Top Result safety range.');")
t = t.replace("assert(guard.includes('if (bestReservoir) return bestReservoir;'), 'Reservoir does not stop at the smallest successful Exclude Top Result relief level.');",
              "assert(guard.includes('if (bestReservoir) return bestReservoir;'), 'Reservoir does not stop at the first successful flexible family-bound plan.');")
fixture_pattern = re.compile(r'''// The proportional plan has a hard nationality floor of seven while all other non-empty\n// families get at least one weekly slot before proportional remainder allocation\..*?assert\(otherFamilies\.every\(\(\[family\]\) => allocations\[family\] >= 1\), 'A non-empty promoted family lost its weekly representation floor\.'\);''', re.S)
fixture = '''// Flexible family allocation must ignore promoted-library percentages. Nationality remains\n// exactly seven, Exclude Top Result has a diversity floor, and every ordinary family stays\n// within the configured weekly bounds while the complete mix still sums to 77.\nconst familyNames = [\n  'nationality', 'season-stats', 'position-stat', 'exact-stats', 'combined-stats', 'club-stat',\n  'league-position', 'promoted-clubs', 'relegated-clubs', 'champions', 'career-longevity',\n  'club-count', 'manager', 'anti-meta', 'exclude-top-result', 'value', 'minutes-role', 'composite-story'\n];\nconst flexibleTargets = Object.fromEntries(familyNames.map(family => [family, 0]));\nflexibleTargets.nationality = 7;\nflexibleTargets['exclude-top-result'] = 4;\nconst ordinaryFamilies = familyNames.filter(family => !['nationality', 'exclude-top-result'].includes(family)).sort();\nfor (const family of ordinaryFamilies) flexibleTargets[family] = 1;\nlet flexibleRemaining = 77 - Object.values(flexibleTargets).reduce((sum, value) => sum + value, 0);\nlet flexibleCursor = 0;\nwhile (flexibleRemaining > 0) {\n  const family = ordinaryFamilies[flexibleCursor % ordinaryFamilies.length];\n  flexibleCursor += 1;\n  if (flexibleTargets[family] >= 6) continue;\n  flexibleTargets[family] += 1;\n  flexibleRemaining -= 1;\n}\nassert(Object.values(flexibleTargets).reduce((sum, value) => sum + value, 0) === 77, 'Flexible family allocation does not sum to 77.');\nassert(flexibleTargets.nationality === 7, 'Nationality target is not fixed at seven prompts per week.');\nassert(flexibleTargets['exclude-top-result'] >= 4, 'Exclude Top Result lost its weekly diversity floor.');\nassert(ordinaryFamilies.every(family => flexibleTargets[family] >= 1 && flexibleTargets[family] <= 6), 'An ordinary family escaped the flexible weekly bounds.');\nassert(!guard.includes('remaining * Number(row.total || 0) / weightTotal'), 'Weekly family allocation still derives hard percentages from promoted-library family size.');\nassert(guard.includes('familyAllocationMode: "balanced-bounds"'), 'Reservoir plan does not expose flexible family allocation mode.');'''
if not fixture_pattern.search(t):
    raise SystemExit('proportional verifier fixture not found')
t = fixture_pattern.sub(fixture, t)
q.write_text(t)

for path in ['scripts/verify-all-season-certification-gate.mjs']:
    q = Path(path)
    q.write_text(q.read_text().replace('saved-library generation guard v2.6.5', 'saved-library generation guard v2.7.0'))

manifest_path = Path('config/asset-manifest.json')
manifest = json.loads(manifest_path.read_text())
manifest['assets']['assetManifestRuntime']['version'] = '4.0.8-flexible-family-allocation'
manifest['assets']['adminDailyGeneratorGuard']['version'] = '2.7.0-flexible-family-allocation'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

q = Path('scripts/verify-prompt-studio-clean-reset.mjs')
t = q.read_text().replace('4.0.7-bounded-reservoir-search', '4.0.8-flexible-family-allocation')
q.write_text(t)
