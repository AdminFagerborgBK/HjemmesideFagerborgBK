import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { ACCOUNT, CACHE_MS, normalizePosts, retryDelay } from './policy.ts';
const GRAPH = 'https://graph.facebook.com/v26.0';
class MetaError extends Error {
  constructor(public code: number, public httpStatus: number) { super(`Meta avviste forespørselen (HTTP ${httpStatus}, kode ${code})`); }
}
async function graph(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok || data.error) throw new MetaError(data.error?.code ?? 0, response.status);
  return data;
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Server configuration missing' }, 500);
  const db = createClient(url, key);
  try {
    const body = await req.json().catch(() => null);
    if (!body || !['feed', 'status', 'connect', 'callback'].includes(body.action)) return json({ error: 'Invalid action' }, 400);
    const admin = body.action !== 'feed';
    let userId: string | undefined;
    if (admin) {
      const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return json({ error: 'Unauthorized' }, 401);
      const role = await db.rpc('is_admin', { _user_id: data.user.id });
      if (role.error) throw new Error('Kunne ikke kontrollere administratorrettigheter');
      if (!role.data) return json({ error: 'Forbidden' }, 403);
      userId = data.user.id;
    }
    const check = (result: { error: unknown }) => { if (result.error) throw new Error('Kunne ikke lagre eller lese Instagram-data'); };
    if (body.action === 'connect' || body.action === 'callback') {
      const redirect = body.redirect_uri;
      if (typeof redirect !== 'string') return json({ error: 'Invalid redirect' }, 400);
      const parsed = new URL(redirect);
      if (parsed.pathname !== '/auth/instagram-callback' || parsed.search || parsed.hash || parsed.protocol !== 'https:' || !['fagerborgbk.no', 'www.fagerborgbk.no', 'fagerborgbk.lovable.app', 'id-preview--c8e1877c-4d90-4ea9-b9a9-92c784fb24b1.lovable.app'].includes(parsed.hostname)) return json({ error: 'Invalid redirect' }, 400);
      const appId = Deno.env.get('FACEBOOK_APP_ID');
      const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
      const pageId = Deno.env.get('FACEBOOK_PAGE_ID');
      if (!appId || !appSecret || !pageId) return json({ error: 'Meta-appen er ikke konfigurert' }, 503);
      if (body.action === 'connect') {
        const state = crypto.randomUUID();
        check(await db.from('instagram_feed_oauth_states').insert({ id: state, user_id: userId, redirect_uri: redirect }));
        const auth = new URL('https://www.facebook.com/v26.0/dialog/oauth');
        Object.entries({ client_id: appId, redirect_uri: redirect, state, response_type: 'code', scope: 'instagram_basic,pages_show_list,pages_read_engagement', auth_type: 'rerequest' }).forEach(([k, v]) => auth.searchParams.set(k, v));
        return json({ oauth_url: auth.toString() });
      }
      if (typeof body.state !== 'string' || !/^[0-9a-f-]{36}$/.test(body.state) || typeof body.code !== 'string' || body.code.length > 4096) return json({ error: 'Invalid callback' }, 400);
      const state = await db.from('instagram_feed_oauth_states').delete().eq('id', body.state).eq('user_id', userId).eq('redirect_uri', redirect).gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
      check(state);
      if (!state.data) return json({ error: 'Tilkoblingen utløp. Start på nytt.' }, 400);
      const short = await graph('oauth/access_token', `${appId}|${appSecret}`, { client_id: appId, client_secret: appSecret, redirect_uri: redirect, code: body.code });
      const long = await graph('oauth/access_token', `${appId}|${appSecret}`, { client_id: appId, client_secret: appSecret, grant_type: 'fb_exchange_token', fb_exchange_token: short.access_token });
      const pages = await graph('me/accounts', long.access_token, { fields: 'id,access_token', limit: '100' });
      const page = pages.data?.find((p: { id: string }) => p.id === pageId);
      if (!page?.access_token) return json({ error: 'Velg Facebook-siden Fagerborg BK i Meta-tilkoblingen.' }, 400);
      const linked = await graph(pageId, page.access_token, { fields: 'instagram_business_account{id,username}' });
      if (linked.instagram_business_account?.username?.toLowerCase() !== ACCOUNT) return json({ error: 'Koble profesjonell konto @fagerborg_bk til Facebook-siden Fagerborg BK.' }, 400);
      // Validate read access before storing; never replace the Facebook publishing token.
      await graph(`${linked.instagram_business_account.id}/media`, page.access_token, { fields: 'id', limit: '1' });
      check(await db.from('instagram_feed_cache').upsert({ account: ACCOUNT, page_token: page.access_token, instagram_id: linked.instagram_business_account.id, status: 'connected', expires_at: new Date(0).toISOString(), next_retry_at: new Date(0).toISOString(), failure_count: 0 }, { onConflict: 'account' }));
    }
    const lease = crypto.randomUUID();
    const claim = await db.rpc('claim_instagram_feed_refresh', { p_account: ACCOUNT, p_lease_id: lease });
    check(claim);
    let rowResult = await db.from('instagram_feed_cache').select('*').eq('account', ACCOUNT).single();
    check(rowResult);
    let row = rowResult.data;
    if (!row) throw new Error('Instagram-cache mangler');
    if (claim.data) {
      try {
        let token = row.page_token;
        if (!token) {
          const saved = await db.from('site_settings').select('value').eq('key', 'facebook_page_access_token').maybeSingle();
          check(saved);
          token = typeof saved.data?.value === 'string' ? saved.data.value : Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN');
        }
        const pageId = Deno.env.get('FACEBOOK_PAGE_ID');
        if (!token || !pageId) throw new MetaError(190, 401);
        const page = await graph(pageId, token, { fields: 'instagram_business_account{id,username}' });
        const ig = page.instagram_business_account;
        if (!ig || ig.username?.toLowerCase() !== ACCOUNT) throw new MetaError(100, 400);
        const media = await graph(`${ig.id}/media`, token, { fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp', limit: '3' });
        if (!Array.isArray(media.data) || !media.data.length) throw new Error('Instagram returnerte ingen innlegg');
        const posts = normalizePosts(media.data);
        const now = Date.now();
        check(await db.from('instagram_feed_cache').update({ posts, instagram_id: ig.id, status: 'connected', last_error: null, failure_count: 0, last_success_at: new Date(now).toISOString(), expires_at: new Date(now + CACHE_MS).toISOString(), next_retry_at: new Date(0).toISOString(), lease_until: new Date(0).toISOString(), lease_id: null }).eq('account', ACCOUNT).eq('lease_id', lease));
      } catch (error) {
        const auth = error instanceof MetaError && [10, 100, 190, 200].includes(error.code);
        const failures = row.failure_count + 1;
        check(await db.from('instagram_feed_cache').update({ status: auth ? 'authorization_required' : 'temporary_error', last_error: error instanceof MetaError ? error.message : 'Midlertidig feil ved henting av Instagram-innlegg', failure_count: failures, next_retry_at: new Date(Date.now() + retryDelay(failures, auth)).toISOString(), lease_until: new Date(0).toISOString(), lease_id: null }).eq('account', ACCOUNT).eq('lease_id', lease));
      }
      rowResult = await db.from('instagram_feed_cache').select('*').eq('account', ACCOUNT).single();
      check(rowResult);
      if (rowResult.data) row = rowResult.data;
    }
    return json(admin ? { posts: row.posts, status: row.status, last_error: row.last_error, last_success_at: row.last_success_at, next_retry_at: row.next_retry_at, account: ACCOUNT } : { posts: row.posts });
  } catch { return json({ error: 'Kunne ikke fullføre Instagram-forespørselen' }, 500); }
});
