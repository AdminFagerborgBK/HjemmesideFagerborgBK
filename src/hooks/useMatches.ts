import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/lib/supabase-types';

export const useMatches = (team?: 'A-laget' | 'B-laget') => {
  return useQuery({
    queryKey: ['matches', team],
    queryFn: async () => {
      let query = supabase
        .from('matches_public')
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

export const useUpcomingMatches = (limit = 4, team?: 'A-laget' | 'B-laget') => {
  return useQuery({
    queryKey: ['matches', 'upcoming', limit, team],
    queryFn: async () => {
      let query = supabase
        .from('matches_public')
        .select('*')
        .eq('status', 'upcoming')
        .eq('is_cancelled', false)
        .order('match_date', { ascending: true })
        .limit(limit);
      if (team) query = query.eq('team', team);
      const { data, error } = await query;
      if (error) throw error;
      return data as Match[];
    },
  });
};

export const useRecentResults = (limit = 4) => {
  return useQuery({
    queryKey: ['matches', 'finished', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches_public')
        .select('*')
        .eq('status', 'finished')
        .order('match_date', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as Match[];
    },
  });
};
