from pathlib import Path
import json, re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)

p = Path('js/admin-daily-generator-guard.js')
s = p.read_text()
s = replace_once(s, 'saved-library generation guard v2.6.5.', 'saved-library generation guard v2.6.6.', 'guard header')
s = replace_once(s, 'const VERSION = "2.6.5";', 'const VERSION = "2.6.6";', 'guard version')
s = replace_once(
    s,
    'runtime-retests each selected prompt, preserves exact rotation, matches the real 18-family\n   proportions and caps close semantic variants so one concept cannot flood a seven-day week.',
    'runtime-retests each selected prompt, preserves exact rotation, keeps all 18 families represented\n   without percentage quotas and caps close semantic variants so one concept cannot flood a seven-day week.',
    'header policy wording'
)

pattern = re.compile(r'  function allocateFamilyTargets\(familyIndex, excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN\) \{.*?\n  \}\n\n  function semanticTags', re.S)
match = pattern.search(s)
if not match:
    raise SystemExit('allocateFamilyTargets block not found')
replacement = '''  function allocateFamilyTargets(familyIndex, excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN, balanceOffset = 0) {
    const rows = (familyIndex || []).filter(row => Number(row?.total || 0) > 0);
    if (!rows.length) return null;
    const nationality = rows.find(row => row.family === "nationality");
    if (!nationality) return null;

    // Family size in the curated library is no longer a weekly percentage quota. Every active
    // family gets representation, nationality keeps its one-per-day requirement, and Exclude Top
    // Result keeps a deliberate diversity floor. Remaining slots are shared as evenly as possible.
    const targets = Object.fromEntries(rows.map(row => [row.family, 1]));
    targets.nationality = NATIONALITY_WEEKLY_TARGET;
    if (Object.hasOwn(targets, "exclude-top-result")) {
      targets["exclude-top-result"] = Math.max(1, Math.min(EXCLUDE_TOP_RESULT_WEEKLY_MAX, Number(excludeTarget || EXCLUDE_TOP_RESULT_WEEKLY_MIN)));
    }

    let remaining = WEEKLY_PROMPTS - Object.values(targets).reduce((sum, value) => sum + Number(value || 0), 0);
    if (remaining < 0) return null;

    const flexible = rows
      .filter(row => row.family !== "nationality" && row.family !== "exclude-top-result")
      .sort((left, right) => String(left.family).localeCompare(String(right.family)));
    if (!flexible.length && remaining > 0) return null;

    const offset = flexible.length ? ((Number(balanceOffset) || 0) % flexible.length + flexible.length) % flexible.length : 0;
    const rotated = flexible.length ? [...flexible.slice(offset), ...flexible.slice(0, offset)] : [];
    const rank = new Map(rotated.map((row, index) => [row.family, index]));

    while (remaining > 0) {
      const candidates = flexible
        .filter(row => Number(targets[row.family] || 0) < Math.max(1, Number(row.total || 0)))
        .sort((left, right) =>
          Number(targets[left.family] || 0) - Number(targets[right.family] || 0)
          || Number(rank.get(left.family) || 0) - Number(rank.get(right.family) || 0)
          || Number(right.total || 0) - Number(left.total || 0)
          || String(left.family).localeCompare(String(right.family))
        );
      const next = candidates[0];
      if (!next) return null;
      targets[next.family] += 1;
      remaining -= 1;
    }
    return targets;
  }

  function semanticTags'''
s = s[:match.start()] + replacement + s[match.end():]

old_plan = '''    const targetPlans = [];
    for (let excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN; excludeTarget <= EXCLUDE_TOP_RESULT_WEEKLY_MAX; excludeTarget += 1) {
      const targets = allocateFamilyTargets(cutover.familyIndex, excludeTarget);
      if (!targets || Object.values(targets).reduce((sum, value) => sum + Number(value || 0), 0) !== WEEKLY_PROMPTS) continue;
      targetPlans.push({ excludeTarget, targets });
    }
    if (!targetPlans.length) {
      throw new Error("The 18-family weekly target could not be allocated to 77 prompt slots, even with Exclude Top Result relief.");
    }'''
new_plan = '''    const targetPlans = [];
    const targetSignatures = new Set();
    const balancePlanCount = 4;
    for (let excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN; excludeTarget <= EXCLUDE_TOP_RESULT_WEEKLY_MAX; excludeTarget += 1) {
      for (let balanceOffset = 0; balanceOffset < balancePlanCount; balanceOffset += 1) {
        const targets = allocateFamilyTargets(cutover.familyIndex, excludeTarget, balanceOffset);
        if (!targets || Object.values(targets).reduce((sum, value) => sum + Number(value || 0), 0) !== WEEKLY_PROMPTS) continue;
        const signature = JSON.stringify(Object.entries(targets).sort(([left], [right]) => left.localeCompare(right)));
        if (targetSignatures.has(signature)) continue;
        targetSignatures.add(signature);
        targetPlans.push({ excludeTarget, balanceOffset, targets });
      }
    }
    if (!targetPlans.length) {
      throw new Error("The 18-family weekly coverage floor could not be allocated to 77 prompt slots, even with Exclude Top Result relief.");
    }'''
s = replace_once(s, old_plan, new_plan, 'target plan generation')

s = replace_once(
    s,
    'throw new Error(`The proportional pool contains ${antiMetaCount} anti-meta prompts, below the configured weekly minimum of ${antiMetaRequired}. Lower the advanced anti-meta minimum or expand anti-meta-compatible saved prompts.`);',
    'throw new Error(`The balanced weekly pool contains ${antiMetaCount} anti-meta prompts, below the configured weekly minimum of ${antiMetaRequired}. Lower the advanced anti-meta minimum or expand anti-meta-compatible saved prompts.`);',
    'anti-meta wording'
)
s = replace_once(
    s,
    '      // Use the smallest Exclude Top Result relief level that can produce a valid reservoir.\n      // This preserves the normal family mix when possible, while allowing extra exclusion\n      // prompts to displace over-concentrated superstar-led slots only when needed.',
    '      // Use the smallest Exclude Top Result relief level that can produce a valid reservoir.\n      // Family coverage is balanced rather than proportional to library size, so extra exclusion\n      // prompts can displace over-concentrated superstar-led slots without preserving percentages.',
    'relief comment'
)
s = replace_once(
    s,
    'while preserving formation, semantic and max-three leader constraints, even after increasing Exclude Top Result relief from ${EXCLUDE_TOP_RESULT_WEEKLY_MIN} to ${EXCLUDE_TOP_RESULT_WEEKLY_MAX} prompts and running bounded alternate-choice search.',
    'while preserving formation, family coverage, semantic and max-three leader constraints, even after increasing Exclude Top Result relief from ${EXCLUDE_TOP_RESULT_WEEKLY_MIN} to ${EXCLUDE_TOP_RESULT_WEEKLY_MAX} prompts and running bounded alternate-choice search.',
    'failure wording'
)
p.write_text(s)

for path in ['scripts/verify-weekly-certified-snapshot-race.mjs', 'scripts/verify-all-season-certification-gate.mjs']:
    q = Path(path)
    t = q.read_text().replace('saved-library generation guard v2.6.5', 'saved-library generation guard v2.6.6')
    t = t.replace('function allocateFamilyTargets(familyIndex, excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN)', 'function allocateFamilyTargets(familyIndex, excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN, balanceOffset = 0)')
    q.write_text(t)

q = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
t = q.read_text()
t = t.replace(
    "assert(guard.includes('for (let excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN; excludeTarget <= EXCLUDE_TOP_RESULT_WEEKLY_MAX; excludeTarget += 1)'), 'Reservoir does not escalate Exclude Top Result relief when the base family mix is leader-concentrated.');",
    "assert(guard.includes('for (let excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN; excludeTarget <= EXCLUDE_TOP_RESULT_WEEKLY_MAX; excludeTarget += 1)'), 'Reservoir does not escalate Exclude Top Result relief when the base family mix is leader-concentrated.');\nassert(guard.includes('const balancePlanCount = 4;'), 'Reservoir does not explore alternate balanced family plans after removing proportional quotas.');\nassert(guard.includes('Family size in the curated library is no longer a weekly percentage quota.'), 'Weekly family allocation still depends on curated-library percentages.');"
)
fixture_pattern = re.compile(r'// The proportional plan has a hard nationality floor of seven.*?assert\(otherFamilies\.every\(\(\[family\]\) => allocations\[family\] >= 1\), \'A non-empty promoted family lost its weekly representation floor\.\'\);', re.S)
fixture = '''// The balanced plan has a hard nationality floor of seven, a deliberate Exclude Top Result
// floor, and at least one slot for every other active family. Curated-library size is not a quota.
const familyWeights = [
  ['nationality', 120], ['season-stats', 400], ['position-stat', 350], ['exact-stats', 300],
  ['combined-stats', 280], ['club-stat', 250], ['league-position', 220], ['promoted-clubs', 90],
  ['relegated-clubs', 90], ['champions', 80], ['career-longevity', 180], ['club-count', 160],
  ['manager', 140], ['anti-meta', 200], ['exclude-top-result', 62], ['value', 170], ['minutes-role', 210], ['composite-story', 190]
];
const allocations = Object.fromEntries(familyWeights.map(([family]) => [family, 1]));
allocations.nationality = 7;
allocations['exclude-top-result'] = 4;
const regularFamilies = familyWeights.map(([family]) => family).filter(family => !['nationality', 'exclude-top-result'].includes(family)).sort();
let remaining = 77 - Object.values(allocations).reduce((sum, value) => sum + value, 0);
while (remaining > 0) {
  regularFamilies.sort((left, right) => allocations[left] - allocations[right] || left.localeCompare(right));
  allocations[regularFamilies[0]] += 1;
  remaining -= 1;
}
assert(Object.values(allocations).reduce((sum, value) => sum + value, 0) === 77, 'Balanced family allocation does not sum to 77.');
assert(allocations.nationality === 7, 'Nationality target is not fixed at seven prompts per week.');
assert(allocations['exclude-top-result'] === 4, 'Exclude Top Result floor is not retained in balanced allocation.');
assert(regularFamilies.every(family => allocations[family] >= 1), 'A non-empty promoted family lost its weekly representation floor.');
const regularCounts = regularFamilies.map(family => allocations[family]);
assert(Math.max(...regularCounts) - Math.min(...regularCounts) <= 1, 'Balanced family allocation is still behaving like a proportional weighting.');'''
t, count = fixture_pattern.subn(fixture, t, count=1)
if count != 1:
    raise SystemExit('proportional verifier fixture not found')
q.write_text(t)

manifest_path = Path('config/asset-manifest.json')
manifest = json.loads(manifest_path.read_text())
manifest['assets']['assetManifestRuntime']['version'] = '4.0.8-soft-family-balance'
manifest['assets']['adminDailyGeneratorGuard']['version'] = '2.6.6-soft-family-balance'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

q = Path('scripts/verify-prompt-studio-clean-reset.mjs')
t = q.read_text().replace('4.0.7-bounded-reservoir-search', '4.0.8-soft-family-balance')
q.write_text(t)
