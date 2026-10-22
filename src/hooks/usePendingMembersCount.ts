import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePendingMembersCount() {
  return useQuery({
    queryKey: ['pending-members-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count ?? 0;
    },
    // Admin-only badge: fetched when an admin opens the panel, not on a timer.
    staleTime: 5 * 60 * 1000,
  });
}
