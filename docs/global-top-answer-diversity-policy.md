# Global top-answer diversity policy

Daily generation now uses layered answer diversity rather than relying on prompt-family variety alone.

## Existing hard safeguards

- preferred maximum of two top-answer appearance days per player in a seven-day batch
- hard maximum of three top-answer appearance days per player
- target minimum gap of three days between repeated leader appearances
- same-day overlap pressure across the wider answer pool

## Reservoir selection pressure

The semantic-diversity policy now also scores the top three FPL-points answers for every runtime-certified prompt while the 77-prompt weekly reservoir is being selected.

- repeating the same #1 answer receives the strongest penalty
- overlapping top-three answer pools receive a smaller but material penalty
- penalties accumulate as the reservoir fills, so otherwise-comparable prompts with fresher answer pools are preferred
- these are soft selection penalties, not new hard blockers, so narrow family/position allocations can still complete safely

## Seven-day carry-over

Before a new reservoir is selected, the policy inspects the previous seven scheduled challenge days available from the manifest, Supabase schedule and browser challenge history. Players who recently appeared as the #1 answer or inside the top three add selection pressure to matching candidates in the new week.

This prevents a player who dominated the end of one generated week from immediately becoming the obvious answer repeatedly at the start of the next.

## Scope

This changes Daily reservoir selection only. It does not mutate the frozen curated prompt authority, prompt IDs, family weights, answer validity or scoring rules.
