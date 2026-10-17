import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createHandler } from './index.ts';

function fixture(fetchImpl: typeof fetch, errorTable?: string, unauthorized = false, failWriteOnly = false) {
  const writes: any[] = [];
  const db = { from(table: string) {
    const result = { data: null, error: table === errorTable ? { message: 'database failed' } : null };
    const query: any = {
      select() { return query; }, eq() { return query; }, maybeSingle() { return Promise.resolve(failWriteOnly ? { data: null, error: null } : result); },
      update(row: any) { writes.push({ table, row }); return query; },
      insert(row: any) { writes.push({ table, row }); return Promise.resolve(result); },
      upsert(row: any) { writes.push({ table, row }); return Promise.resolve(result); },
      then(resolve: any) { return Promise.resolve(result).then(resolve); },
    };
    return query;
  } };
  const handler = createHandler({ createClient: () => db, env: () => 'test', auth: async () => unauthorized ? new Response('', { status: 401 }) : null,
    now: () => new Date('2026-10-17T08:14:00Z'), fetch: fetchImpl, sleep: async () => {} });
  return { handler, writes };
}
const good = { id: 996145530, status: 'ACTIVE', statistics: Array.from({ length: 17 }, (_, i) => ({ year: 2010 + i, amount: 123.45, numberOfPersons: 42 })) };
for (const kind of ['timeout', 'http500', 'invalid-json', 'empty', 'invalid-row']) {
  Deno.test(`Grasrot ${kind}: 2xx SOURCE_UNAVAILABLE, no yearly overwrite or success`, async () => {
    let calls = 0;
    const { handler, writes } = fixture((async () => {
      calls++;
      if (kind === 'timeout') throw new DOMException('timeout', 'TimeoutError');
      return new Response(kind === 'invalid-json' ? '<html>' : JSON.stringify(kind === 'empty' ? {} : kind === 'invalid-row' ? { statistics: [{ year: 2026 }] } : good), { status: kind === 'http500' ? 500 : 200 });
    }) as typeof fetch);
    const response = await handler(new Request('https://test', { method: 'POST' }));
    assertEquals(response.status, 200);
    assertEquals((await response.json()).source_unavailable, true);
    assertEquals(calls, 3);
    assertEquals(writes.filter(w => w.table === 'grasrot_yearly').length, 0);
    assertEquals(writes.some(w => 'last_success_at' in w.row), false);
  });
}
Deno.test('Grasrot wrong secret returns 401 without source fetch', async () => {
  let calls = 0;
  const { handler } = fixture((async () => { calls++; return new Response(); }) as typeof fetch, undefined, true);
  const response = await handler(new Request('https://test'));
  assertEquals(response.status, 401); await response.text(); assertEquals(calls, 0);
});
for (const table of ['grasrot_yearly', 'grasrot_fetch_status', 'sync_status']) {
  Deno.test(`Grasrot ${table} database error is 500`, async () => {
    const { handler } = fixture((async () => new Response(JSON.stringify(good))) as typeof fetch, table);
    const response = await handler(new Request('https://test'));
    assertEquals(response.status, 500); await response.text();
  });
}
Deno.test('Grasrot successful source updates concrete values and marks success', async () => {
  const { handler, writes } = fixture((async () => new Response(JSON.stringify(good))) as typeof fetch);
  const response = await handler(new Request('https://test'));
  assertEquals(response.status, 200); assertEquals((await response.json()).success, true);
  assertEquals(writes.find(w => w.table === 'grasrot_yearly')?.row.amount_nok, 123.45);
  assertEquals(writes.find(w => w.table === 'grasrot_yearly')?.row.num_supporters, 42);
  assertEquals(writes.filter(w => 'last_success_at' in w.row).length, 2);
});
Deno.test('Grasrot programming error and missing config stay fatal', async () => {
  const { handler } = fixture((async () => { throw new Error('programming bug'); }) as typeof fetch);
  const response = await handler(new Request('https://test')); assertEquals(response.status, 500); await response.text();
  const missing = await createHandler({ env: () => undefined })(new Request('https://test')); assertEquals(missing.status, 500); await missing.text();
});

Deno.test('Grasrot yearly insert failure is 500, never success', async () => {
  const { handler, writes } = fixture((async () => new Response(JSON.stringify(good))) as typeof fetch, 'grasrot_yearly', false, true);
  const response = await handler(new Request('https://test')); assertEquals(response.status, 500); await response.text();
  assertEquals(writes.some(w => 'last_success_at' in w.row), false);
});
