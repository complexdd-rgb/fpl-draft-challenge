from pathlib import Path

path = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
text = path.read_text()
old = "assert(batch.includes('const rotationState = generationSnapshot'), 'Batch generator does not distinguish guarded reservoir rotation from legacy history replay.');"
new = "assert(batch.includes('let rotationState = generationSnapshot'), 'Batch generator does not distinguish guarded reservoir rotation from legacy history replay or cannot reset that state between full-week layout attempts.');"
if old not in text:
    raise SystemExit('missing rotation-state verifier assertion')
text = text.replace(old, new, 1)
path.write_text(text)
