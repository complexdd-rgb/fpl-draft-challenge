"""Real migration/concurrency checks against a disposable local PostgreSQL database."""
import concurrent.futures
import json
import os
import subprocess
from urllib.parse import urlparse

url = os.environ['AUDIT_DATABASE_URL']
if urlparse(url).hostname not in ('localhost', '127.0.0.1'):
    raise RuntimeError('Ledger checks require a disposable local database')

def sql(statement, expect_error=False):
    p = subprocess.run(['psql', url, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', statement], capture_output=True, text=True)
    if expect_error:
        assert p.returncode != 0, 'Expected accounting conflict'
        return p.stderr
    if p.returncode:
        raise RuntimeError(p.stderr)
    return p.stdout.strip()

sql('create role anon; create role authenticated; create role service_role;')
for path in ['supabase/migrations/20260810093000_leaderboard_schema.sql', 'supabase/migrations/20260812151000_leaderboard_team_selections.sql', 'supabase/migrations/20261014120000_leaderboard_event_ledger.sql']:
    subprocess.run(['psql', url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path], check=True)

sql("""
insert into public.leaderboard_verifiers(challenge_id,release_date,perfect_score,payload)
select 'ledger-fixture',(now() at time zone 'Europe/London')::date,110,
jsonb_build_object('perfectScore',110,'prompts',jsonb_agg(jsonb_build_object('promptId','p'||i,'position','MID','bestPoints',10,'allowed',jsonb_build_array(jsonb_build_object('playerId','player'||i,'season','2024/25','points',10))))) from generate_series(0,10) i;
insert into public.leaderboard_attempts(id,challenge_id,client_id,started_at)
values('00000000-0000-4000-8000-000000000001','ledger-fixture','guest-fixture',now()-interval '43 seconds');
""")
base="'00000000-0000-4000-8000-000000000001','ledger-fixture',array['guest-fixture']"
def pick(event, player='bad', prompt='p0', skipped=False):
    # All input values in this test are fixed, local fixture literals.
    season='' if skipped else '2024/25'
    return f"select public.record_leaderboard_pick({base},'{event}','{prompt}','{player}','{season}',{str(skipped).lower()});"
selections=json.dumps([{'promptId':f'p{i}','playerId':f'player{i}','season':'2024/25'} for i in range(11)])
complete=f"select public.complete_leaderboard_attempt({base},'{selections}'::jsonb);"
assert 'matching recorded pick' in sql(complete, True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(sql,[pick('invalid-1'),pick('invalid-2')]))
assert sql('select penalty_points from public.leaderboard_attempts')=='20', 'Concurrent penalties lost an increment'
sql(pick('invalid-1')); assert sql('select count(*) from public.leaderboard_attempt_events')=='2'
assert 'Event ID already used' in sql(pick('invalid-1','different'),True)
for i in range(11): sql(pick(f'valid-event-{i}',f'player{i}',f'p{i}'))
assert sql('select penalty_points from public.leaderboard_attempts')=='20', 'A valid event overwrote penalties'
result=json.loads(sql(complete));assert result['finalScore']==90 and result['penaltyPoints']==20
sql("update public.leaderboard_attempts set started_at=started_at-interval '5 minutes'")
assert json.loads(sql(complete))==result, 'Later submission changed the completion snapshot'
assert 'already completed' in sql(pick('after-completion','player0'),True)
assert sql("select has_function_privilege('anon','public.record_leaderboard_pick(uuid,text,text[],text,text,text,text,boolean)','execute')")=='f'
assert sql("select has_function_privilege('authenticated','public.complete_leaderboard_attempt(uuid,text,text[],jsonb)','execute')")=='f'
assert sql("select has_table_privilege('anon','public.leaderboard_attempt_events','select')")=='f'
assert sql("select has_function_privilege('service_role','public.complete_leaderboard_attempt(uuid,text,text[],jsonb)','execute')")=='t'
print('PASS real PostgreSQL locking, idempotence, completion freeze and RPC permissions')
