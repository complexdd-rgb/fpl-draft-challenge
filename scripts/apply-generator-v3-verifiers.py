from pathlib import Path
p=Path('scripts/verify-all-season-certification-gate.mjs')
s=p.read_text().replace('saved-library generation guard v2.6.7','saved-library generation guard v3.0.0')
p.write_text(s)
