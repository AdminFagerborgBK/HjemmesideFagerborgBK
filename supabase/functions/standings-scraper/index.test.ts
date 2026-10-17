import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createHandler, parseStandingsHtml } from './index.ts';
import { SourceUnavailableError } from '../_shared/sourceAvailability.ts';
Deno.test('Standings missing or partial source is explicit SOURCE_UNAVAILABLE', () => {
  assertThrows(() => parseStandingsHtml('<html/>', 'A-laget', 'test'), SourceUnavailableError);
  assertThrows(() => parseStandingsHtml('<div class="a_tableStandings"><table class="tablesorter"><tbody></tbody></table></div>', 'B-laget', 'test'), SourceUnavailableError);
});
Deno.test('Standings one complete team and one incomplete team: no deletes/writes or last_success', async () => {
  const writes: any[] = [];
  const db = { from: () => ({ upsert: (row: any) => { writes.push(row); return Promise.resolve({ error: null }); }, delete: () => { throw new Error('must not delete'); } }) };
  const response = await createHandler({ env: () => 'test', createClient: () => db, auth: async () => null,
    scrape: async (_id: string, team: string) => Array.from({ length: team === 'A-laget' ? 12 : 0 }, () => ({})) })(new Request('https://test'));
  assertEquals(response.status, 200); assertEquals((await response.json()).source_unavailable, true);
  assertEquals(writes.some(w => 'last_success_at' in w), false);
});
Deno.test('Standings programming errors are fatal', async () => {
  const response = await createHandler({ env: () => 'test', createClient: () => ({ from: () => ({ upsert: async () => ({ error: null }) }) }),
    auth: async () => null, scrape: async () => { throw new TypeError('bug'); } })(new Request('https://test'));
  assertEquals(response.status, 500); await response.text();
});
