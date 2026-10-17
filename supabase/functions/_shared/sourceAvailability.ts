export class SourceUnavailableError extends Error {
  readonly code = 'SOURCE_UNAVAILABLE';
  constructor(message: string) { super(message); this.name = 'SourceUnavailableError'; }
}

export const jsonResponse = (body: unknown, headers: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

// Only transport and explicitly validated source failures are retryable.
export async function readSource<T>(url: string, parse: (response: Response) => Promise<T>,
  fetchImpl: typeof fetch = fetch, sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))) : Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      let response: Response;
      try {
        response = await fetchImpl(url, { headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(45000) });
      } catch (error) {
        if (error instanceof TypeError || (error instanceof DOMException && ['AbortError', 'TimeoutError', 'NetworkError'].includes(error.name))) {
          throw new SourceUnavailableError(`Source transport failed: ${String(error)}`);
        }
        throw error;
      }
      if (!response.ok) {
        await response.text();
        throw new SourceUnavailableError(`Source HTTP ${response.status}`);
      }
      return await parse(response);
    } catch (error) {
      if (!(error instanceof SourceUnavailableError) || attempt >= 3) throw error;
      await sleep(attempt * 1000);
    }
  }
}

export async function sourceText(response: Response): Promise<string> {
  try { return await response.text(); } catch (error) {
    if (error instanceof TypeError || error instanceof DOMException) throw new SourceUnavailableError(`Source body failed: ${String(error)}`);
    throw error;
  }
}

export async function recordStatus(db: any, job: string, ok: boolean, info: { count?: number; error?: string } = {}) {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { job_key: job, last_attempt_at: now, updated_at: now };
  if (ok) Object.assign(row, { last_success_at: now, last_error: null, last_updated_count: info.count ?? 0 });
  else row.last_error = info.error ?? 'Internal error';
  const { error } = await db.from('sync_status').upsert(row, { onConflict: 'job_key' });
  if (error) throw new Error(`Sync status write failed: ${error.message}`);
}

export function configuredClient(env: (key: string) => string | undefined, create: any) {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing backend configuration');
  return create(url, key);
}
