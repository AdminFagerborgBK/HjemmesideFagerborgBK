import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mail, MailX, CheckCircle2 } from 'lucide-react';

const INTERESTS: { value: string; label: string; description: string }[] = [
  { value: 'kamper', label: 'Kamper og resultater', description: 'Kampprogram, resultater og tabell' },
  { value: 'ungdom', label: 'Ungdom og B-lag', description: 'Nyheter fra B-laget og de yngre lagene' },
  { value: 'dugnad', label: 'Dugnad og frivillighet', description: 'Dugnader, vakter og praktisk hjelp' },
  { value: 'arrangementer', label: 'Arrangementer', description: 'Klubbkvelder, cuper og sosiale samlinger' },
  { value: 'sponsor', label: 'Sponsor og partner', description: 'Informasjon for partnere og næringsliv' },
];

const NewsletterPreferences = () => {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const email = params.get('email') || '';
  const autoUnsubscribe = params.get('avmeld') === '1';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>('');
  const [subscribed, setSubscribed] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const call = async (action: 'get' | 'update', extra: Record<string, unknown> = {}) => {
    const { data, error: fnError } = await supabase.functions.invoke('newsletter-preferences', {
      body: { action, id, email, ...extra },
    });
    if (fnError) throw new Error('Kunne ikke koble til tjenesten. Prøv igjen senere.');
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  useEffect(() => {
    if (!id || !email) {
      setError('Lenken mangler informasjon. Bruk lenken fra nyhetsbrevet, eller kontakt post@fagerborgbk.no.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await call('get');
        setFirstName(data.member.first_name || '');
        setInterests(data.member.interests || []);
        if (autoUnsubscribe) {
          await call('update', { newsletter_opt_out: true, interests: data.member.interests || [] });
          setSubscribed(false);
          setSaved(true);
        } else {
          setSubscribed(!data.member.newsletter_opt_out);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, email]);

  const save = async (nextSubscribed = subscribed) => {
    setSaving(true);
    try {
      await call('update', { newsletter_opt_out: !nextSubscribed, interests });
      setSubscribed(nextSubscribed);
      setSaved(true);
      toast.success('Innstillingene er lagret');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (value: string) =>
    setInterests((prev) => (prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]));

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Nyhetsbrev-innstillinger | Fagerborg BK</title>
        <meta name="description" content="Styr om du vil motta nyhetsbrev fra Fagerborg BK, og hvilke temaer du er interessert i." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />

      <main className="pt-20">
        <section className="bg-fagerborg-gradient py-8 md:py-14">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">Nyhetsbrev-innstillinger</h1>
            <p className="text-white/80 text-sm md:text-base">
              Du bestemmer selv hva du vil høre om fra klubben.
            </p>
          </div>
        </section>

        <div className="container mx-auto px-4 py-10 max-w-2xl">
          {loading ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />Laster innstillingene...
            </CardContent></Card>
          ) : error ? (
            <Card><CardContent className="p-10 text-center">
              <MailX className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{error}</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-6">
              {saved && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {subscribed ? 'Innstillingene dine er lagret.' : 'Du er nå avmeldt nyhetsbrevet.'}
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Mail className="h-4 w-4" />
                    {firstName ? `Hei ${firstName}!` : 'Nyhetsbrev'}
                  </CardTitle>
                  <CardDescription>{email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="pr-4">
                      <p className="font-semibold text-sm">Motta nyhetsbrev</p>
                      <p className="text-xs text-muted-foreground">
                        Månedlig oppsummering med kamper, resultater og nytt fra klubben.
                      </p>
                    </div>
                    <Switch checked={subscribed} onCheckedChange={setSubscribed} aria-label="Motta nyhetsbrev" />
                  </div>

                  <div className={subscribed ? '' : 'opacity-50 pointer-events-none'}>
                    <p className="font-semibold text-sm mb-1">Hva er du interessert i?</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Valgene brukes til å sende deg mer relevant innhold. Uten valg får du hovednyhetsbrevet.
                    </p>
                    <div className="space-y-3">
                      {INTERESTS.map((i) => (
                        <label key={i.value} htmlFor={`int-${i.value}`} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                          <Checkbox
                            id={`int-${i.value}`}
                            checked={interests.includes(i.value)}
                            onCheckedChange={() => toggleInterest(i.value)}
                          />
                          <div>
                            <Label htmlFor={`int-${i.value}`} className="cursor-pointer">{i.label}</Label>
                            <p className="text-xs text-muted-foreground">{i.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => save()} disabled={saving}>
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Lagrer...</> : 'Lagre innstillinger'}
                    </Button>
                    {subscribed && (
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => { void save(false); }}
                      >
                        <MailX className="h-4 w-4 mr-2" />Meld meg av alt
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Spørsmål? Kontakt oss på <a className="underline" href="mailto:post@fagerborgbk.no">post@fagerborgbk.no</a>.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NewsletterPreferences;
