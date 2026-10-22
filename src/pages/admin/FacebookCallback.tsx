import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Behandler Facebook-autorisasjon...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Facebook-autorisasjon avbrutt: ${searchParams.get('error_description') || error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Ingen autorisasjonskode mottatt fra Facebook.');
      return;
    }

    const exchangeCode = async () => {
      try {
        const redirectUri = 'https://fagerborgbk.no/admin/facebook-callback';
        const { data, error: fnError } = await supabase.functions.invoke('facebook-token-health', {
          body: { action: 'oauth_callback', code, redirect_uri: redirectUri },
        });

        if (fnError) throw fnError;
        if (!data?.success) throw new Error(data?.error || 'Utveksling feilet');

        // Send result to opener window
        if (window.opener) {
          window.opener.postMessage({
            type: 'facebook-oauth-result',
            success: true,
            data,
          }, window.location.origin);
          setStatus('success');
          setMessage(data.message || 'Token generert! Du kan lukke dette vinduet.');
          setTimeout(() => window.close(), 2000);
        } else {
          setStatus('success');
          setMessage(data.message || 'Token generert! Gå tilbake til admin-panelet.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Noe gikk galt';
        setStatus('error');
        setMessage(msg);
        if (window.opener) {
          window.opener.postMessage({
            type: 'facebook-oauth-result',
            success: false,
            error: msg,
          }, window.location.origin);
        }
      }
    };

    exchangeCode();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        {status === 'loading' && <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />}
        {status === 'success' && <CheckCircle className="h-10 w-10 mx-auto text-green-500" />}
        {status === 'error' && <XCircle className="h-10 w-10 mx-auto text-destructive" />}
        <p className="text-lg font-medium">{message}</p>
        {status !== 'loading' && (
          <button
            onClick={() => window.close()}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Lukk vinduet
          </button>
        )}
      </div>
    </div>
  );
}
