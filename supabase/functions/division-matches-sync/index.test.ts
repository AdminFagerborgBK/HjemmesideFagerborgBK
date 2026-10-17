import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createHandler, parseExcel } from './index.ts';
import { SourceUnavailableError } from '../_shared/sourceAvailability.ts';
Deno.test('Division non-XLSX is explicit source unavailable', () => {
  assertThrows(() => parseExcel(new TextEncoder().encode('<html>').buffer), SourceUnavailableError);
});
for (const source of [true, false]) {
  Deno.test(`Division ${source ? 'source unavailable retains data' : 'programming error is fatal'}`, async () => {
    let matchWrites = 0;
    const db = { from: (table: string) => ({ upsert: async () => { if (table === 'division_matches') matchWrites++; return { error: null }; } }) };
    const response = await createHandler({ env: () => 'test', createClient: () => db, auth: async () => null,
      load: async () => { throw source ? new SourceUnavailableError('offline') : new TypeError('bug'); } })(new Request('https://test'));
    assertEquals(response.status, source ? 200 : 500); await response.text(); assertEquals(matchWrites, 0);
  });
}
