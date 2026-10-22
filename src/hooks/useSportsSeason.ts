import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { readSportsSeason, type SportsSeason } from '../../supabase/functions/_shared/sportsSeason';
export { teamConfig } from '../../supabase/functions/_shared/sportsSeason';

export function useSportsSeason(season?: number) {
  return useQuery<SportsSeason>({
    queryKey: ['sports-season', season ?? 'active'],
    queryFn: () => readSportsSeason(supabase, season),
  });
}