import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Loader2 } from 'lucide-react';

interface Preview { season: number; complete: boolean; goals: number; entry_id: string; entries: { id: string; name: string }[]; to: string; subject: string; html: string }

export default function GoalClubInvoicePreview({season}:{season:number}) {
  const [open, setOpen] = useState(false);
  const [entryId, setEntryId] = useState<string | undefined>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['goal-club-invoice-preview',season, entryId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('goal-club-season-close', { body: { preview: true, season, entry_id: entryId } });
      if (error) throw error;
      return data as Preview;
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Eye className="h-4 w-4 mr-2" />Forhåndsvis faktura</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Forhåndsvisning av faktura</DialogTitle>
          <DialogDescription>
            Ingenting sendes. {data && !data.complete && `Sesongen er ikke ferdig – tallene viser stillingen nå (${data.goals} mål så langt).`}
          </DialogDescription>
        </DialogHeader>
        {data && data.entries.length > 0 && (
          <Select value={data.entry_id} onValueChange={setEntryId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.entries.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : error ? (
          <p className="text-sm text-destructive">Kunne ikke lage forhåndsvisning.</p>
        ) : data && (
          <>
            <div className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Til:</span> {data.to}</div>
              <div><span className="text-muted-foreground">Emne:</span> {data.subject}</div>
            </div>
            <iframe title="Faktura" srcDoc={data.html} sandbox="" className="w-full flex-1 min-h-[60vh] rounded-md border bg-background" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
