# FPL Draft Challenge — Permanent Prompt Curation Policy

Status: Phase 1 policy baseline  
Baseline export: `shards_134765_1pkuiu3`  
Baseline size: 134,765 promoted prompts · 17 families · 2,684 variant groups

## Purpose

Prompt Factory and Quality Analyser deliberately explore a large prompt space. A Quality `pass` means a prompt is structurally valid and playable; it does **not** mean every numeric threshold sibling deserves permanent library space.

Curation is the boundary between **eligible generated material** and the **long-lived survivor library**.

This policy is intentionally downstream of Prompt Factory, Quality Analyser and Promotion. It does not change Daily generation, the 77-prompt weekly reservoir, nationality/semantic-diversity rules, certification, publishing, leaderboard behaviour or Supabase publication.

## Core rules

1. **Keep the source export immutable.** The promoted shard package is provenance. Curation produces decisions and survivor IDs/packages; it never destroys the source pool.
2. **Quality pass is an entry ticket, not certification.** A prompt can be technically excellent and still be rejected as redundant.
3. **Variant groups are the primary compression unit.** The default target is **2 survivors per variant group** and the hard ceiling is **3**.
4. **One survivor is preferred** when threshold siblings are functionally interchangeable.
5. **A second survivor must add gameplay contrast.** It should materially change answer-pool size/band, difficulty, or another useful player-facing dimension.
6. **A third survivor is exceptional.** It requires a documented family/position/difficulty scarcity reason.
7. **Family balance beats generator volume.** Large combinatorial families do not earn a proportionally large survivor allocation.
8. **Exact duplicates are automatic REJECT.** Near-identical threshold siblings normally REJECT unless they meet the contrast rule.
9. **Historical/data safety remains mandatory.** Missing-field/null safety and all existing certification boundaries still apply after curation.
10. **Every decision is explainable and reproducible.** Store decision, reason code, source prompt ID, variant group and evidence used.

## Decision vocabulary

### CERTIFY
Use for the strongest representative of a useful variant group.

Default evidence:
- structurally valid promoted prompt;
- preferably quality score >= 65;
- preferably at least 3 answer players;
- good coverage/evidence breadth;
- strongest or clearest wording/threshold representative inside its group;
- not displaced by a clearly superior sibling.

### RESCUE
Use for a non-anchor sibling that is worth retaining despite not being the single strongest representative.

A RESCUE needs at least one material reason:
- changes answer-pool band;
- answer-player count differs materially (guide: >= max(3 players, 20%));
- changes useful difficulty band;
- fills a family/position scarcity;
- preserves a particularly strong or recognisable football story;
- is needed for a documented Daily diversity constraint.

RESCUE is not a softer version of CERTIFY. It is an explicit diversity exception.

### REJECT
Use when a prompt adds volume without meaningful new gameplay.

Typical reasons:
- redundant threshold sibling;
- third-or-later sibling without a scarcity case;
- tiny answer pool with weak breadth when a better sibling exists;
- materially weaker representative of the same group;
- duplicate/near-duplicate wording or answer behaviour;
- group already has enough stronger survivors.

REJECT does not mean the prompt was broken. It can remain valid provenance in the source export.

## Survivor target

Phase 1 target: **5,585 prompts**.

That is approximately **2.08 survivors per current variant group** and a **95.86% reduction** from the 134,765-prompt promoted source.

| Family | Source | Target |
|---|---:|---:|
| combined-stats | 41,939 | 450 |
| composite-story | 26,879 | 450 |
| minutes-role | 17,162 | 400 |
| manager | 14,537 | 400 |
| nationality | 10,386 | 400 |
| club-stat | 8,606 | 400 |
| value | 6,984 | 400 |
| career-longevity | 2,362 | 350 |
| league-position | 1,398 | 325 |
| position-stat | 1,003 | 325 |
| exact-stats | 796 | 300 |
| anti-meta | 721 | 300 |
| club-count | 632 | 250 |
| promoted-clubs | 462 | 225 |
| relegated-clubs | 414 | 225 |
| champions | 299 | 200 |
| season-stats | 185 | 185 |
| **Total** | **134,765** | **5,585** |

Targets are a balancing envelope, not an instruction to keep weak prompts merely to hit a number. Variant-group quality and coverage can leave a family below target. A family may exceed target only when the total library remains controlled and the additional survivors have documented material-distinction reasons.

## Balance guards inside the survivor library

Use these as review guards rather than blind quotas:

- preserve all 17 families unless a future family is explicitly retired;
- avoid any one family exceeding roughly 8% of the curated library without a documented exception;
- where a family genuinely supports all playing positions, keep usable GK/DEF/MID/FWD coverage rather than allowing one position to dominate because it generated more combinations;
- retain a deliberate spread of easy/medium/hard material;
- retain a deliberate spread of answer-pool bands: 2, 3–5, 6–15, 16–40, 41–80, 81–150 and 151+;
- treat 151+ answer-player prompts as an explicit very-broad band rather than silently folding them into 81–150;
- do not use broad answer count alone as a quality proxy: a narrow prompt may be excellent if it is memorable and fair.

## Representative 144-prompt review batch

Every Phase 1 calibration batch is exactly **144 prompts**:

- **48 CERTIFY candidates**
- **48 RESCUE candidates**
- **48 REJECT candidates**

Family representation:
- every family contributes **8 prompts**;
- the eight highest-volume families contribute **one additional prompt each**, giving 144 total;
- those extra families are recomputed from the input export rather than hard-coded.

For the other nine families, the missing ninth slot rotates across CERTIFY / RESCUE / REJECT so the global batch remains exactly 48/48/48.

The batch intentionally includes:
- group anchors;
- plausible second survivors;
- large-group redundant siblings;
- all positions/difficulties available in each family;
- small, medium, large and extreme variant groups.

The generated decision is a **review proposal**, not an irreversible automatic judgment. Human changes should be saved with a reason code so later policy tuning can be measured against the original proposal.

## Reason codes

Recommended permanent reason codes:

- `anchor-best-representative`
- `material-answer-band-change`
- `material-answer-count-change`
- `difficulty-contrast`
- `position-scarcity`
- `family-scarcity`
- `story-value`
- `daily-diversity-need`
- `redundant-threshold-sibling`
- `group-cap-exceeded`
- `weaker-sibling`
- `near-duplicate-behaviour`
- `exact-duplicate`
- `weak-evidence-breadth`
- `manual-exception`

## Promotion into Daily

Phase 1 does **not** switch Daily generation authority.

The safe sequence is:

`promoted source export -> curation audit -> 144 calibration review -> frozen survivor decisions -> curated package verification -> full generation regression -> explicit cutover`

Until that final explicit cutover, the existing Daily saved-library architecture remains authoritative exactly as it is today.

## Tooling

Run:

```bash
node scripts/audit-prompt-curation-v1.mjs path/to/fpl-prompt-library-shards-v1-*.json
```

The audit writes:
- a full JSON audit;
- a Markdown balance/compression report;
- a deterministic 144-prompt review batch.

The script verifies all 17 families, manifest totals, prompt IDs, family ownership, variant-group count and saved Quality status counts before producing results.
