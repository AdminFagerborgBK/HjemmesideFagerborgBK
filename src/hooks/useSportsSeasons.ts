import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** All configured seasons (public read), used for year filters. */
export function useSportsSeasons() {
  return useQuery({
    queryKey: ['sports-seasons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sports_seasons').select('season,is_active').order('season', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
