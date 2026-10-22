import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useSiteSetting } from '@/hooks/useSiteSettings';
import VippsPaywall from '@/components/VippsPaywall';
import { LIVESTREAM_TOKEN_PREFIX } from '@/hooks/useLivestreamUrl';

interface LivestreamGateProps {
  matchId: string;
  matchDate?: string;
  children: React.ReactNode;
}

const STORAGE_PREFIX = 'fbk_stream_access_';

const LivestreamGate = ({ matchId, matchDate, children }: LivestreamGateProps) => {
  const storageKey = `${STORAGE_PREFIX}${matchId}`;
  const queryClient = useQueryClient();
  const { value: requireOtp, isLoading: settingLoading } = useSiteSetting('livestream_require_otp');
  const [hasAccess, setHasAccess] = useState(false);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVippsPath, setShowVippsPath] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'true') {
      setHasAccess(true);
    }
  }, [storageKey]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('livestream-otp', {
        body: { action: 'send', email: email.trim(), match_id: matchId },
      });

      if (fnError) throw fnError;

      if (data?.error === 'not_member') {
        setError('not_member');
      } else if (data?.error === 'rate_limited') {
        setError('Du har bedt om for mange koder. Prøv igjen senere.');
      } else if (data?.error) {
        setError(data.error);
      } else {
        setStep('otp');
      }
    } catch (err) {
      console.error(err);
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('livestream-otp', {
        body: { action: 'verify', email: email.trim(), match_id: matchId, code: otp },
      });

      if (fnError) throw fnError;

      if (data?.valid) {
        localStorage.setItem(storageKey, 'true');
        localStorage.setItem('fbk_member_verified', 'true');
        if (data.access_token) {
          localStorage.setItem(`${LIVESTREAM_TOKEN_PREFIX}${matchId}`, data.access_token);
        }
        queryClient.invalidateQueries({ queryKey: ['livestream-url', matchId] });
        setHasAccess(true);
      } else {
        setError('Ugyldig eller utløpt kode. Prøv igjen.');
        setOtp('');
      }
    } catch (err) {
      console.error(err);
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  // If OTP verification is disabled, skip the gate entirely
  if (!settingLoading && requireOtp === false) return <>{children}</>;

  // While loading the setting, show nothing briefly
  if (settingLoading) return null;

  // If more than 1 hour before match, show content without gate
  if (matchDate) {
    const msUntilMatch = new Date(matchDate).getTime() - Date.now();
    if (msUntilMatch > 60 * 60 * 1000) return <>{children}</>;
  }

  if (hasAccess) return <>{children}</>;

  // Non-member info / voluntary support path
  if (showVippsPath) {
    return <VippsPaywall matchId={matchId} onBack={() => setShowVippsPath(false)} />;
  }


  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <div className="max-w-md mx-auto">
        <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Kun for medlemmer</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Direktesendingen er forbeholdt medlemmer av Fagerborg BK. Skriv inn e-posten du registrerte deg med for å få tilgang.
          </p>

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <Input
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
                autoFocus
                className="text-center"
              />

              {error === 'not_member' ? (
                <div className="bg-destructive/10 text-destructive text-sm rounded-xl p-4 space-y-2">
                  <p className="font-semibold">Denne e-posten er ikke registrert som medlem.</p>
                  <p className="text-xs text-destructive/80">
                    Du må være registrert medlem for å se direktesendingen.
                  </p>
                  <Link
                    to="/bli-medlem"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-1"
                  >
                    Bli medlem her
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}

              <Button type="submit" className="w-full gap-2" disabled={loading || !email.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send engangskode
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vi har sendt en 6-sifret kode til <strong>{email}</strong>
              </p>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button
                onClick={handleVerifyOtp}
                className="w-full gap-2"
                disabled={loading || otp.length !== 6}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Verifiser og se kampen
              </Button>

              <button
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Bruk en annen e-post
              </button>
            </div>
          )}

          {/* Non-member alternative */}
          <div className="pt-4 border-t border-border/50 mt-4">
            <button
              onClick={() => setShowVippsPath(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ikke medlem? Se hvordan du får tilgang →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivestreamGate;
