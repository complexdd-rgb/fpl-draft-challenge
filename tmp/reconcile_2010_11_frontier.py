import csv
import json
import re
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher

ROOT = Path('/tmp/fpl2010-frontier')
OUT = Path('tmp/2010-11-frontier-output')
OUT.mkdir(parents=True, exist_ok=True)


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or ''))
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower().replace('&', ' and ')
    s = re.sub(r"[^a-z0-9]+", ' ', s)
    return ' '.join(s.split())


def token_key(s):
    return ' '.join(sorted(norm(s).split()))


def as_float(v):
    try:
        return float(v or 0)
    except Exception:
        return 0.0


with (ROOT / 'canonical.csv').open(encoding='utf-8-sig', newline='') as f:
    all_canon = list(csv.DictReader(f))
canonical = [r for r in all_canon if as_float(r.get('timePlayed')) > 0]
if len(canonical) != 544:
    raise RuntimeError(f'Canonical positive-minute count {len(canonical)} != 544')

by_id = {str(r['playerId']): r for r in canonical}
by_norm = {}
by_tokens = {}
for r in canonical:
    by_norm.setdefault(norm(r['playerName']), []).append(r)
    by_tokens.setdefault(token_key(r['playerName']), []).append(r)

alias_variants = {
    'lukasz fabianski': ['lukasz fabianski'],
    'wojciech szczesny': ['wojciech szczesny'],
    'sebastien squillaci': ['sebastien squillaci'],
    'vassiriki diaby': ['abou diaby', 'vassiriki abou diaby', 'vassiriki diaby'],
    'nascimento ramires': ['ramires', 'ramires santos do nascimento', 'ramires nascimento'],
    'mikel': ['john obi mikel', 'mikel john obi', 'john mikel obi', 'mikel'],
    'johnny heitinga': ['john heitinga', 'johnny heitinga'],
    'jose reina': ['pepe reina', 'jose manuel reina', 'jose reina'],
    'sanchez jose enrique': ['jose enrique', 'jose enrique sanchez', 'jose enrique sanchez diaz'],
    'leiva lucas': ['lucas leiva', 'lucas pezini leiva', 'leiva lucas'],
    'gael clichy': ['gael clichy'],
    'kolo toure': ['kolo toure', 'kolo habib toure'],
    'yaya toure': ['yaya toure', 'gnegneri yaya toure'],
    'oliveira anderson': ['anderson', 'anderson luis de abreu oliveira', 'anderson oliveira'],
    'rafael da silva': ['rafael', 'rafael da silva', 'rafael pereira da silva'],
    'fabio da silva': ['fabio', 'fabio da silva', 'fabio pereira da silva'],
    'rob green': ['robert green', 'rob green'],
    'dos santos giovani': ['giovani dos santos', 'dos santos giovani'],
    'gonzalo jara reyes': ['gonzalo jara', 'gonzalo jara reyes'],
    'steven nzonzi': ["steven n'zonzi", 'steven nzonzi'],
    'chung yong lee': ['lee chung yong', 'chung yong lee'],
    'adlene guedioura': ['adlene guedioura'],
    'mame biram diouf': ['mame biram diouf', 'mame diouf'],
    'david hoilett': ['junior hoilett', 'david hoilett', 'david wayne hoilett'],
    'jussi jaaskelainen': ['jussi jaaskelainen'],
    'ali al habsi': ['ali al habsi', 'ali al-habsi'],
    'marc antoine fortune': ['marc antoine fortune'],
    'christopher samba': ['christopher samba', 'chris samba'],
    'dos santos giovanni': ['giovani dos santos'],
}


def minute_distance(a, b):
    return abs(as_float(a) - as_float(b))


def resolve_name(name, fpl_minutes):
    n = norm(name)
    hits = by_norm.get(n, [])
    if len(hits) == 1:
        return hits[0], 'EXACT_NORMALIZED', 1.0
    hits = by_tokens.get(token_key(name), [])
    if len(hits) == 1:
        return hits[0], 'TOKEN_ORDER', 0.99
    for variant in alias_variants.get(n, []):
        hits = by_norm.get(norm(variant), [])
        if len(hits) == 1:
            return hits[0], 'MANUAL_ALIAS', 0.98
        hits = by_tokens.get(token_key(variant), [])
        if len(hits) == 1:
            return hits[0], 'MANUAL_ALIAS_TOKEN', 0.97

    scored = []
    for r in canonical:
        rn = norm(r['playerName'])
        sim = SequenceMatcher(None, n, rn).ratio()
        md = minute_distance(fpl_minutes, r.get('timePlayed'))
        minute_tol = max(20.0, 0.06 * max(as_float(fpl_minutes), 1.0))
        minute_score = max(0.0, 1.0 - md / max(minute_tol, 1.0))
        score = 0.84 * sim + 0.16 * minute_score
        scored.append((score, sim, md, r))
    scored.sort(key=lambda x: x[0], reverse=True)
    best, second = scored[0], scored[1]
    if (
        best[1] >= 0.86
        and best[0] - second[0] >= 0.06
        and best[2] <= max(25, 0.08 * max(as_float(fpl_minutes), 1))
    ):
        return best[3], 'FUZZY_STRICT', round(best[0], 4)
    return None, 'UNRESOLVED', round(best[0], 4)


official_dir = ROOT / 'official' / '20_5_2013'
official_files = sorted(
    (x for x in official_dir.iterdir() if x.name.isdigit()),
    key=lambda x: int(x.name),
)
official_positive = []
official_zero = 0
official_no_history = 0
parse_errors = []
for p in official_files:
    try:
        obj = json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:
        parse_errors.append((p.name, str(e)))
        continue
    hist = [row for row in obj.get('season_history', []) if row and row[0] == '2010/11']
    if not hist:
        official_no_history += 1
        continue
    row = hist[0]
    if as_float(row[1]) <= 0:
        official_zero += 1
        continue
    full_name = ' '.join(
        x for x in [obj.get('first_name', ''), obj.get('second_name', '')] if x
    ).strip()
    official_positive.append(
        {
            'archive_id': int(p.name),
            'name': full_name,
            'minutes': int(row[1]),
            'points': int(row[15]),
        }
    )

carrier_by_code = {}
carrier_conflicts = []
for season_dir in ['2016-17', '2017-18']:
    base = ROOT / 'vaastav' / 'data' / season_dir / 'players'
    if not base.exists():
        continue
    for hist in base.glob('*/history.csv'):
        try:
            with hist.open(encoding='utf-8-sig', newline='') as f:
                rows = list(csv.DictReader(f))
        except Exception:
            continue
        for row in rows:
            if row.get('season_name') != '2010/11' or as_float(row.get('minutes')) <= 0:
                continue
            code = str(row.get('element_code') or '').strip()
            if not code:
                continue
            rec = {
                'element_code': code,
                'name': hist.parent.name.replace('_', ' '),
                'minutes': int(as_float(row.get('minutes'))),
                'points': int(as_float(row.get('total_points'))),
                'source': str(hist.relative_to(ROOT / 'vaastav')),
            }
            if code in carrier_by_code:
                old = carrier_by_code[code]
                if (old['minutes'], old['points']) != (rec['minutes'], rec['points']):
                    carrier_conflicts.append([code, old, rec])
            else:
                carrier_by_code[code] = rec

official_map = []
unmatched_official = []
official_ids = set()
duplicate_official_ids = []
for rec in official_positive:
    can, method, score = resolve_name(rec['name'], rec['minutes'])
    if can is None:
        unmatched_official.append({**rec, 'method': method, 'best_score': score})
        continue
    pid = str(can['playerId'])
    if pid in official_ids:
        duplicate_official_ids.append([pid, rec['name'], can['playerName']])
    official_ids.add(pid)
    official_map.append(
        {
            'archive_id': rec['archive_id'],
            'official_name': rec['name'],
            'fpl_minutes': rec['minutes'],
            'fpl_points': rec['points'],
            'canonical_playerId': pid,
            'canonical_name': can['playerName'],
            'raw_minutes': can.get('timePlayed', ''),
            'method': method,
            'score': score,
        }
    )

carrier_ids = set()
carrier_unmatched = []
carrier_map = []
for code, rec in carrier_by_code.items():
    if code in by_id:
        can = by_id[code]
        carrier_ids.add(code)
        carrier_map.append({**rec, 'canonical_playerId': code, 'canonical_name': can['playerName'], 'method': 'SHARED_ELEMENT_CODE'})
    else:
        can, method, score = resolve_name(rec['name'], rec['minutes'])
        if can is not None:
            pid = str(can['playerId'])
            carrier_ids.add(pid)
            carrier_map.append({**rec, 'canonical_playerId': pid, 'canonical_name': can['playerName'], 'method': method})
        else:
            carrier_unmatched.append({**rec, 'method': method, 'best_score': score})

recovered_ids = official_ids | carrier_ids
unresolved = [r for r in canonical if str(r['playerId']) not in recovered_ids]


def tier(minutes):
    m = as_float(minutes)
    if m >= 1800:
        return 'A — HIGH EXPOSURE'
    if m >= 900:
        return 'B — MATERIAL'
    if m >= 300:
        return 'C — MEDIUM'
    return 'D — LOW EXPOSURE'


unresolved.sort(key=lambda r: (-as_float(r.get('timePlayed')), norm(r.get('playerName'))))


def write_csv(path, fieldnames, rows):
    with path.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)


frontier_rows = []
for idx, r in enumerate(unresolved, 1):
    frontier_rows.append(
        {
            'priority_rank': idx,
            'canonical_playerId': r.get('playerId', ''),
            'playerName': r.get('playerName', ''),
            'raw_minutes': r.get('timePlayed', ''),
            'gamesPlayed': r.get('gamesPlayed', ''),
            'starts': r.get('starts', ''),
            'goals': r.get('goals', ''),
            'raw_goalAssists': r.get('goalAssists', ''),
            'nationality': r.get('nationality', ''),
            'raw_position_DO_NOT_IMPORT': r.get('position', ''),
            'raw_team_label_DO_NOT_IMPORT': r.get('team_name', ''),
            'research_tier': tier(r.get('timePlayed')),
            'recovery_status': 'UNRESOLVED FPL-NATIVE HISTORY',
            'next_route': 'Older contemporaneous FPL archive / FPLA / preserved official JSON; do not repeat May-2013 or later-carrier sweeps',
        }
    )

write_csv(
    OUT / 'unresolved_209.csv',
    [
        'priority_rank', 'canonical_playerId', 'playerName', 'raw_minutes',
        'gamesPlayed', 'starts', 'goals', 'raw_goalAssists', 'nationality',
        'raw_position_DO_NOT_IMPORT', 'raw_team_label_DO_NOT_IMPORT',
        'research_tier', 'recovery_status', 'next_route',
    ],
    frontier_rows,
)
write_csv(
    OUT / 'official_identity_mapping.csv',
    [
        'archive_id', 'official_name', 'fpl_minutes', 'fpl_points',
        'canonical_playerId', 'canonical_name', 'raw_minutes', 'method', 'score',
    ],
    official_map,
)
write_csv(
    OUT / 'carrier_identity_mapping.csv',
    ['element_code', 'name', 'minutes', 'points', 'source', 'canonical_playerId', 'canonical_name', 'method'],
    carrier_map,
)
write_csv(
    OUT / 'official_unmatched.csv',
    ['archive_id', 'name', 'minutes', 'points', 'method', 'best_score'],
    unmatched_official,
)
write_csv(
    OUT / 'carrier_unmatched.csv',
    ['element_code', 'name', 'minutes', 'points', 'source', 'method', 'best_score'],
    carrier_unmatched,
)

overlap = official_ids & carrier_ids
audit = {
    'canonical_positive_minutes': len(canonical),
    'official_numeric_files_scanned': len(official_files),
    'official_positive_histories': len(official_positive),
    'official_zero_minute_histories': official_zero,
    'official_no_2010_11_history': official_no_history,
    'official_parse_errors': len(parse_errors),
    'official_canonical_matches': len(official_ids),
    'official_unmatched': len(unmatched_official),
    'official_duplicate_canonical_ids': len(duplicate_official_ids),
    'carrier_unique_positive_histories': len(carrier_by_code),
    'carrier_canonical_matches': len(carrier_ids),
    'carrier_unmatched': len(carrier_unmatched),
    'carrier_source_conflicts': len(carrier_conflicts),
    'official_carrier_overlap': len(overlap),
    'recovered_union': len(recovered_ids),
    'unresolved_frontier': len(unresolved),
    'expected_recovered_union': 335,
    'expected_unresolved_frontier': 209,
    'exact_checkpoint': (
        len(recovered_ids) == 335
        and len(unresolved) == 209
        and not unmatched_official
        and not carrier_unmatched
    ),
    'safety_note': 'raw position/team labels are identity clues only and must not be imported as 2010/11 FPL metadata',
    'official_source_commit': 'a607e4eb7a3002432cc39b20e0650af33dc334da',
    'carrier_source_commit': 'c2add969e11ec19002a091f8aa60164c9a255854',
}
(OUT / 'audit.json').write_text(json.dumps(audit, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(OUT / 'README.md').write_text(
    '# Temporary 2010/11 unresolved frontier\n\n'
    f"Recovered union: **{len(recovered_ids)} / 544**\n\n"
    f"Unresolved frontier: **{len(unresolved)}**\n\n"
    f"Official unmatched: **{len(unmatched_official)}**; carrier unmatched: **{len(carrier_unmatched)}**.\n\n"
    'Generated only on the temporary audit branch. Raw merged-source club/position labels are not historical FPL metadata.\n',
    encoding='utf-8',
)
print(json.dumps(audit, indent=2, ensure_ascii=False))
