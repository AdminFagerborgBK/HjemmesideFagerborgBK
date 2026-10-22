// deno-lint-ignore no-explicit-any
export async function recordSyncStatus(supabase: any, jobKey: string, ok: boolean, info: { count?: number; error?: string } = {}) {
  try {
    const now = new Date().toISOString();
    const row: Record<string, unknown> = { job_key: jobKey, last_attempt_at: now, updated_at: now };
    if (ok) {
      row.last_success_at = now;
      row.last_error = null;
      if (info.count != null) row.last_updated_count = info.count;
    } else {
      row.last_error = (info.error ?? 'unknown error').slice(0, 1000);
    }
    await supabase.from('sync_status').upsert(row, { onConflict: 'job_key' });
  } catch (e) {
    console.error(`[syncStatus] failed to record ${jobKey}:`, e);
  }
}
