import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Player } from '@/lib/supabase-types';

export const usePlayers = (team?: 'A-laget' | 'B-laget') => {
  return useQuery({
    queryKey: ['players', team],
    queryFn: async () => {
      let query = supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('number', { ascending: true });
      
      if (team) {
        query = query.eq('team', team);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Player[];
    },
  });
};

export const usePlayer = (id: string) => {
  return useQuery({
    queryKey: ['player', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Player | null;
    },
    enabled: !!id,
  });
};
