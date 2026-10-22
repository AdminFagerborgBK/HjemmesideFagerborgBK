import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSportsSeason } from './useSportsSeason';
import { useToast } from '@/hooks/use-toast';

export interface GoalClubEntry {
  id: string;
  name: string;
  is_company: boolean;
  goal_guess: number;
  amount_per_goal: number;
  created_at: string;
  is_anonymous?: boolean;
}

export interface GoalClubSubmission {
  name: string;
  is_company: boolean;
  phone: string;
  email: string;
  amount_per_goal: number;
  goal_guess: number;
  is_anonymous?: boolean;
}

export const useGoalClubEntries = () => {
  const {data:config}=useSportsSeason();
  return useQuery({
    enabled:!!config,
    queryKey: ['goal-club-entries',config?.season],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goal_club_public' as any)
        .select('*')
        .eq('season',config?.season ?? 0)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as GoalClubEntry[];
    },
  });
};

export const useSubmitGoalClub = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (entry: GoalClubSubmission) => {
      const { data, error } = await supabase.functions.invoke('goal-club-signup', {
        body: entry,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal-club-entries'] });
      toast({ title: 'Takk for din påmelding! ⚽', description: 'Du er nå med i Målklubben.' });
    },
    onError: (error: any) => {
      toast({ title: 'Noe gikk galt', description: error.message, variant: 'destructive' });
    },
  });
};
