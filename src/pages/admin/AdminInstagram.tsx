import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Instagram, RefreshCw, Link, Loader2, ArrowUpRight } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { formatOsloDateLong, formatOsloTime } from '@/lib/osloTime';
import { toast } from 'sonner';
import type { InstagramCardPost } from '@/components/InstagramFeed';
import { AdminLayout } from '@/components/admin/AdminLayout';
async function invoke(body: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('instagram-feed', { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error || 'Kunne ikke kontakte Instagram');
  }
  return data;
}
const AdminInstagram = () => {
  const callbackStarted = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const callback = window.location.pathname === '/auth/instagram-callback';
  const redirect = `${window.location.origin}/auth/instagram-callback`;
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['instagram-feed-status'],
    queryFn: () => invoke({ action: 'status' }),
    retry: false,
    enabled: !callback,
  });
  useEffect(() => {
    if (!callback || callbackStarted.current) return;
    callbackStarted.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    window.history.replaceState(null, '', window.location.pathname);
    if (!code || !state) { toast.error('Instagram-tilkoblingen ble ikke fullført'); return; }
    (async () => {
      await supabase.auth.getSession();
      await invoke({ action: 'callback', code, state, redirect_uri: redirect });
      window.location.replace('/admin/instagram');
    })().catch(err => toast.error(err.message));
  }, [callback, redirect]);
  const connect = async () => {
    setConnecting(true);
    try {
      const result = await invoke({ action: 'connect', redirect_uri: redirect });
      window.location.assign(result.oauth_url);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Tilkoblingen feilet'); setConnecting(false); }
  };
  const connected = data?.status === 'connected';
  const posts = (data?.posts ?? []) as InstagramCardPost[];
  const content = (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Instagram className="h-6 w-6" />Rundt laget</h1>
      {callback ? <p className="text-muted-foreground">Fullfører Instagram-tilkoblingen…</p> : <>
        <div className="space-y-4 border-b border-border pb-6">
          <p className={connected ? 'text-primary' : 'text-muted-foreground'}>
            {isLoading ? 'Kontrollerer tilkoblingen…' : connected ? 'Tilkoblet @fagerborg_bk' : data?.status === 'authorization_required' ? 'Instagram trenger ny autorisasjon' : 'Instagram er midlertidig utilgjengelig'}
          </p>
          {(error || data?.last_error) && <p className="text-sm text-destructive">{error instanceof Error ? error.message : data.last_error}</p>}
          {data?.last_success_at && <p className="text-sm text-muted-foreground">Sist hentet: {formatOsloDateLong(data.last_success_at)} kl. {formatOsloTime(data.last_success_at)}</p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Sjekk status</Button>
            {!connected && <Button onClick={connect} disabled={connecting}><Link className="mr-2 h-4 w-4" />Koble til Instagram</Button>}
          </div>
          {!connected && <p className="max-w-2xl text-sm text-muted-foreground">Logg inn hos Meta med tilgang til Facebook-siden Fagerborg BK, og velg den tilknyttede profesjonelle Instagram-kontoen @fagerborg_bk. Godkjenn lesetilgangen. Facebook-publiseringen beholdes uendret.</p>}
        </div>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{posts.map(post => <li key={post.id} className="overflow-hidden rounded-lg border border-border bg-card"><a href={post.instagram_url} target="_blank" rel="noopener noreferrer"><img src={post.image_url} alt={post.alt_text || post.title} className="aspect-[4/5] w-full object-cover" /><div className="flex items-start gap-2 p-4"><h2 className="line-clamp-2 text-sm font-semibold text-foreground">{post.title}</h2><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" /></div></a></li>)}</ul>}
      </>}
    </div>
  );
  return callback ? content : <AdminLayout>{content}</AdminLayout>;
};
export default AdminInstagram;
