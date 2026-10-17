import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, loadTeamPage, SourceUnavailableError, fingerprint } from './scraper.mjs';

const matches = [{ team: 'A-laget', fiks_id: '123', opponent: 'Test' }];
const config = { SUPABASE_PROJECT_URL: 'https://backend.example', MATCHES_SYNC_SECRET: 'test-only' };

async function run(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'matches-errors-'));
  const file = join(dir, 'fingerprint.txt');
  const output = join(dir, 'output.txt');
  writeFileSync(file, options.previous || 'old-fingerprint');
  let calls = 0;
  let scrapes = 0;
  try {
    const code = await main({
      env: { ...config, GITHUB_OUTPUT: output, ...options.env },
      fingerprintFile: file,
      scrape: async () => { scrapes++; return options.scrape ? options.scrape() : matches; },
      fetchImpl: async () => {
        calls++;
        return new Response(JSON.stringify(options.body || { updated_count: 1 }), { status: options.status || 200 });
      },
    });
    return { code, calls, scrapes, fingerprint: readFileSync(file, 'utf8'), output: readFileSync(output, 'utf8') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('source retries exhaust at 3 and return SOURCE_UNAVAILABLE', async () => {
  let attempts = 0;
  let screenshots = 0;
  const page = {
    goto: async () => { attempts++; const error = new Error('page.goto timeout'); error.name = 'TimeoutError'; throw error; },
    waitForTimeout: async () => {},
    screenshot: async () => { screenshots++; },
  };
  await assert.rejects(loadTeamPage(page, { name: 'A-laget', fiksId: '311' }), SourceUnavailableError);
  assert.equal(attempts, 3);
  assert.equal(screenshots, 1);
});

test('incomplete source content retries 3 times', async () => {
  let reads = 0;
  const page = {
    goto: async () => ({ ok: () => true }),
    waitForSelector: async () => {}, waitForFunction: async () => {},
    waitForTimeout: async () => {}, screenshot: async () => {},
  };
  await assert.rejects(loadTeamPage(page, { name: 'B-laget', fiksId: '6458' }, async () => {
    reads++; throw new SourceUnavailableError('incomplete table');
  }), SourceUnavailableError);
  assert.equal(reads, 3);
});

test('unexpected page programming error is not classified as source failure', async () => {
  let attempts = 0;
  await assert.rejects(loadTeamPage({ goto: async () => { attempts++; throw new TypeError('code bug'); } },
    { name: 'A-laget', fiksId: '311' }), TypeError);
  assert.equal(attempts, 1);
});

test('source unavailable exits 0 without backend call or fingerprint update', async () => {
  const result = await run({ scrape: () => { throw new SourceUnavailableError('fotball.no timeout'); } });
  assert.equal(result.code, 0);
  assert.equal(result.calls, 0);
  assert.equal(result.fingerprint, 'old-fingerprint');
  assert.match(result.output, /source_unavailable=true/);
  assert.doesNotMatch(result.output, /scrape_success=true/);
});

test('empty source data exits 0 without backend call or fingerprint update', async () => {
  const result = await run({ scrape: () => [] });
  assert.equal(result.code, 0);
  assert.equal(result.calls, 0);
  assert.equal(result.fingerprint, 'old-fingerprint');
});

test('missing backend URL exits 1 even before source fetch', async () => {
  const result = await run({ env: { SUPABASE_PROJECT_URL: '', SUPABASE_URL: '' } });
  assert.equal(result.code, 1);
  assert.equal(result.scrapes, 0);
});

test('missing secret exits 1 even when source would be unavailable', async () => {
  const result = await run({ env: { MATCHES_SYNC_SECRET: '' }, scrape: () => { throw new SourceUnavailableError('offline'); } });
  assert.equal(result.code, 1);
  assert.equal(result.scrapes, 0);
});

test('wrong secret rejected with 401 exits 1 and retains fingerprint', async () => {
  const result = await run({ status: 401 });
  assert.equal(result.code, 1);
  assert.equal(result.calls, 1);
  assert.equal(result.fingerprint, 'old-fingerprint');
});

test('backend 500 exits 1 and retains fingerprint', async () => {
  const result = await run({ status: 500 });
  assert.equal(result.code, 1);
  assert.equal(result.calls, 1);
  assert.equal(result.fingerprint, 'old-fingerprint');
});

test('backend partial failure with HTTP 200 exits 1 and retains fingerprint', async () => {
  const result = await run({ body: { updated_count: 1, error_count: 1 } });
  assert.equal(result.code, 1);
  assert.equal(result.fingerprint, 'old-fingerprint');
  assert.doesNotMatch(result.output, /scrape_success=true/);
});

test('unexpected scraper error exits 1', async () => {
  const result = await run({ scrape: () => { throw new TypeError('programming error'); } });
  assert.equal(result.code, 1);
  assert.equal(result.calls, 0);
});

test('unchanged source does not contact backend', async () => {
  const result = await run({ previous: fingerprint(matches) });
  assert.equal(result.code, 0);
  assert.equal(result.calls, 0);
  assert.match(result.output, /scrape_success=true/);
});

test('successful changed data updates fingerprint after backend success', async () => {
  const result = await run();
  assert.equal(result.code, 0);
  assert.equal(result.calls, 1);
  assert.equal(result.fingerprint, fingerprint(matches));
  assert.match(result.output, /scrape_success=true/);
});