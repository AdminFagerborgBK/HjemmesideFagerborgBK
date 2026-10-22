import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Users, Heart, Send, AlertTriangle, LogIn, Radio } from 'lucide-react';
import { Mail, Vote } from 'lucide-react';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const joinPayloadSchema = z.object({
  email: z.string().trim().min(1, 'E-post er påkrevd').email('Ugyldig e-post').max(255),
  name: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
});

type JoinPayload = z.infer<typeof joinPayloadSchema>;

// Use local edge function
const JOIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join`;

type TurnstileAPI = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
    }
  ) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

const Membership = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string>('');
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);

  const view = useMemo(() => {
    const status = searchParams.get('status');
    if (status === 'submitted') return 'submitted' as const;
    if (status === 'exists') return 'exists' as const;
    return 'form' as const;
  }, [searchParams]);

  const {
    register,
    handleSubmit: hookFormSubmit,
    formState: { errors },
  } = useForm<JoinPayload>({
    resolver: zodResolver(joinPayloadSchema),
    defaultValues: {
      email: '',
      name: '',
      phone: '',
    },
  });

  const benefits = [
    { icon: Radio, title: 'Eksklusiv tilgang til livestream', description: 'Se alle Fagerborg BKs kamper direkte' },
    { icon: CheckCircle, title: 'Tilgang til alle videoer', description: 'Se full kamp-opptak og eksklusivt videoinnhold' },
    { icon: Mail, title: 'Månedlig nyhetsbrev', description: 'Få siste nytt fra klubben rett i innboksen' },
    { icon: Vote, title: 'Stemmerett på årsmøtet', description: 'Delta og påvirk klubbens fremtid' },
    { icon: Heart, title: 'Bli en del av fellesskapet', description: 'Støtt klubben – ditt bidrag gjør en forskjell' },
  ];

  // Cloudflare Turnstile (script lastes dynamisk så vi slipper endringer i index.html)
  useEffect(() => {
    if (view !== 'form') return;

    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (existing) {
      setTurnstileReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.onload = () => setTurnstileReady(true);
    script.onerror = () => {
      toast({
        title: 'Captcha',
        description: 'Kunne ikke laste captcha. Prøv igjen om litt.',
        variant: 'destructive',
      });
    };

    document.head.appendChild(script);
  }, [toast, view]);

  useEffect(() => {
    if (!turnstileReady) return;
    if (view !== 'form') return;
    if (!turnstileContainerRef.current) return;
    if (!window.turnstile) return;

    // Render kun én gang per mount
    if (turnstileWidgetIdRef.current) return;

    // Use test key in preview environments (lovable.app), prod key on fagerborgbk.no
    const isPreview = window.location.hostname.includes('lovable.app') || 
                      window.location.hostname.includes('lovableproject.com') ||
                      window.location.hostname === 'localhost';
    const sitekey = isPreview 
      ? '1x00000000000000000000AA' // Cloudflare test key - always passes
      : '0x4AAAAAACOr5ftU2vku54i6'; // Production key for fagerborgbk.no

    const widgetId = window.turnstile.render(turnstileContainerRef.current, {
      sitekey,
      callback: (token) => {
        setTurnstileToken(token);
        setTurnstileError('');
      },
      'expired-callback': () => {
        setTurnstileToken('');
        setTurnstileError('Captcha utløpt, prøv igjen');
      },
      'error-callback': () => {
        setTurnstileToken('');
        setTurnstileError('Captcha feilet, prøv igjen');
      },
      theme: 'auto',
    });
    turnstileWidgetIdRef.current = widgetId;
  }, [toast, turnstileReady, view]);

  const onSubmit = async (data: JoinPayload) => {
    setIsSubmitting(true);
    setTurnstileError('');

    if (!turnstileToken) {
      setIsSubmitting(false);
      setTurnstileError('Fullfør captcha-verifiseringen');
      toast({
        title: 'Captcha',
        description: 'Captcha feilet / mangler, prøv igjen',
        variant: 'destructive',
      });
      return;
    }

    // Get honeypot value from DOM (not part of react-hook-form)
    const formElement = document.querySelector('form');
    const websiteInput = formElement?.querySelector<HTMLInputElement>('input[name="website"]');
    const website = websiteInput?.value ?? '';

    try {
      const res = await fetch(JOIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          turnstile_token: turnstileToken,
          website, // honeypot
          name: data.name || undefined,
          phone: data.phone || undefined,
          member_role: 'member',
          team: null,
          source: 'homepage',
        }),
      });

      setIsSubmitting(false);

      if (res.status === 400) {
        setTurnstileError('Captcha feilet, prøv igjen');
        toast({
          title: 'Captcha',
          description: 'Captcha feilet / mangler, prøv igjen',
          variant: 'destructive',
        });
        setTurnstileToken('');
        window.turnstile?.reset(turnstileWidgetIdRef.current ?? undefined);
        return;
      }

      if (res.status === 429) {
        toast({
          title: 'For mange forsøk',
          description: 'For mange forsøk – vent litt og prøv igjen',
          variant: 'destructive',
        });
        return;
      }

      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }

      if (body?.status === 'exists') {
        setSearchParams({ status: 'exists' });
        toast({ title: 'Du finnes allerede', description: 'Logg inn på spillerportalen for å fortsette.' });
        return;
      }

      if (body?.status === 'created') {
        setSearchParams({ status: 'submitted' });
        toast({ title: 'Innmelding mottatt!', description: 'Vi godkjenner deg snart.' });
        return;
      }

      if (!res.ok) {
        toast({
          title: 'Feil',
          description: 'Kunne ikke sende innmelding. Prøv igjen om litt.',
          variant: 'destructive',
        });
        return;
      }

      // Fallback dersom backend returnerer 2xx uten {status}
      setSearchParams({ status: 'submitted' });
    } catch {
      setIsSubmitting(false);
      toast({
        title: 'Nettverksfeil',
        description: 'Kunne ikke sende innmelding. Sjekk tilkoblingen og prøv igjen.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Bli medlem i Fagerborg BK"
        description="Meld deg inn i Fagerborg BK. Se hva medlemskapet koster, hva det gir deg og fyll ut innmeldingsskjemaet."
        path="/bli-medlem"
      />
      <Header />
      <main className="pt-20">
        <section className="bg-fagerborg-gradient py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Bli medlem</h1>
            <p className="text-white/80 text-lg">Bli en del av Fagerborg BK</p>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
              <div>
                <h2 className="text-2xl font-bold mb-6">Medlemsfordeler</h2>
                <Button asChild variant="outline" className="mb-6"><Link to="/bli-spiller">Vil du spille? Bli spiller</Link></Button>
                <div className="space-y-6">
                  {benefits.map((b) => (
                    <div key={b.title} className="flex gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <b.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{b.title}</h3>
                        <p className="text-muted-foreground text-sm">{b.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-card">
                {view === 'submitted' ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Takk – vi godkjenner deg snart</h3>
                    <p className="text-muted-foreground mb-4">Du vil motta en e-post med lenke til registrering i Spond. Medlemskapet ditt registreres hos Norges idrettsforbund (NIF) gjennom Spond.</p>
                    <p className="text-muted-foreground text-sm">Velg «Støttemedlem» som medlemskategori når du registrerer deg.</p>
                  </div>
                ) : view === 'exists' ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Du er allerede registrert</h3>
                    <p className="text-muted-foreground mb-4">Vi har sendt deg en e-post med lenke til registrering i Spond. Medlemskapet ditt registreres hos Norges idrettsforbund (NIF) gjennom Spond.</p>
                    <p className="text-muted-foreground text-sm mb-6">Velg «Støttemedlem» som medlemskategori når du registrerer deg.</p>
                    <Button asChild className="w-full">
                      <a href="https://spiller.fagerborgbk.no" target="_blank" rel="noopener noreferrer">
                        Gå til spillerportalen <LogIn className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={hookFormSubmit(onSubmit)} className="space-y-4">
                    <h3 className="text-xl font-bold mb-4">Meld inn i klubben</h3>

                    {/* Honeypot */}
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      className="hidden"
                      aria-hidden="true"
                      defaultValue=""
                    />

                    <div className="space-y-1">
                      <Label htmlFor="name">Navn</Label>
                      <Input
                        id="name"
                        autoComplete="name"
                        {...register('name')}
                        className={errors.name ? 'border-destructive' : ''}
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="email">E-post *</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register('email')}
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>


                    <div className="space-y-1">
                      <Label htmlFor="phone">Telefon</Label>
                      <Input
                        id="phone"
                        {...register('phone')}
                        className={errors.phone ? 'border-destructive' : ''}
                      />
                      {errors.phone && (
                        <p className="text-sm text-destructive">{errors.phone.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Bekreft at du ikke er en robot</p>
                      <div ref={turnstileContainerRef} />
                      {turnstileError && (
                        <p className="text-sm text-destructive">{turnstileError}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Sender...' : 'Send søknad'} <Send className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Membership;
