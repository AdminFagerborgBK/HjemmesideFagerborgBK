import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/lib/supabase-types';
import { toast } from 'sonner';

export type MatchInput = {
  team: 'A-laget' | 'B-laget';
  opponent: string;
  venue: string;
  match_date: string;
  is_home: boolean;
  competition: string;
  status: 'upcoming' | 'finished' | 'live';
  home_score?: number | null;
  away_score?: number | null;
  fiks_id?: string | null;
  opponent_logo_url?: string | null;
  venue_maps_url?: string | null;
  time_tbd?: boolean;
  venue_tbd?: boolean;
  livestream_url?: string | null;
  is_cancelled?: boolean;
};

export const useAdminMatches = (team?: 'A-laget' | 'B-laget') => {
  return useQuery({
    queryKey: ['admin-matches', team],
    queryFn: async () => {
      let query = supabase
        .from('matches')
        .select('*')
        .order('match_date', { ascending: true });
      
      if (team) {
        query = query.eq('team', team);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Match[];
    },
  });
};

export const useAdminMatch = (id: string) => {
  return useQuery({
    queryKey: ['admin-match', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Match;
    },
    enabled: !!id && id !== 'new',
  });
};

export const useCreateMatch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: MatchInput) => {
      const { data, error } = await supabase
        .from('matches')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-matches'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast.success('Kamp opprettet');
    },
    onError: (error) => {
      toast.error('Kunne ikke opprette kamp: ' + error.message);
    },
  });
};

export const useUpdateMatch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: MatchInput & { id: string }) => {
      const { data, error } = await supabase
        .from('matches')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-matches'] });
      queryClient.invalidateQueries({ queryKey: ['admin-match'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast.success('Kamp oppdatert');
    },
    onError: (error) => {
      toast.error('Kunne ikke oppdatere kamp: ' + error.message);
    },
  });
};

export const useDeleteMatch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-matches'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast.success('Kamp slettet');
    },
    onError: (error) => {
      toast.error('Kunne ikke slette kamp: ' + error.message);
    },
  });
};
