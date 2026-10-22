import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Target, Users, Award, Mail, Phone, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import { useSiteRoster, SiteRosterMember, CareerEntry } from '@/hooks/useSiteRoster';

type TeamTab = 'A-laget' | 'B-laget';
type PositionFilter = 'Alle' | 'Keepere' | 'Forsvar' | 'Midtbane' | 'Angrep';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  const first = parts[0][0]?.toUpperCase() || '';
  const last = parts[parts.length - 1][0]?.toUpperCase() || '';
  return parts.length === 1 ? first : first + last;
}

const PLAYER_CATEGORIES = ['Keepere', 'Forsvar', 'Midtbane', 'Angrep'];
const STAFF_CATEGORIES = ['Trenere', 'Ledere', 'Styret', 'Andre'];

const calculateAge = (dateStr: string) => {
  const today = new Date();
  const birth = new Date(dateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

function normalizeDivision(div: string): string {
  if (!div) return div;
  const m = div.match(/^(\d+)\.?\s*(?:divisjon|div\.?\s*(?:avd\.?\s*\d+)?)/i);
  if (m) return `${m[1]}. div.`;
  return div;
}

const PlayerSquad = () => {
  const [searchParams] = useSearchParams();
  const teamFromUrl = searchParams.get('lag') === 'B-laget' ? 'B-laget' : 'A-laget';
  const [activeTeam, setActiveTeam] = useState<TeamTab>(teamFromUrl);
  
  useEffect(() => {
    setActiveTeam(teamFromUrl);
  }, [teamFromUrl]);
  const [activePosition, setActivePosition] = useState<PositionFilter>('Alle');
  const [selectedMember, setSelectedMember] = useState<SiteRosterMember | null>(null);
  
  const { data: roster, isLoading } = useSiteRoster();

  // Split into players and staff
  const players = roster?.filter(m => PLAYER_CATEGORIES.includes(m.category) && m.team === activeTeam) || [];
  const trainers = roster?.filter(m => m.category === 'Trenere') || [];

  const filteredPlayers = players.filter(p => {
    if (activePosition === 'Alle') return true;
    return p.category === activePosition;
  });

  const groupedPlayers = filteredPlayers.reduce((acc, player) => {
    const cat = player.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(player);
    return acc;
  }, {} as Record<string, SiteRosterMember[]>);

  const sortedCategories = PLAYER_CATEGORIES.filter(c => groupedPlayers[c]?.length);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Spillerstall for A-laget og B-laget | Fagerborg BK"
        description="Bli kjent med spillerne og trenerteamet i Fagerborg BK, med posisjoner, draktnummer og karrierehistorikk."
        path="/spillerstall"
      />
      <Header />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-fagerborg-gradient py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Spillerstall</h1>
            <p className="text-white/80 text-lg">
              Møt spillerne som representerer Fagerborg BK
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="py-8 bg-card border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Team Tabs */}
              <div className="flex gap-2">
                {(['A-laget', 'B-laget'] as TeamTab[]).map((team) => (
                  <button
                    key={team}
                    onClick={() => setActiveTeam(team)}
                    className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                      activeTeam === team
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {team}
                  </button>
                ))}
              </div>

              {/* Position Filter */}
              <div className="flex flex-wrap gap-2">
                {(['Alle', 'Keepere', 'Forsvar', 'Midtbane', 'Angrep'] as PositionFilter[]).map((position) => (
                  <button
                    key={position}
                    onClick={() => setActivePosition(position)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activePosition === position
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {position}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trainers Section */}
        {trainers.length > 0 && (
          <section className="py-8 bg-muted/30">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <span className="w-2 h-8 bg-primary rounded-full" />
                Trenere
              </h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {trainers.map((trainer) => (
                  <div
                    key={trainer.id}
                    className="bg-card rounded-xl overflow-hidden shadow-card"
                  >
                    <div className="relative aspect-[4/5] bg-gradient-to-b from-muted to-muted/50 flex items-center justify-center">
                      {trainer.photo_url ? (
                        <img
                          src={trainer.photo_url}
                          alt={trainer.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl font-bold text-muted-foreground/40">{getInitials(trainer.full_name)}</span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg text-foreground mb-1">{trainer.full_name}</h3>
                      {trainer.role_or_position && (
                        <p className="text-sm text-primary font-medium mb-2">{trainer.role_or_position}</p>
                      )}
                      <div className="space-y-1">
                        {trainer.show_email && trainer.contact_email && (
                          <a 
                            href={`mailto:${trainer.contact_email}`}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {trainer.contact_email}
                          </a>
                        )}
                        {trainer.show_phone && trainer.contact_phone && (
                          <a 
                            href={`tel:${trainer.contact_phone}`}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {trainer.contact_phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Players Grid */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Laster spillere...</div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Ingen spillere funnet
              </div>
            ) : (
              <div className="space-y-12">
                {sortedCategories.map((category) => (
                  <div key={category}>
                    <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                      <span className="w-2 h-8 bg-primary rounded-full" />
                      {category}
                    </h2>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {groupedPlayers[category]?.map((member) => (
                        <div
                          key={member.id}
                          onClick={() => setSelectedMember(member)}
                          className="group bg-card rounded-xl overflow-hidden shadow-card hover:shadow-elevated transition-all cursor-pointer"
                        >
                          <div className="relative aspect-[4/5] bg-gradient-to-b from-muted to-muted/50 flex items-center justify-center">
                            {member.photo_url ? (
                              <img
                                src={member.photo_url}
                                alt={member.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-4xl font-bold text-muted-foreground/40">{getInitials(member.full_name)}</span>
                            )}
                            {member.shirt_number && (
                              <span className="absolute top-3 right-3 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg">
                                {member.shirt_number}
                              </span>
                            )}
                            {member.birth_date && (
                              <span className="absolute bottom-2 left-3 text-xs font-semibold text-white bg-black/50 px-2 py-0.5 rounded-full">
                                {calculateAge(member.birth_date)} år
                              </span>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-bold text-lg text-foreground mb-1">{member.full_name}</h3>
                            {member.role_or_position && (
                              <p className="text-sm text-muted-foreground">{member.role_or_position}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Player Modal */}
        {selectedMember && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedMember(null)}
          >
            <div 
              className="bg-card rounded-2xl shadow-elevated max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-square bg-gradient-to-b from-primary/20 to-muted flex items-center justify-center">
                {selectedMember.photo_url ? (
                  <img
                    src={selectedMember.photo_url}
                    alt={selectedMember.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl font-bold text-muted-foreground/40">{getInitials(selectedMember.full_name)}</span>
                )}
                {selectedMember.shirt_number && (
                  <span className="absolute top-4 right-4 w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-2xl">
                    {selectedMember.shirt_number}
                  </span>
                )}
                <button
                  onClick={() => setSelectedMember(null)}
                  className="absolute top-4 left-4 w-10 h-10 bg-background/80 rounded-full flex items-center justify-center text-foreground hover:bg-background transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold text-foreground mb-1">{selectedMember.full_name}</h2>
                <p className="text-muted-foreground mb-6">
                  {selectedMember.category === 'Keepere' ? 'Keeper' : selectedMember.category} · {selectedMember.team}
                  {selectedMember.role_or_position && ` · ${selectedMember.role_or_position}`}
                  {selectedMember.birth_date && ` · ${calculateAge(selectedMember.birth_date)} år`}
                </p>

                {/* Career History */}
                {selectedMember.career_history.length > 0 && (
                  <div className="pt-2">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      Karriere
                      {selectedMember.fotball_no_url && (
                        <a 
                          href={selectedMember.fotball_no_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </h3>
                    <div className="space-y-1.5">
                      {(() => {
                        // Merge entries with the same club name into one row, even if spacing differs
                        const normalizeClubName = (club: string) => club.replace(/\s+/g, ' ').trim();
                        const clubMap = new Map<string, { club: string; divisions: string[]; allYears: number[]; appearances: number; goals: number }>();

                        for (const entry of selectedMember.career_history) {
                          const normalizedClub = normalizeClubName(entry.club);
                          const existing = clubMap.get(normalizedClub);
                          const years = (entry.seasons.match(/\d{4}/g) || []).map(Number);

                          if (existing) {
                            if (entry.division) existing.divisions.push(normalizeDivision(entry.division));
                            existing.allYears.push(...years);
                            existing.appearances += entry.appearances;
                            existing.goals += entry.goals;
                          } else {
                            clubMap.set(normalizedClub, {
                              club: normalizedClub,
                              divisions: entry.division ? [normalizeDivision(entry.division)] : [],
                              allYears: years,
                              appearances: entry.appearances,
                              goals: entry.goals,
                            });
                          }
                        }

                        const merged = [...clubMap.values()].map((m) => {
                          m.divisions = [...new Set(m.divisions)];
                          const sortedYears = [...new Set(m.allYears)].sort((a, b) => a - b);
                          let seasons = '';

                          if (sortedYears.length === 1) {
                            seasons = String(sortedYears[0]);
                          } else if (sortedYears.length > 1) {
                            const ranges: string[] = [];
                            let start = sortedYears[0];
                            let prev = sortedYears[0];

                            for (let i = 1; i <= sortedYears.length; i++) {
                              const curr = sortedYears[i];
                              if (curr === prev + 1) {
                                prev = curr;
                              } else {
                                ranges.push(start === prev ? String(start) : `${start}–${prev}`);
                                start = curr;
                                prev = curr;
                              }
                            }

                            seasons = ranges.join(', ');
                          }

                          return { ...m, seasons };
                        });
                        return merged.map((entry, i) => (
                          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-sm">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-medium text-foreground">{entry.club}</span>
                              {entry.divisions.map((div, j) => (
                                <span key={j} className="text-xs text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">{div}</span>
                              ))}
                              <span className="text-muted-foreground text-xs">{entry.seasons}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                              <span>{entry.appearances} kamper</span>
                              {entry.goals > 0 && <span>{entry.goals} mål</span>}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PlayerSquad;
