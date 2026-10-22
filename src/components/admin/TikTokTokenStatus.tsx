import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTikTokHealth, useTikTokOAuth, useTikTokDisconnect } from '@/hooks/useTikTokAuth';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Loader2, Unplug } from 'lucide-react';

// TikTok icon as inline SVG
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.88a8.28 8.28 0 004.76 1.49V6.92a4.84 4.84 0 01-1-.23z" />
    </svg>
  );
}

export function TikTokTokenStatus() {
  const { data: health, isLoading, refetch, isRefetching } = useTikTokHealth();
  const { startOAuth } = useTikTokOAuth();
  const disconnect = useTikTokDisconnect();

  const getStatusIcon = () => {
    if (!health || health.status === 'not_configured' || health.status === 'not_connected')
      return <TikTokIcon className="h-5 w-5 text-muted-foreground" />;
    if (health.status === 'valid') return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const getStatusBadge = () => {
    if (!health || health.status === 'not_configured') return <Badge variant="secondary">Ikke konfigurert</Badge>;
    if (health.status === 'not_connected') return <Badge variant="secondary">Ikke koblet til</Badge>;
    if (health.status === 'valid') return <Badge className="bg-primary/10 text-primary border-primary/30">Tilkoblet</Badge>;
    return <Badge variant="destructive">Utløpt</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={health?.status === 'expired' ? 'border-destructive/50' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-base">TikTok-integrasjon</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        {health?.username && (
          <CardDescription>Konto: {health.username}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{health?.message}</p>

        <div className="flex flex-wrap gap-2 pt-2">
          {(health?.status === 'not_connected' || health?.status === 'expired') && (
            <Button size="sm" onClick={startOAuth}>
              <TikTokIcon className="h-3.5 w-3.5 mr-1" />
              Koble til TikTok
            </Button>
          )}

          {health?.status === 'valid' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Unplug className="h-3.5 w-3.5 mr-1" />}
              Koble fra
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Sjekk status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
