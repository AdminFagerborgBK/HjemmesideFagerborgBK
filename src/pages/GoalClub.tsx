import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { useSportsSeason } from '@/hooks/useSportsSeason';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { useGoalClubEntries, useSubmitGoalClub } from '@/hooks/useGoalClub';
import { Target, Trophy, Users, Loader2, Building2, User, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
const AMOUNT_OPTIONS = [5, 10, 20, 30, 50, 100];

const GoalClub = () => {
  const {data:config}=useSportsSeason();
  const season=config?.season; 
  const { data: entries, isLoading: entriesLoading } = useGoalClubEntries();
  const submitEntry = useSubmitGoalClub();

  const [name, setName] = useState('');
  const [isCompany, setIsCompany] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amountPerGoal, setAmountPerGoal] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [goalGuess, setGoalGuess] = useState('');

  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = useCustomAmount ? parseInt(customAmount) : amountPerGoal;
    if (!name || !email || !goalGuess || !finalAmount) return;

    await submitEntry.mutateAsync({
      name,
      is_company: isCompany,
      phone,
      email,
      amount_per_goal: finalAmount,
      goal_guess: parseInt(goalGuess),
      is_anonymous: isAnonymous,
    });

    // Register for newsletter if opted in
    if (newsletterOptIn) {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || name;
      const lastName = nameParts.slice(1).join(' ') || '-';
      await supabase.from('memberships').insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        membership_type: 'malklubben',
        status: 'active',
        newsletter_opt_out: false,
      });
    }

    setName('');
    setPhone('');
    setEmail('');
    setGoalGuess('');
    setAmountPerGoal(5);
    setCustomAmount('');
    setUseCustomAmount(false);
    setNewsletterOptIn(true);
    setIsAnonymous(false);
  };

  const sortedEntries = entries?.slice().sort((a, b) => {
    // Høyest bidrag per mål øverst, deretter eldst påmelding først
    if (b.amount_per_goal !== a.amount_per_goal) {
      return b.amount_per_goal - a.amount_per_goal;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }) || [];

  const totalPerGoal = sortedEntries.reduce((sum, e) => sum + (e.amount_per_goal || 0), 0);

  return (
    <>
      <Seo
        title={`Målklubben ${season ?? ""} | Fagerborg BK`}
        description={`Bli med i Målklubben og støtt Fagerborg BK for hvert mål laget scorer i ${season ?? "den aktive"}-sesongen.`}
        path="/malklubben"
      />
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--fagerborg-navy))] to-[hsl(var(--fagerborg-navy-light))] text-white pt-20 md:pt-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--secondary) / 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(var(--secondary) / 0.2) 0%, transparent 40%)',
          }} />
        </div>
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Target className="h-4 w-4 text-[hsl(var(--secondary))]" />
              <span className="text-sm font-medium">Sesong {season}</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6">
              MÅL<span className="text-[hsl(var(--secondary))]">KLUBBEN</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-4 max-w-2xl mx-auto">
              Bidra med et beløp per mål Fagerborg scorer i {season}-sesongen (serie og NM) – og vær med i kampen om å gjette riktig antall mål!
            </p>
            <p className="text-base text-white/60">
              Vinneren som gjetter nærmest antall mål vinner premie 🏆
            </p>

            <div className="flex flex-wrap justify-center gap-8 mt-10">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-black text-[hsl(var(--secondary))]">
                  {entriesLoading ? '–' : sortedEntries.length}
                </div>
                <div className="text-sm text-white/60 mt-1">Medlemmer</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-black text-[hsl(var(--secondary))]">5 kr</div>
                <div className="text-sm text-white/60 mt-1">Minstebeløp</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-black text-[hsl(var(--secondary))]">⚽</div>
                <div className="text-sm text-white/60 mt-1">Per scoring</div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-10"
            >
              <a href="#signup" className="inline-flex items-center gap-2 bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] font-bold px-8 py-3 rounded-full hover:brightness-110 transition-all">
                Bli med nå <ChevronDown className="h-4 w-4" />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Info Section */}
      <section className="bg-muted/50 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Target, title: 'Velg beløp', desc: 'Bestem hvor mye du ønsker å gi per mål. Minstebeløp er 5 kr.' },
              { icon: Trophy, title: 'Gjett antall mål', desc: `Tipp totalt antall mål Fagerborg scorer i serie og NM i ${season ?? ''}.` },
              { icon: Users, title: 'Vinn premie', desc: 'Den som gjetter nærmest riktig antall mål vinner en flott premie!' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <Card className="h-full text-center border-none shadow-md">
                  <CardContent className="pt-8 pb-6 px-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                      <item.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Signup Form */}
      <section id="signup" className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-3xl font-black text-center mb-2">Meld deg på</h2>
              <p className="text-center text-muted-foreground mb-8">Fyll ut skjemaet under for å bli med i Målklubben {season}</p>

              <Card className="shadow-lg border-2 border-primary/10">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Person/Company toggle */}
                    <div className="flex gap-2 p-1 bg-muted rounded-lg">
                      <button
                        type="button"
                        onClick={() => setIsCompany(false)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${!isCompany ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <User className="h-4 w-4" /> Privatperson
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCompany(true)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${isCompany ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <Building2 className="h-4 w-4" /> Selskap
                      </button>
                    </div>

                    <div>
                      <Label htmlFor="gc-name">{isCompany ? 'Selskapsnavn' : 'Fullt navn'}</Label>
                      <Input id="gc-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder={isCompany ? 'Firma AS' : 'Ola Nordmann'} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="gc-phone">Telefon</Label>
                        <Input id="gc-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="12345678" />
                      </div>
                      <div>
                        <Label htmlFor="gc-email">E-post *</Label>
                        <Input id="gc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="din@epost.no" />
                      </div>
                    </div>

                    {/* Amount selection */}
                    <div>
                      <Label className="mb-3 block">Inngangsbeløp per scoring (kr)</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {AMOUNT_OPTIONS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => { setAmountPerGoal(amt); setUseCustomAmount(false); }}
                            className={`py-2.5 rounded-lg text-sm font-bold border-2 transition-all ${!useCustomAmount && amountPerGoal === amt
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {amt} kr
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setUseCustomAmount(true)}
                          className={`py-2.5 rounded-lg text-sm font-bold border-2 transition-all ${useCustomAmount
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50'
                          }`}
                        >
                          Annet
                        </button>
                      </div>
                      {useCustomAmount && (
                        <Input
                          type="number"
                          min={5}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="Skriv beløp (min 5 kr)"
                          className="mt-2"
                          required
                        />
                      )}
                    </div>

                    {/* Goal guess */}
                    <div>
                      <Label htmlFor="gc-guess">Ditt måltips – totalt antall mål i {season} (serie + NM) ⚽</Label>
                      <Input
                        id="gc-guess"
                        type="number"
                        min={0}
                        max={500}
                        value={goalGuess}
                        onChange={(e) => setGoalGuess(e.target.value)}
                        required
                        placeholder="F.eks. 42"
                        className="text-lg font-bold"
                      />
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="gc-newsletter"
                        checked={newsletterOptIn}
                        onCheckedChange={(checked) => setNewsletterOptIn(checked === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="gc-newsletter" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                        Ja, jeg vil gjerne motta månedlig nyhetsbrev fra Fagerborg BK
                      </Label>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="gc-anonymous"
                        checked={isAnonymous}
                        onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="gc-anonymous" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                        Jeg ønsker å være anonym i medlemslisten (vises som «Anonym»)
                      </Label>
                    </div>

                    <Button type="submit" className="w-full h-12 text-base font-bold" disabled={submitEntry.isPending || !config}>
                      {submitEntry.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Target className="h-5 w-5 mr-2" />
                      )}
                      Bli med i Målklubben
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-center mb-2">Målklubben-medlemmer</h2>
            <p className="text-center text-muted-foreground mb-8">
              {sortedEntries.length} {sortedEntries.length === 1 ? 'person' : 'personer/selskaper'} har meldt seg på
            </p>

            {sortedEntries.length > 0 && (
              <div className="mb-6 text-center">
                <div className="inline-flex items-baseline gap-2 bg-[hsl(var(--secondary))]/10 border-2 border-[hsl(var(--secondary))]/30 rounded-2xl px-6 py-4">
                  <span className="text-3xl md:text-4xl font-black text-[hsl(var(--secondary))]">
                    {totalPerGoal.toLocaleString('nb-NO')} kr
                  </span>
                  <span className="text-sm text-muted-foreground">per mål Fagerborg scorer ⚽</span>
                </div>
              </div>
            )}

            {entriesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sortedEntries.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Target className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">Ingen påmeldte ennå – bli den første!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {sortedEntries.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  >
                    <div className={`flex items-center gap-3 px-3 sm:px-4 py-3 rounded-xl transition-colors ${
                      i === 0 ? 'bg-[hsl(var(--secondary))]/10 border-2 border-[hsl(var(--secondary))]/30' :
                      i < 3 ? 'bg-card border border-border' :
                      'bg-card/50 border border-border/50'
                    }`}>
                      <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black ${
                        i === 0 ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]' :
                        i < 3 ? 'bg-primary text-primary-foreground' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {entry.is_company ? (
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="font-semibold truncate text-sm sm:text-base">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground sm:hidden">
                          <span>Tipper <strong className="text-foreground">{entry.goal_guess} mål</strong></span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-3">
                          <div className="text-right hidden sm:block">
                            <div className="text-xs text-muted-foreground leading-tight">Tipper</div>
                            <div className="text-sm font-bold">{entry.goal_guess} mål</div>
                          </div>
                          <div className="text-right sm:border-l sm:border-border sm:pl-3">
                            <div className="text-base sm:text-lg font-black text-primary leading-tight whitespace-nowrap">{entry.amount_per_goal} kr</div>
                            <div className="text-xs text-muted-foreground">/ mål</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default GoalClub;
