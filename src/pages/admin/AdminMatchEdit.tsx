import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { useAdminMatch, useCreateMatch, useUpdateMatch, MatchInput } from '@/hooks/useAdminMatches';
import { Loader2, ArrowLeft, Save, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { osloInputParts, osloWallTimeToIso } from '../../../supabase/functions/_shared/osloWallTime.mjs';

const matchSchema = z.object({
  team: z.enum(['A-laget', 'B-laget']),
  opponent: z.string().min(1, 'Motstander er påkrevd'),
  venue: z.string().optional().default(''),
  venue_maps_url: z.string().nullable().optional(),
  venue_tbd: z.boolean().optional().default(false),
  match_date: z.string().min(1, 'Dato er påkrevd'),
  match_time: z.string().optional().default(''),
  time_tbd: z.boolean().optional().default(false),
  is_home: z.boolean(),
  competition: z.string().min(1, 'Turnering er påkrevd'),
  status: z.enum(['upcoming', 'finished', 'live']),
  is_cancelled: z.boolean().optional().default(false),
  home_score: z.coerce.number().nullable().optional(),
  away_score: z.coerce.number().nullable().optional(),
  fiks_id: z.string().nullable().optional(),
  opponent_logo_url: z.string().nullable().optional(),
  livestream_url: z.string().nullable().optional(),
});

type MatchFormValues = z.infer<typeof matchSchema>;

const AdminMatchEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  
  const { data: match, isLoading } = useAdminMatch(id || '');
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();

  const form = useForm<MatchFormValues>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      team: 'A-laget',
      opponent: '',
      venue: 'Tørteberg Kunstgress 2',
      venue_maps_url: 'https://maps.app.goo.gl/yGiXm1TC3PyCozxM8',
      match_date: '',
      match_time: '20:15',
      time_tbd: false,
      venue_tbd: false,
      is_home: true,
      competition: 'Treningskamp',
      status: 'upcoming',
      home_score: null,
      away_score: null,
      fiks_id: null,
      is_cancelled: false,
      opponent_logo_url: null,
      livestream_url: null,
    },
  });

  useEffect(() => {
    if (match && !isNew) {
      const { date: dateStr, time: timeStr } = osloInputParts(match.match_date);
      
      form.reset({
        team: match.team as 'A-laget' | 'B-laget',
        opponent: match.opponent,
        venue: match.venue,
        venue_maps_url: (match as any).venue_maps_url ?? null,
        match_date: dateStr,
        match_time: timeStr,
        time_tbd: (match as any).time_tbd ?? false,
        venue_tbd: (match as any).venue_tbd ?? false,
        is_home: match.is_home,
        competition: match.competition,
        status: match.status as 'upcoming' | 'finished' | 'live',
        is_cancelled: (match as any).is_cancelled ?? false,
        home_score: match.home_score,
        away_score: match.away_score,
        fiks_id: match.fiks_id,
        opponent_logo_url: (match as any).opponent_logo_url ?? null,
        livestream_url: (match as any).livestream_url ?? null,
      });
    }
  }, [match, isNew, form]);

  const VENUE_MAPS: Record<string, string> = {
    'Tørteberg Kunstgress 2': 'https://maps.app.goo.gl/yGiXm1TC3PyCozxM8',
  };

  const venue = form.watch('venue');
  useEffect(() => {
    if (venue && VENUE_MAPS[venue]) {
      const currentUrl = form.getValues('venue_maps_url');
      if (!currentUrl || Object.values(VENUE_MAPS).includes(currentUrl)) {
        form.setValue('venue_maps_url', VENUE_MAPS[venue]);
      }
    }
  }, [venue, form]);

  const onSubmit = async (values: MatchFormValues) => {
    const timeStr = values.time_tbd ? '00:00' : (values.match_time || '00:00');
    const matchDateTime = osloWallTimeToIso(values.match_date, timeStr);
    
    const input: MatchInput = {
      team: values.team,
      opponent: values.opponent,
      venue: values.venue_tbd ? 'Sted kommer' : values.venue,
      venue_maps_url: values.venue_tbd ? null : (values.venue_maps_url || null),
      match_date: matchDateTime,
      is_home: values.is_home,
      competition: values.competition,
      status: values.status,
      home_score: values.status === 'finished' ? values.home_score : null,
      away_score: values.status === 'finished' ? values.away_score : null,
      fiks_id: values.fiks_id || null,
      opponent_logo_url: values.opponent_logo_url || null,
      time_tbd: values.time_tbd || false,
      venue_tbd: values.venue_tbd || false,
      livestream_url: values.livestream_url || null,
      is_cancelled: values.is_cancelled || false,
    };

    if (isNew) {
      await createMatch.mutateAsync(input);
    } else {
      if (!id) return;
      await updateMatch.mutateAsync({ id, ...input });
    }
    
    navigate('/admin/matches');
  };

  if (isLoading && !isNew) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  const isPending = createMatch.isPending || updateMatch.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Link to="/admin/matches">
            <Button variant="ghost" size="icon" aria-label="Tilbake til kamper">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{isNew ? 'Ny kamp' : 'Rediger kamp'}</h1>
            <p className="text-muted-foreground">
              {isNew ? 'Legg til en ny treningskamp eller cupkamp' : 'Oppdater kampinformasjon'}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Kampinfo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="team"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lag</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Velg lag" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="A-laget">A-laget</SelectItem>
                            <SelectItem value="B-laget">B-laget</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="competition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Turnering</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Velg turnering" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Treningskamp">Treningskamp</SelectItem>
                            <SelectItem value="Cup">Cup</SelectItem>
                            <SelectItem value="NM">NM</SelectItem>
                            <SelectItem value="5. divisjon">5. divisjon</SelectItem>
                            <SelectItem value="6. divisjon">6. divisjon</SelectItem>
                            <SelectItem value="7. divisjon">7. divisjon</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="opponent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motstander</FormLabel>
                      <FormControl>
                        <Input placeholder="F.eks. Skeid 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Opponent Logo Upload */}
                <FormField
                  control={form.control}
                  name="opponent_logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motstanderlogo (valgfritt)</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value ?? null}
                          onChange={(url) => field.onChange(url)}
                          folder="opponent-logos"
                        />
                      </FormControl>
                      <FormDescription>
                        Last opp logo for motstanderlaget. For seriekamper hentes logoer automatisk.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="venue_tbd"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Sted kommer</FormLabel>
                        <FormDescription>
                          Kampsted er ikke fastsatt ennå
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="venue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sted</FormLabel>
                      <FormControl>
                        <Input placeholder="F.eks. Tørteberg Kunstgress 2" {...field} disabled={form.watch('venue_tbd')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Google Maps URL */}
                <FormField
                  control={form.control}
                  name="venue_maps_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          Google Maps-lenke (valgfritt)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://maps.google.com/..." 
                          {...field} 
                          value={field.value ?? ''} 
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormDescription>
                        Lim inn Google Maps-lenke for kampstedet
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="match_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dato</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="match_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Klokkeslett</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} disabled={form.watch('time_tbd')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="time_tbd"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Tid kommer</FormLabel>
                        <FormDescription>
                          Kamptidspunkt er ikke fastsatt ennå
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_home"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Hjemmekamp</FormLabel>
                        <FormDescription>
                          Er dette en hjemmekamp for Fagerborg?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status og resultat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Velg status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="upcoming">Kommende</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="finished">Ferdig</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('status') === 'finished' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="home_score"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hjemmemål</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              {...field} 
                              value={field.value ?? ''} 
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormDescription>
                            {form.watch('is_home') ? 'Fagerborg' : form.watch('opponent') || 'Motstander'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="away_score"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bortemål</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              {...field} 
                              value={field.value ?? ''} 
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormDescription>
                            {!form.watch('is_home') ? 'Fagerborg' : form.watch('opponent') || 'Motstander'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="fiks_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FIKS-ID (valgfritt)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="F.eks. 8432157" 
                          {...field} 
                          value={field.value ?? ''} 
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormDescription>
                        Kamp-ID fra fotball.no for å lenke til kampinfo
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_cancelled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Avlyst</FormLabel>
                        <FormDescription>
                          Merk kampen som avlyst
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                {isNew ? 'Opprett kamp' : 'Lagre endringer'}
              </Button>
              <Link to="/admin/matches">
                <Button type="button" variant="outline">
                  Avbryt
                </Button>
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
};

export default AdminMatchEdit;
