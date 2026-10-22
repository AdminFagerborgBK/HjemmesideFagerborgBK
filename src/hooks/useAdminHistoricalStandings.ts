import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HistoricalStanding {
  id: string;
  team: string;
  year: number;
  division: string;
  position: number | null;
  result: 'normal' | 'promotion' | 'relegation' | 'qualification' | null;
  table_url: string | null;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export const useAdminHistoricalStandings = (team: string = 'A-laget') => {
  return useQuery({
    queryKey: ['admin-historical-standings', team],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historical_standings')
        .select('*')
        .eq('team', team)
        .order('year', { ascending: false });

      if (error) throw error;
      return data as HistoricalStanding[];
    },
  });
};

export const useCreateHistoricalStanding = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (standing: Omit<HistoricalStanding, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('historical_standings')
        .insert([standing])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-historical-standings'] });
      queryClient.invalidateQueries({ queryKey: ['historical_standings'] });
      toast({ title: 'Tabellplassering lagt til' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved lagring', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateHistoricalStanding = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HistoricalStanding> & { id: string }) => {
      const { data, error } = await supabase
        .from('historical_standings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-historical-standings'] });
      queryClient.invalidateQueries({ queryKey: ['historical_standings'] });
      toast({ title: 'Tabellplassering oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved oppdatering', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteHistoricalStanding = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('historical_standings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-historical-standings'] });
      queryClient.invalidateQueries({ queryKey: ['historical_standings'] });
      toast({ title: 'Tabellplassering slettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });
};
