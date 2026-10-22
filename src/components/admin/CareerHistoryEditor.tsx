import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { CareerEntry } from '@/hooks/useSiteRoster';
import { Loader2, Plus, Trash2, Download, ExternalLink, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CareerHistoryEditorProps {
  career: CareerEntry[];
  onChange: (career: CareerEntry[]) => void;
  fotballNoUrl: string;
  onUrlChange: (url: string) => void;
  onNameScraped?: (name: string) => void;
  birthDate: string | null;
  onBirthDateChange: (date: string | null) => void;
  nifsUrl: string;
  onNifsUrlChange: (url: string) => void;
}

export const CareerHistoryEditor = ({ career, onChange, fotballNoUrl, onUrlChange, onNameScraped, birthDate, onBirthDateChange, nifsUrl, onNifsUrlChange }: CareerHistoryEditorProps) => {
  const [isScraping, setIsScraping] = useState(false);
  const [isScrapingNifs, setIsScrapingNifs] = useState(false);
  const { toast } = useToast();

  const handleScrape = async () => {
    if (!fotballNoUrl) {
      toast({ title: 'Mangler URL', description: 'Legg inn fotball.no-lenke først', variant: 'destructive' });
      return;
    }

    setIsScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-player-cv', {
        body: { url: fotballNoUrl },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Ukjent feil');

      onChange(data.data.career);
      if (data.data.name && onNameScraped) {
        onNameScraped(data.data.name);
      }
      toast({ title: 'CV importert', description: `${data.data.career.length} klubber hentet for ${data.data.name || 'spiller'}` });
    } catch (err: any) {
      toast({ title: 'Feil ved import', description: err.message, variant: 'destructive' });
    } finally {
      setIsScraping(false);
    }
  };

  const addEntry = () => {
    onChange([...career, { club: '', seasons: '', appearances: 0, goals: 0 }]);
  };

  const removeEntry = (index: number) => {
    onChange(career.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof CareerEntry, value: string | number) => {
    const updated = [...career];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleScrapeNifs = async () => {
    if (!nifsUrl) {
      toast({ title: 'Mangler URL', description: 'Legg inn nifs.no-lenke først', variant: 'destructive' });
      return;
    }

    setIsScrapingNifs(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-player-cv', {
        body: { nifs_url: nifsUrl },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Ukjent feil');

      if (data.data.birth_date) {
        onBirthDateChange(data.data.birth_date);
        toast({ title: 'Fødselsdato hentet', description: `Fødselsdato: ${data.data.birth_date}` });
      } else {
        toast({ title: 'Ingen fødselsdato funnet', variant: 'destructive' });
      }
      if (data.data.name && onNameScraped) {
        onNameScraped(data.data.name);
      }
    } catch (err: any) {
      toast({ title: 'Feil ved import', description: err.message, variant: 'destructive' });
    } finally {
      setIsScrapingNifs(false);
    }
  };

  const calculateAge = (dateStr: string) => {
    const today = new Date();
    const birth = new Date(dateStr);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  return (
    <div className="space-y-4">
      {/* Birth date from nifs.no */}
      <div className="space-y-2">
        <Label>Fødselsdato (fra nifs.no)</Label>
        <div className="flex gap-2">
          <Input
            value={nifsUrl}
            onChange={(e) => onNifsUrlChange(e.target.value)}
            placeholder="https://www.nifs.no/personprofil.php?..."
            className="flex-1"
          />
          {nifsUrl && (
            <Button type="button" variant="outline" size="icon" asChild>
              <a href={nifsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleScrapeNifs}
            disabled={isScrapingNifs || !nifsUrl}
          >
            {isScrapingNifs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Hent fødselsdato
          </Button>
          {birthDate && (
            <span className="text-sm text-muted-foreground">
              Født: {birthDate} ({calculateAge(birthDate)} år)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="manual_birth_date" className="text-sm text-muted-foreground">Eller legg inn manuelt:</Label>
          <Input
            id="manual_birth_date"
            type="date"
            value={birthDate || ''}
            onChange={(e) => onBirthDateChange(e.target.value || null)}
            className="h-8 w-auto text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fotball_no_url">Fotball.no-profil</Label>
        <div className="flex gap-2">
          <Input
            id="fotball_no_url"
            value={fotballNoUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://www.fotball.no/fotballdata/person/profil/?fiksId=..."
            className="flex-1"
          />
          {fotballNoUrl && (
            <Button type="button" variant="outline" size="icon" asChild>
              <a href={fotballNoUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleScrape}
          disabled={isScraping || !fotballNoUrl}
        >
          {isScraping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Hent CV fra fotball.no
        </Button>
      </div>

      {career.length > 0 && (
        <div className="space-y-2">
          <Label>Karrierehistorikk</Label>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_100px_70px_70px_40px] gap-2 p-2 bg-muted text-xs font-medium text-muted-foreground">
              <span>Klubb</span>
              <span>Divisjon</span>
              <span>Periode</span>
              <span>Kamper</span>
              <span>Mål</span>
              <span></span>
            </div>
            {career.map((entry, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_70px_70px_40px] gap-2 p-2 border-t border-border items-center">
                <Input
                  value={entry.club}
                  onChange={(e) => updateEntry(i, 'club', e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  value={entry.division || ''}
                  onChange={(e) => {
                    const updated = [...career];
                    updated[i] = { ...updated[i], division: e.target.value || undefined };
                    onChange(updated);
                  }}
                  className="h-8 text-sm"
                  placeholder="3. div"
                />
                <Input
                  value={entry.seasons}
                  onChange={(e) => updateEntry(i, 'seasons', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="2020–2023"
                />
                <Input
                  type="number"
                  value={entry.appearances}
                  onChange={(e) => updateEntry(i, 'appearances', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={entry.goals}
                  onChange={(e) => updateEntry(i, 'goals', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeEntry(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        <Plus className="h-4 w-4 mr-2" />
        Legg til klubb manuelt
      </Button>
    </div>
  );
};
