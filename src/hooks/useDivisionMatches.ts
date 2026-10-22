import { useQuery } from '@tanstack/react-query';
import { useSportsSeason, teamConfig } from './useSportsSeason';
import { supabase } from '@/integrations/supabase/client';

export interface DivisionMatch {
  id: string;
  fiks_id: string;
  division_fiks_id: string;
  round_number: number | null;
  match_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  venue: string | null;
  match_url: string | null;
}

export const useDivisionMatches = (divisionId?: string) => {
  const {data:config}=useSportsSeason();
  const divisionFiksId=divisionId ?? (config?teamConfig(config,'A-laget').tournament_id:undefined);
  return useQuery({
    enabled:!!divisionFiksId,
    queryKey: ['division-matches', divisionFiksId],
    queryFn: async (): Promise<DivisionMatch[]> => {
      const { data, error } = await supabase
        .from('division_matches')
        .select('*')
        .eq('division_fiks_id', divisionFiksId)
        .order('match_date', { ascending: true });
      if (error) throw error;
      return (data || []) as DivisionMatch[];
    },
    staleTime: 5 * 60 * 1000,
  });
};