import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFacebookTokenHealth } from '@/hooks/useFacebookTokenHealth';
import { Facebook, CheckCircle, AlertTriangle, XCircle, RefreshCw, Loader2, Shield, Link } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function FacebookTokenStatus() {
  const { data: health, isLoading, refetch, isRefetching } = useFacebookTokenHealth();
  const popupRef = useRef<Window | null>(null);

  const getStatusIcon = () => {
    if (!health || health.status === 'not_configured') return <Facebook className="h-5 w-5 text-muted-foreground" />;
    if (health.status === 'valid') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (health.status === 'expiring_soon') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const getStatusBadge = () => {
    if (!health || health.status === 'not_configured') return <Badge variant="secondary">Ikke konfigurert</Badge>;
    if (health.status === 'valid') return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Gyldig</Badge>;
    if (health.status === 'expiring_soon') return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Utløper snart</Badge>;
    return <Badge variant="destructive">Utløpt</Badge>;
  };

  const handleConnectFacebook = async () => {
    try {
      const redirectUri = 'https://fagerborgbk.no/admin/facebook-callback';
      const { data, error } = await supabase.functions.invoke('facebook-token-health', {
        body: { action: 'oauth_url', redirect_uri: redirectUri },
      });

      if (error || !data?.oauth_url) throw new Error(error?.message || 'Kunne ikke hente OAuth URL');

      // Open popup
      const popup = window.open(
        data.oauth_url,
        'facebook-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );
      popupRef.current = popup;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Noe gikk galt');
    }
  };

  // Listen for OAuth result from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'facebook-oauth-result') return;

      if (event.data.success) {
        toast.success(event.data.data?.message || 'Facebook koblet til!');
        refetch();
      } else {
        toast.error(event.data.error || 'Tilkobling feilet');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetch]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const needsRenewal = !health || health.status === 'expired' || health.status === 'not_configured' || health.status === 'expiring_soon';

  return (
    <Card className={
      health?.status === 'expired' ? 'border-destructive/50' :
      health?.status === 'expiring_soon' ? 'border-amber-500/50' :
      ''
    }>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-base">Facebook-integrasjon</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        {health?.page_name && (
          <CardDescription>Side: {health.page_name}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{health?.message}</p>

        {health?.is_permanent && health.status === 'valid' && (
          <div className="flex items-center gap-2 text-xs text-green-600">
            <Shield className="h-3.5 w-3.5" />
            Permanent token – utløper aldri
          </div>
        )}

        {health?.expires_at && (
          <p className="text-xs text-muted-foreground">
            Utløper: {new Date(health.expires_at).toLocaleDateString('nb-NO', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        )}

        {!health?.is_permanent && health?.status === 'valid' && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
            ⚠️ Dette er ikke et permanent token. Koble til Facebook på nytt for å generere et permanent Page Access Token som aldri utløper.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Sjekk status
          </Button>

          <Button
            size="sm"
            variant={needsRenewal ? 'default' : 'outline'}
            onClick={handleConnectFacebook}
            className={needsRenewal ? 'bg-[#1877F2] hover:bg-[#166FE5] text-white' : ''}
          >
            <Link className="h-3.5 w-3.5 mr-1" />
            {needsRenewal ? 'Koble til Facebook' : 'Forny permanent token'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          For at innlegg skal fungere kreves et permanent Page Access Token. Klikk «Koble til Facebook» og logg inn med Facebook-kontoen som er administrator for siden.
        </p>
      </CardContent>
    </Card>
  );
}
