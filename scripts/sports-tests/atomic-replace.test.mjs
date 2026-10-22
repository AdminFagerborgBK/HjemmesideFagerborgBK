import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('drizzle/migrations/0011_sports_atomic_replace_and_trigger_hardening.sql', 'utf8');
function rows(marker = 'old') {
  return ['A-laget', 'B-laget'].flatMap(team => Array.from({ length: team === 'A-laget' ? 12 : 10 }, (_, i) => ({
    team, team_name: i === 0 ? (team === 'A-laget' ? 'Fagerborg' : 'Fagerborg 2') : `${marker} ${i}`,
    position: i + 1, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0,
    goal_difference: 0, points: 0, league: 'Test league', season: '2026', form: [],
  })));
}
async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA extensions; CREATE SCHEMA net;
    CREATE TABLE public.standings(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      team text NOT NULL,team_name text NOT NULL,position integer NOT NULL,played integer NOT NULL,
      won integer NOT NULL,drawn integer NOT NULL,lost integer NOT NULL,goals_for integer NOT NULL,
      goals_against integer NOT NULL,goal_difference integer NOT NULL,points integer NOT NULL,
      form text[],league text NOT NULL,season text NOT NULL,logo_url text,team_url text);
    CREATE TABLE public.division_matches(fiks_id text CONSTRAINT division_matches_fiks_id_key UNIQUE,division_fiks_id text);
    CREATE TABLE public.goal_club_season_closures(season integer);
    CREATE TABLE public.site_settings(key text,value jsonb);
    CREATE TABLE public.matches(team text,status text);
    CREATE TABLE public.trigger_calls(body jsonb);
    CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb) RETURNS bigint LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO public.trigger_calls VALUES(body); RETURN 1; END; $$;
    INSERT INTO public.site_settings VALUES ('cron_sync_secret','"test-only"'),('functions_base_url','"https://test.invalid"');`);
  await db.exec(migration);
  await db.exec(`CREATE TRIGGER test_goal_standings AFTER INSERT ON public.standings FOR EACH ROW
      WHEN (NEW.team_name='Fagerborg') EXECUTE FUNCTION public.trigger_goal_club_season_close();
    CREATE TRIGGER test_goal_matches AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.trigger_goal_club_season_close();`);
  await db.query('SELECT public.replace_sports_standings($1::jsonb)', [JSON.stringify(rows())]);
  return db;
}
const snapshot = async db => (await db.query('SELECT * FROM standings ORDER BY team,position')).rows;

test('standings replacement succeeds with exactly 12 A + 10 B and rejects duplicate positions', async () => {
  const db = await setup();
  try {
    const result = await db.query('SELECT replace_sports_standings($1::jsonb) AS count', [JSON.stringify(rows('new'))]);
    assert.equal(result.rows[0].count, 22);
    assert.deepEqual((await db.query('SELECT team,count(*)::integer AS count FROM standings GROUP BY team ORDER BY team')).rows,
      [{team:'A-laget',count:12},{team:'B-laget',count:10}]);
    const before = await snapshot(db);
    const bad = rows('bad'); bad[1].position = 1;
    await assert.rejects(db.query('SELECT replace_sports_standings($1::jsonb)', [JSON.stringify(bad)]), /unique/);
    assert.deepEqual(await snapshot(db), before);
  } finally { await db.close(); }
});
test('insert failure after DELETE rolls the whole RPC back to the previous 22 rows', async () => {
  const db = await setup();
  try {
    const before = await snapshot(db);
    await db.exec(`CREATE FUNCTION public.fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.team='B-laget' AND NEW.position=10 THEN RAISE EXCEPTION 'injected insert failure'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER fail_insert BEFORE INSERT ON standings FOR EACH ROW EXECUTE FUNCTION public.fail_insert();`);
    await assert.rejects(db.query('SELECT replace_sports_standings($1::jsonb)', [JSON.stringify(rows('new'))]), /injected insert failure/);
    assert.deepEqual(await snapshot(db), before);
  } finally { await db.close(); }
});
test('goal-club trigger executes on standings INSERT/UPDATE and matches transition with no missing-column error', async () => {
  const db = await setup();
  try {
    await db.exec(`CREATE TRIGGER test_goal_standings_update AFTER UPDATE ON standings FOR EACH ROW
      WHEN (NEW.team_name='Fagerborg' AND NEW.played IS DISTINCT FROM OLD.played) EXECUTE FUNCTION public.trigger_goal_club_season_close();
      UPDATE standings SET played=1,drawn=1 WHERE team='A-laget' AND team_name='Fagerborg';
      INSERT INTO matches VALUES('A-laget','upcoming'),('B-laget','upcoming');
      UPDATE matches SET status='finished';`);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM trigger_calls')).rows[0].count, 3);
    await db.exec("UPDATE matches SET status='finished';");
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM trigger_calls')).rows[0].count, 3);
  } finally { await db.close(); }
});
test('standings RPC has no PUBLIC/anon/authenticated access; identical match ids in different divisions coexist', async () => {
  const db = await setup();
  try {
    for (const role of ['anon','authenticated']) {
      assert.equal((await db.query(`SELECT has_function_privilege('${role}','public.replace_sports_standings(jsonb)','EXECUTE') AS allowed`)).rows[0].allowed, false);
    }
    assert.equal((await db.query("SELECT has_function_privilege('service_role','public.replace_sports_standings(jsonb)','EXECUTE') AS allowed")).rows[0].allowed, true);
    await db.exec("INSERT INTO division_matches VALUES ('same-id','205403'),('same-id','205410');");
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM division_matches')).rows[0].count, 2);
  } finally { await db.close(); }
});
