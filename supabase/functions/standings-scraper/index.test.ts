import manifest from '../../../public/sports-season.json' with {type:'json'};
import {validateSportsSeason} from '../_shared/sportsSeason.ts';
const config=validateSportsSeason(manifest);
import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createHandler, parseStandingsHtml } from './index.ts';
import { SourceUnavailableError } from '../_shared/sourceAvailability.ts';
Deno.test('Standings missing or partial source is explicit SOURCE_UNAVAILABLE', () => {
  assertThrows(() => parseStandingsHtml('<html/>', 'A-laget', 'test',config), SourceUnavailableError);
  assertThrows(() => parseStandingsHtml('<div class="a_tableStandings"><table class="tablesorter"><tbody></tbody></table></div>', 'B-laget', 'test',config), SourceUnavailableError);
});
Deno.test('Standings one complete team and one incomplete team: no deletes/writes or last_success', async () => {
  const writes: any[] = [];
  const db = { from: () => ({ upsert: (row: any) => { writes.push(row); return Promise.resolve({ error: null }); }, delete: () => { throw new Error('must not delete'); } }) };
  const response = await createHandler({ config, env: () => 'test', createClient: () => db, auth: async () => null,
    scrape: async (_id: string, team: string) => Array.from({ length: team === 'A-laget' ? 12 : 0 }, () => ({})) })(new Request('https://test'));
  assertEquals(response.status, 200); assertEquals((await response.json()).source_unavailable, true);
  assertEquals(writes.some(w => 'last_success_at' in w), false);
});
Deno.test('Standings programming errors are fatal', async () => {
  const response = await createHandler({ config, env: () => 'test', createClient: () => ({ from: () => ({ upsert: async () => ({ error: null }) }) }),
    auth: async () => null, scrape: async () => { throw new TypeError('bug'); } })(new Request('https://test'));
  assertEquals(response.status, 500); await response.text();
});

function validRows(team: string) {
  return Array.from({ length: team === 'A-laget' ? 12 : 10 }, (_, i) => ({
    team, team_name: i === 0 ? (team === 'A-laget' ? 'Fagerborg' : 'Fagerborg 2') : `Team ${i}`,
    position: i + 1, season: '2026',
  }));
}
function testDb(rpcError: unknown = null, bComplete = false, existingHistory: any = null) {
  let stored = [...validRows('A-laget'), ...validRows('B-laget')];
  const history: any[] = [];
  const updates: any[] = [];
  const statuses: any[] = [];
  const db = {
    rpc: async (name: string, args: any) => {
      assertEquals(name, 'replace_sports_standings');
      if (!rpcError) stored = args.p_rows;
      return { data: rpcError ? null : 22, error: rpcError };
    },
    from: (table: string) => {
      if (table === 'standings') throw new Error('Separate standings writes forbidden');
      if (table === 'sync_status') return { upsert: async (row: any) => { statuses.push(row); return { error: null }; } };
      if (table === 'historical_standings') return {
        select: () => { const q: any = { eq: () => q, maybeSingle: async () => ({ data: existingHistory, error: null }) }; return q; },
        insert: async (row: any) => { history.push(row); return { error: null }; },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null }; } }),
      };
      return { select: () => {
        let id = ''; let unfinished = false;
        const q: any = { eq: (_: string, value: string) => { id = value; return q; },
          neq: () => { unfinished = true; return q; }, then: (resolve: any) => resolve({ error: null,
            count: unfinished ? (id === '205410' && bComplete ? 0 : 1) : (id === '205410' ? 90 : 132) }) };
        return q;
      } };
    },
  };
  return { db, history, updates, statuses, stored: () => stored };
}
Deno.test('Standings complete 12+10 uses exactly one RPC and B 90-match season-complete saves history', async () => {
  const fake = testDb(null, true);
  const response = await createHandler({ config, env: () => 'test', createClient: () => fake.db, auth: async () => null,
    scrape: async (_id: string, team: string) => validRows(team) })(new Request('https://test'));
  assertEquals(response.status, 200); assertEquals((await response.json()).success, true);
  assertEquals(fake.stored().length, 22);
  assertEquals(fake.history.map(r => [r.team, r.year, r.position, r.result]), [['B-laget', 2026, 1, null]]);
  assertEquals(fake.history[0].table_url, 'https://www.fotball.no/fotballdata/turnering/tabell/?fiksId=205410');
  assertEquals(fake.statuses[0].last_error, null);
});
Deno.test('Standings RPC DB failure preserves old 22 rows and records useful JSON, returning 500', async () => {
  const fake = testDb({ code: '23505', message: 'insert conflict', details: 'duplicate row' });
  const old = fake.stored();
  const response = await createHandler({ config, env: () => 'test', createClient: () => fake.db, auth: async () => null,
    scrape: async (_id: string, team: string) => validRows(team) })(new Request('https://test'));
  assertEquals(response.status, 500); await response.text();
  assertEquals(fake.stored(), old);
  assertEquals(JSON.parse(fake.statuses[0].last_error).message, 'insert conflict');
  assertEquals('last_success_at' in fake.statuses[0], false);
});
Deno.test('Standings source unavailable preserves old rows without RPC', async () => {
  const fake = testDb(); const old = fake.stored();
  const response = await createHandler({ config, env: () => 'test', createClient: () => fake.db, auth: async () => null,
    scrape: async () => { throw new SourceUnavailableError('fotball.no offline'); } })(new Request('https://test'));
  assertEquals(response.status, 200); assertEquals((await response.json()).source_unavailable, true);
  assertEquals(fake.stored(), old); assertEquals('last_success_at' in fake.statuses[0], false);
});
Deno.test('Standings invalid auth is 401 and never runs replacement', async () => {
  const fake = testDb(); const old = fake.stored();
  const response = await createHandler({ config, env: () => 'test', createClient: () => fake.db,
    auth: async () => new Response('', { status: 401 }) })(new Request('https://test'));
  assertEquals(response.status, 401); await response.text(); assertEquals(fake.stored(), old);
});
Deno.test('Season-complete update sets position/division/table_url and never touches manual result', async () => {
  const fake = testDb(null, true, { id: 'h1', position: 9, result: 'relegation', locked: false });
  const response = await createHandler({ config, env: () => 'test', createClient: () => fake.db, auth: async () => null,
    scrape: async (_id: string, team: string) => validRows(team) })(new Request('https://test'));
  assertEquals(response.status, 200); await response.json();
  assertEquals(fake.history.length, 0);
  assertEquals(fake.updates.length, 1);
  assertEquals('result' in fake.updates[0], false);
  assertEquals(fake.updates[0].position, 1);
  assertEquals(typeof fake.updates[0].division, 'string');
  assertEquals(fake.updates[0].table_url, 'https://www.fotball.no/fotballdata/turnering/tabell/?fiksId=205410');
});
