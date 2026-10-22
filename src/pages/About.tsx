import { useState } from 'react';
import { MapPin, Trophy, Calendar, Target, Info, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useHistoricalStandings } from '@/hooks/useHistoricalStandings';

import { useSitePage } from '@/hooks/useSitePages';
import { Skeleton } from '@/components/ui/skeleton';
import MarkdownContent from '@/components/MarkdownContent';

/** Known relegation notes for specific team+year combos */
const relegationNotes: Record<string, string> = {
  'B-laget-2023': 'Nedrykk pga. A-lagets nedrykk',
};

const HistoricalTable = ({ team }: { team: string }) => {
  const { data: historicalStandings, isLoading } = useHistoricalStandings(team);

  const yearRange = historicalStandings && historicalStandings.length > 0
    ? `${historicalStandings[historicalStandings.length - 1].year}–${historicalStandings[0].year}`
    : '';

  return (
    <TooltipProvider delayDuration={100}>
      <div>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Target className="w-7 h-7 text-primary" />
          Tabellplasseringer {yearRange}
        </h2>

        <div className="bg-card rounded-xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 sm:px-6 py-4 text-left font-semibold">Sesong</th>
                <th className="px-3 sm:px-6 py-4 text-left font-semibold">Divisjon</th>
                <th className="px-3 sm:px-6 py-4 text-center font-semibold">Plassering</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-6 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-20 mx-auto" /></td>
                  </tr>
                ))
              ) : (
                historicalStandings?.map((row) => {
                  const noteKey = `${team}-${row.year}`;
                  const note = relegationNotes[noteKey];

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-border/50 ${row.result !== 'normal' && row.result !== null ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-3 sm:px-6 py-3 font-medium">
                        {row.table_url ? (
                          <a
                            href={row.table_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {row.year}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          row.year
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-muted-foreground">{row.division}</td>
                      <td className={`px-3 sm:px-6 py-3 font-bold ${row.result !== 'normal' && row.result !== null ? 'text-primary' : ''}`}>
                        <div className="flex items-center justify-center gap-1 sm:gap-3">
                          <span className="w-16 text-center">{row.position ? `${row.position}. plass` : '–'}</span>
                          <span className="w-24">
                            {row.result === 'promotion' && (
                              <span className="text-xs text-green-600 inline-flex items-center gap-1">
                                <ArrowUp className="w-3 h-3" /> Opprykk
                              </span>
                            )}
                            {row.result === 'relegation' && (
                              <span className="text-xs text-red-600 inline-flex items-center gap-1">
                                <ArrowDown className="w-3 h-3" /> Nedrykk
                                {note && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-3 h-3 text-muted-foreground cursor-help ml-0.5" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                                      {note}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </span>
                            )}
                            {row.result === 'qualification' && (
                              <span className="text-xs text-amber-600 inline-flex items-center gap-1">
                                Kvalifisering
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
};

const About = () => {
  const location = useLocation();
  const { data: historyPage, isLoading: isLoadingHistoryPage } = useSitePage('history');
  const { data: facilitiesPage, isLoading: isLoadingFacilities } = useSitePage('facilities');
  const { data: recordsPage, isLoading: isLoadingRecords } = useSitePage('records');
  const [selectedTeam, setSelectedTeam] = useState<string>('A-laget');
  
  const getDefaultTab = () => {
    const hash = location.hash;
    if (hash === '#historie') return 'historie';
    if (hash === '#anlegg') return 'anlegg';
    if (hash === '#rekorder') return 'rekorder';
    if (hash === '#tabeller') return 'tabeller';
    return 'historie';
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Om klubben og historien vår | Fagerborg BK"
        description="Fagerborg BK ble stiftet i 1914. Les om klubbens historie, anlegg, rekorder og tidligere sesonger."
        path="/om-klubben"
      />
      <Header />
      <main className="pt-20">
        <section className="bg-fagerborg-gradient py-16">
          <div className="container mx-auto px-4 text-center">
            <img src={fagerborgLogo} alt="Fagerborg BK" className="w-32 h-32 mx-auto mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Om Fagerborg BK</h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">Stolt tradisjon siden 14. mai 1914</p>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4 max-w-5xl">
            <Tabs defaultValue={getDefaultTab()} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8 h-auto">
                <TabsTrigger value="historie" className="text-xs sm:text-sm whitespace-normal py-2">Historie</TabsTrigger>
                <TabsTrigger value="anlegg" className="text-xs sm:text-sm whitespace-normal py-2">Bane & Anlegg</TabsTrigger>
                <TabsTrigger value="rekorder" className="text-xs sm:text-sm whitespace-normal py-2">Klubbrekorder</TabsTrigger>
                <TabsTrigger value="tabeller" className="text-xs sm:text-sm whitespace-normal py-2">Tabellhistorikk</TabsTrigger>
              </TabsList>

              <TabsContent value="historie">
                <div className="prose prose-lg max-w-none">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <Calendar className="w-7 h-7 text-primary" />
                    {historyPage?.title || 'Fagerborgs historie'}
                  </h2>
                  
                  {isLoadingHistoryPage ? (
                    <div className="space-y-4">
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : historyPage?.body ? (
                    <MarkdownContent content={historyPage.body} />
                  ) : (
                    <p className="text-muted-foreground">Ingen historie lagt til ennå.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="anlegg">
                <div className="prose prose-lg max-w-none">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <MapPin className="w-7 h-7 text-primary" />
                    {facilitiesPage?.title || 'Bane og anlegg'}
                  </h2>
                  
                  {isLoadingFacilities ? (
                    <div className="space-y-4">
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : facilitiesPage?.body ? (
                    <MarkdownContent content={facilitiesPage.body} />
                  ) : (
                    <p className="text-muted-foreground">Ingen informasjon om bane og anlegg lagt til ennå.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="rekorder">
                <div className="prose prose-lg max-w-none">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <Trophy className="w-7 h-7 text-primary" />
                    {recordsPage?.title || 'Klubbrekorder'}
                  </h2>
                  
                  {isLoadingRecords ? (
                    <div className="space-y-4">
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : recordsPage?.body ? (
                    <MarkdownContent content={recordsPage.body} />
                  ) : (
                    <p className="text-muted-foreground">Ingen klubbrekorder lagt til ennå.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tabeller">
                <div className="prose prose-lg max-w-none">
                  {/* Team toggle */}
                  <div className="flex gap-2 mb-6 not-prose">
                    {(['A-laget', 'B-laget'] as const).map((team) => (
                      <button
                        key={team}
                        onClick={() => setSelectedTeam(team)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                          selectedTeam === team
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        {team}
                      </button>
                    ))}
                  </div>

                  <HistoricalTable team={selectedTeam} />
                </div>
              </TabsContent>
            </Tabs>

            {/* Club info card */}
            <div className="mt-12 bg-card rounded-xl p-6 shadow-card">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                Klubbinfo
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Org.nummer:</span>
                  <span className="font-medium">996 145 530</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stiftet:</span>
                  <span className="font-medium">14. mai 1914</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hjemmebaner:</span>
                  <span className="font-medium">Marienlyst / Tørteberg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Farger:</span>
                  <span className="font-medium">Gul/grønne vertikale striper</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;