import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const followup=readFileSync('drizzle/migrations/0020_sports_season_admin_activation_and_explicit_enrollment.sql','utf8');
const original=readFileSync('drizzle/migrations/0012_sports_seasons_and_goal_club_season_scope.sql','utf8');
const teams=[{team:'A-laget',tournament_id:'205403',team_id:'311',expected_teams:12,league:'5. divisjon avd. 01',club_name:'Fagerborg'},{team:'B-laget',tournament_id:'205410',team_id:'6458',expected_teams:10,league:'7. divisjon avd. 02',club_name:'Fagerborg 2'}];
async function setup(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT null::uuid$$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('test.auth_role',true)$$;
 CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE TABLE goal_club_entries(id uuid DEFAULT gen_random_uuid(),name text,is_anonymous boolean default false,is_company boolean default false,goal_guess integer,amount_per_goal integer,created_at timestamptz default now(),deleted_at timestamptz);
 INSERT INTO goal_club_entries(name) VALUES('Historical member');`);
 await db.exec(original);
 await db.query('INSERT INTO sports_seasons(season,is_active,teams) VALUES(2026,true,$1)',[JSON.stringify(teams)]);
 await db.exec(followup);
 return db;
}
test('activation keeps exactly one active season and invalid configuration rolls back',async()=>{
 const db=await setup();try{
  const next=teams.map((t,i)=>({...t,tournament_id:String(300001+i),expected_teams:i?12:14}));
  await db.query('INSERT INTO sports_seasons(season,teams) VALUES(2027,$1)',[JSON.stringify(next)]);
  await assert.rejects(db.exec('SELECT activate_sports_season(2027)'),/Administrator required/);
  await db.exec("SELECT set_config('test.auth_role','service_role',false);SELECT activate_sports_season(2027)");
  assert.deepEqual((await db.query('SELECT season FROM sports_seasons WHERE is_active')).rows,[{season:2027}]);
  await assert.rejects(db.exec('SELECT activate_sports_season(2028)'),/missing/);
  assert.deepEqual((await db.query('SELECT season FROM sports_seasons WHERE is_active')).rows,[{season:2027}]);
  await assert.rejects(db.query('INSERT INTO sports_seasons(season,teams) VALUES(2028,$1)',[JSON.stringify(next.map(t=>({...t,expected_teams:1})))]),/Invalid/);
  assert.equal((await db.query("SELECT has_function_privilege('anon','activate_sports_season(integer)','EXECUTE') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("SELECT has_function_privilege('authenticated','activate_sports_season(integer)','EXECUTE') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
test('signup resolves active season, rejects stale explicit season and preserves historical 2026 entries',async()=>{
 const db=await setup();try{
  assert.equal((await db.query("SELECT season FROM goal_club_entries WHERE name='Historical member'")).rows[0].season,2026);
  await db.query('INSERT INTO sports_seasons(season,teams) VALUES(2027,$1)',[JSON.stringify(teams)]);
  await db.exec("SELECT set_config('test.auth_role','service_role',false);SELECT activate_sports_season(2027)");
  await db.exec("INSERT INTO goal_club_entries(name) VALUES('New member')");
  assert.equal((await db.query("SELECT season FROM goal_club_entries WHERE name='New member'")).rows[0].season,2027);
  await assert.rejects(db.exec("INSERT INTO goal_club_entries(name,season) VALUES('Stale form',2026)"),/must match/);
  await db.exec("INSERT INTO goal_club_entries(name,season) VALUES('Historical member',2027)");
  assert.deepEqual((await db.query("SELECT season FROM goal_club_entries WHERE name='Historical member' ORDER BY season")).rows,[{season:2026},{season:2027}]);
 }finally{await db.close();}
});