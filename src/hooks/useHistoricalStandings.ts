import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HistoricalStanding {
  id: string;
  team: string;
  year: number;
  division: string;
  position: number | null;
  result: 'normal' | 'promotion' | 'relegation' | 'qualification' | null;
  table_url: string | null;
  created_at: string;
  updated_at: string;
}

export const useHistoricalStandings = (team: string = 'A-laget') => {
  return useQuery({
    queryKey: ['historical_standings', team],
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
