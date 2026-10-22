import { useState } from 'react';
import { Handshake, Send, Loader2, Trophy, Users, Eye, Heart } from 'lucide-react';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const benefits = [
  {
    icon: Eye,
    title: 'Synlighet',
    description: 'Logo på drakter, nettside og sosiale medier – synlig for hundrevis av tilskuere og følgere hver uke.',
  },
  {
    icon: Users,
    title: 'Nettverk',
    description: 'Bli en del av et engasjert lokalmiljø og knytt kontakter med andre bedrifter og ildsjeler.',
  },
  {
    icon: Heart,
    title: 'Samfunnsansvar',
    description: 'Støtt lokal breddeidrett og bidra til fellesskap, folkehelse og glede i bydelen.',
  },
  {
    icon: Trophy,
    title: 'Skreddersydde pakker',
    description: 'Vi tilpasser samarbeidet etter dine ønsker – fra enkel logoplassering til aktive kampdag-opplevelser.',
  },
];

const BecomePartner = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('contact-form', {
        body: {
          name: formData.name,
          email: formData.email,
          subject: `Partnerhenvendelse fra ${formData.company || formData.name}`,
          message: `Bedrift: ${formData.company}\nTelefon: ${formData.phone || 'Ikke oppgitt'}\n\n${formData.message}`,
        },
      });

      if (error) throw error;

      // Register for newsletter if opted in
      if (newsletterOptIn) {
        const nameParts = formData.name.trim().split(/\s+/);
        const firstName = nameParts[0] || formData.name;
        const lastName = nameParts.slice(1).join(' ') || '-';
        await supabase.from('memberships').insert({
          first_name: firstName,
          last_name: lastName,
          email: formData.email,
          phone: formData.phone || null,
          membership_type: 'partner',
          status: 'active',
          newsletter_opt_out: false,
        });
      }

      toast({
        title: 'Henvendelse sendt!',
        description: 'Takk for din interesse! Vi tar kontakt så snart som mulig.',
      });

      setFormData({ name: '', email: '', company: '', phone: '', message: '' });
      setNewsletterOptIn(true);
    } catch (error: any) {
      console.error('Error sending partner form:', error);
      toast({
        title: 'Feil ved sending',
        description: 'Kunne ikke sende henvendelsen. Prøv igjen senere.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo
        title="Bli partner eller sponsor | Fagerborg BK"
        description="Bli samarbeidspartner med Fagerborg BK. Se hva et partnerskap gir bedriften din og ta kontakt med oss."
        path="/bli-partner"
      />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary pt-24 pb-16 md:pt-32 md:pb-24">
          <div className="container mx-auto px-4 text-center">
            <Handshake className="h-12 w-12 text-primary-foreground/80 mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Bli partner
            </h1>
            <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
              Støtt lokal fotball og få synlighet for din bedrift – bli en del av Fagerborg BK-familien.
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section className="container mx-auto px-4 py-12 md:py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Hvorfor bli partner?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {benefits.map((b) => (
              <Card key={b.title} className="text-center">
                <CardContent className="pt-6">
                  <b.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-lg mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Form */}
        <section className="container mx-auto px-4 pb-12 md:pb-16 max-w-2xl">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-1">Interessert?</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                Fyll ut skjemaet så tar vi kontakt for en uforpliktende prat om mulighetene.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Kontaktperson</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      maxLength={100}
                      placeholder="Ditt navn"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Bedrift / Organisasjon</Label>
                    <Input
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      maxLength={100}
                      placeholder="Bedriftsnavn"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-post</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      maxLength={255}
                      placeholder="din@bedrift.no"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      maxLength={20}
                      placeholder="Valgfritt"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Melding</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    maxLength={5000}
                    rows={5}
                    placeholder="Fortell gjerne litt om hva slags samarbeid dere ser for dere..."
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="partner-newsletter"
                    checked={newsletterOptIn}
                    onCheckedChange={(checked) => setNewsletterOptIn(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="partner-newsletter" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    Ja, jeg vil gjerne motta månedlig nyhetsbrev fra Fagerborg BK
                  </Label>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sender...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send henvendelse
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default BecomePartner;
