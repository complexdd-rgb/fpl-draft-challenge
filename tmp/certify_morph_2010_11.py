import csv, json, re, unicodedata
from collections import defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

ROOT=Path('/tmp/fpl2010-frontier')
OUT=Path('tmp/morph-2010-11-certification')
FRONT=Path('tmp/2010-11-frontier-output/unresolved_209.csv')
OUT.mkdir(parents=True, exist_ok=True)

def norm(s):
    s=unicodedata.normalize('NFKD',str(s or ''))
    s=''.join(c for c in s if not unicodedata.combining(c))
    s=s.lower().replace('&',' and ')
    s=re.sub(r'[^a-z0-9]+',' ',s)
    return ' '.join(s.split())

def token(s): return ' '.join(sorted(norm(s).split()))
def asint(v):
    try:return int(float(str(v or 0).strip()))
    except:return 0

team_alias={
    'arsenal':'arsenal','aston villa':'aston villa','birmingham':'birmingham city','birmingham city':'birmingham city',
    'blackburn':'blackburn rovers','blackburn rovers':'blackburn rovers','blackpool':'blackpool','bolton':'bolton wanderers',
    'bolton wanderers':'bolton wanderers','chelsea':'chelsea','everton':'everton','fulham':'fulham','liverpool':'liverpool',
    'man city':'manchester city','manchester city':'manchester city','man united':'manchester united','man utd':'manchester united',
    'manchester united':'manchester united','newcastle':'newcastle united','newcastle united':'newcastle united',
    'stoke':'stoke city','stoke city':'stoke city','sunderland':'sunderland','tottenham':'tottenham hotspur',
    'tottenham hotspur':'tottenham hotspur','west brom':'west bromwich albion','west bromwich albion':'west bromwich albion',
    'west ham':'west ham united','west ham united':'west ham united','wigan':'wigan athletic','wigan athletic':'wigan athletic',
    'wolves':'wolverhampton wanderers','wolverhampton wanderers':'wolverhampton wanderers'
}
opp_alias={
    'ARS':'arsenal','AVL':'aston villa','BIR':'birmingham city','BLA':'blackburn rovers','BLP':'blackpool','BOL':'bolton wanderers',
    'CHE':'chelsea','EVE':'everton','FUL':'fulham','LIV':'liverpool','MCI':'manchester city','MUN':'manchester united',
    'NEW':'newcastle united','STK':'stoke city','SUN':'sunderland','TOT':'tottenham hotspur','WBA':'west bromwich albion',
    'WHU':'west ham united','WIG':'wigan athletic','WOL':'wolverhampton wanderers'
}
months={'jan':1,'january':1,'feb':2,'february':2,'mar':3,'march':3,'apr':4,'april':4,'may':5,'jun':6,'june':6,'jul':7,'july':7,'aug':8,'august':8,'sep':9,'sept':9,'september':9,'oct':10,'october':10,'nov':11,'november':11,'dec':12,'december':12}

def cteam(s):
    n=norm(s)
    if n.endswith(' afc'): n=n[:-4]
    if n.endswith(' fc'): n=n[:-3]
    return team_alias.get(n,n)

fixture_keys=set()
with (ROOT/'fixtures.csv').open(encoding='utf-8-sig',newline='') as f:
    for r in csv.DictReader(f):
        dt=datetime.strptime(r['Date'],'%a %b %d %Y').date().isoformat()
        h=cteam(r['Team 1']); a=cteam(r['Team 2']); hg,ag=[int(x) for x in r['FT'].split('-')]
        fixture_keys.add((dt,h,a,'H',hg,ag)); fixture_keys.add((dt,a,h,'A',ag,hg))
if len(fixture_keys)!=760: raise RuntimeError(f'fixture keys {len(fixture_keys)}')

with FRONT.open(encoding='utf-8-sig',newline='') as f: frontier=list(csv.DictReader(f))
if len(frontier)!=209: raise RuntimeError(f'frontier {len(frontier)}')
f_by_norm=defaultdict(list); f_by_tok=defaultdict(list)
for r in frontier:
    f_by_norm[norm(r['playerName'])].append(r); f_by_tok[token(r['playerName'])].append(r)

known20={
    norm('Johan Elmander'):7,norm('Nicolas Anelka'):6,norm('Kevin Phillips'):1,norm('Niko Kranjcar'):0,
    norm('Karl Henry'):2,norm('Paul Konchesky'):1,norm('Didier Drogba'):15,norm('Dedryck Boyata'):0,
    norm('Gary Taylor-Fletcher'):7,norm('Abdoulaye Faye'):0,norm('Dirk Kuyt'):8,norm('Asamoah Gyan'):5,
    norm('Jermaine Beckford'):3,norm('Scott Carson'):0,norm('Matthew Gilks'):0,norm('Richard Stearman'):0,
    norm('Chris Basham'):0,norm('Rodrigo Moreno'):1,norm('Danny Gabbidon'):0,norm('Kagisho Dikgacoi'):0
}

def morph_name(r):
    first=(r.get('first_name') or '').strip(); last=(r.get('last_name') or '').strip(); lt=last.split()
    if len(lt)>1 and len(lt[-1])==1 and first and lt[-1].lower()==first[0].lower(): last=' '.join(lt[:-1])
    return ' '.join(x for x in [first,last] if x).strip()

manual_alias={
    norm('Rodrigo Rodrigo'):'Rodrigo Moreno',norm('Rodrigo'):'Rodrigo Moreno',norm('Gary Taylor Fletcher'):'Gary Taylor-Fletcher',
    norm('Matt Gilks'):'Matthew Gilks',norm('Danny Gabbidon'):'Daniel Gabbidon',norm('Chris Basham'):'Christopher Basham'
}

def resolve(name, mins):
    n=norm(name); t=token(name)
    if n in manual_alias: n=norm(manual_alias[n]); t=token(manual_alias[n])
    if len(f_by_norm.get(n,[]))==1:return f_by_norm[n][0],'EXACT'
    if len(f_by_tok.get(t,[]))==1:return f_by_tok[t][0],'TOKEN'
    scored=[]
    for r in frontier:
        sim=SequenceMatcher(None,n,norm(r['playerName'])).ratio(); md=abs(mins-asint(r['raw_minutes']))
        minute_score=max(0,1-md/max(25,0.08*max(mins,1))); score=.88*sim+.12*minute_score
        scored.append((score,sim,md,r))
    scored.sort(key=lambda x:x[0],reverse=True)
    if scored and scored[0][1]>=.88 and scored[0][2]<=max(25,.08*max(mins,1)) and (len(scored)<2 or scored[0][0]-scored[1][0]>=.05):
        return scored[0][3],'FUZZY_STRICT'
    return None,''

result_re=re.compile(r'^([A-Z]+)\(([HA])\)\s+(\d+)-(\d+)$'); date_re=re.compile(r'^(\d{1,2})\s+([A-Za-z.]+)')
classified=[]; rejected=defaultdict(int)
with (ROOT/'morph.csv').open(encoding='utf-8-sig',newline='') as f:
    for r in csv.DictReader(f):
        tm=cteam(r.get('team_name_1') or ''); rm=result_re.match((r.get('result') or '').strip()); dm=date_re.match((r.get('date') or '').strip())
        if not tm or not rm or not dm: rejected['parse']+=1; continue
        opp=opp_alias.get(rm.group(1))
        if not opp: rejected['opponent']+=1; continue
        venue=rm.group(2); tscore=int(rm.group(3)); oscore=int(rm.group(4)); mon=months.get(dm.group(2).lower().rstrip('.'))
        if not mon: rejected['month']+=1; continue
        day=int(dm.group(1)); year=2010 if mon>=8 else 2011; dt=f'{year:04d}-{mon:02d}-{day:02d}'
        if (dt,tm,opp,venue,tscore,oscore) not in fixture_keys: rejected['fixture_no_match']+=1; continue
        rr=dict(r); rr['_morph_name']=morph_name(r); rr['_fixture_date']=dt; rr['_team']=tm; rr['_opp']=opp; rr['_venue']=venue; classified.append(rr)

grouped=defaultdict(list)
for r in classified: grouped[norm(r['_morph_name'])].append(r)
exact=[]; partial=[]; known_validation=[]; unresolved_name_rows=[]
for rows in grouped.values():
    name=rows[0]['_morph_name']; mins=sum(asint(x.get('minutes_played')) for x in rows); assists=sum(asint(x.get('assists')) for x in rows); pts=sum(asint(x.get('points')) for x in rows)
    can,method=resolve(name,mins)
    if can is None:
        unresolved_name_rows.append({'morph_name':name,'morph_minutes':mins,'morph_assists':assists,'rows':len(rows)}); continue
    cmins=asint(can['raw_minutes']); delta=mins-cmins; complete=(delta==0 and cmins>0)
    rec={'priority_rank':can['priority_rank'],'canonical_playerId':can['canonical_playerId'],'canonical_name':can['playerName'],'morph_name':name,'match_method':method,'canonical_minutes':cmins,'morph_2010_11_minutes':mins,'minute_delta':delta,'morph_2010_11_assists':assists,'morph_2010_11_points':pts,'classified_rows':len(rows),'status':'EXACT_COMPLETE' if complete else 'PARTIAL'}
    (exact if complete else partial).append(rec)
    kn=norm(can['playerName'])
    if kn in known20: known_validation.append({**rec,'known_assists':known20[kn],'assist_match':assists==known20[kn]})

exact.sort(key=lambda r:int(r['priority_rank'])); partial.sort(key=lambda r:int(r['priority_rank']))
known_names=set(known20); new_exact=[r for r in exact if norm(r['canonical_name']) not in known_names]; overlap_exact=[r for r in exact if norm(r['canonical_name']) in known_names]

def write(name,rows,fields=None):
    if fields is None: fields=list(rows[0].keys()) if rows else ['canonical_name']
    with (OUT/name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore'); w.writeheader(); w.writerows(rows)
write('exact_complete_all_frontier.csv',exact); write('new_exact_beyond_current20.csv',new_exact); write('exact_overlap_current20.csv',overlap_exact); write('partial_frontier_candidates.csv',partial); write('known20_validation.csv',known_validation); write('unresolved_morph_names.csv',unresolved_name_rows)

exact_norm={norm(r['morph_name']) for r in exact}; evidence=[]
for r in classified:
    if norm(r['_morph_name']) in exact_norm:
        evidence.append({'morph_name':r['_morph_name'],'date':r.get('date',''),'fixture_date':r['_fixture_date'],'team':r['_team'],'result':r.get('result',''),'week':r.get('week',''),'minutes':r.get('minutes_played',''),'assists':r.get('assists',''),'points':r.get('points','')})
write('exact_fixture_evidence.csv',evidence)

audit={'morph_rows_total':sum(1 for _ in (ROOT/'morph.csv').open(encoding='utf-8-sig'))-1,'fixture_classified_rows':len(classified),'frontier_players_with_classified_rows':len(exact)+len(partial),'exact_complete_frontier_players':len(exact),'exact_overlap_current20':len(overlap_exact),'new_exact_beyond_current20':len(new_exact),'partial_frontier_players':len(partial),'unresolved_morph_name_groups':len(unresolved_name_rows),'known20_validation_rows':len(known_validation),'known20_validation_all_assists_match':all(x['assist_match'] for x in known_validation) if known_validation else None,'rejected':dict(rejected),'certification_rule':'Exact only when Morph row matches a 2010/11 fixture by date/team/opponent/venue/final score AND summed classified Morph minutes equal canonical 2010/11 minutes.','safety':'Do not promote PARTIAL rows as final FPL assists.'}
(OUT/'audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
