import { useQuery } from '@tanstack/react-query';
import { useSportsSeason } from './useSportsSeason';
import { supabase } from '@/integrations/supabase/client';

export interface Standing {
  id: string;
  team: string;
  team_name: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string[];
  league: string;
  season: string;
  logo_url: string | null;
  team_url: string | null;
}

export const useStandings = (team: 'A-laget' | 'B-laget', season?: number) => {
  const {data:config}=useSportsSeason(season);
  return useQuery({
    enabled:!!config,
    queryKey: ['standings', team,config?.season],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standings')
        .select('*')
        .eq('season',String(config?.season ?? ''))
        .eq('team', team)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as Standing[];
    },
  });
};

export const useAllStandings = () => {
  const {data:config}=useSportsSeason();
  return useQuery({
    enabled:!!config,
    queryKey: ['standings', 'all',config?.season],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standings')
        .select('*')
        .eq('season',String(config?.season ?? ''))
        .order('team', { ascending: true })
        .order('position', { ascending: true });

      if (error) throw error;
      return data as Standing[];
    },
  });
};
