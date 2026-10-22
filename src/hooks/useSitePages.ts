import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SitePage {
  id: string;
  key: string;
  title: string;
  body: string | null;
  updated_at: string;
  updated_by: string | null;
}

export const useSitePages = () => {
  return useQuery({
    queryKey: ['site-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_pages')
        .select('*')
        .order('title', { ascending: true });
      
      if (error) throw error;
      return data as SitePage[];
    },
  });
};

export const useSitePage = (key: string) => {
  return useQuery({
    queryKey: ['site-page', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_pages')
        .select('*')
        .eq('key', key)
        .maybeSingle();
      
      if (error) throw error;
      return data as SitePage | null;
    },
    enabled: !!key,
  });
};

export const useUpdateSitePage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ key, title, body }: { key: string; title: string; body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('site_pages')
        .update({ title, body, updated_by: user?.id })
        .eq('key', key)
        .select()
        .single();
      
      if (error) throw error;
      
      await supabase.from('activity_log').insert({
        type: 'page_updated',
        payload: { page_key: key, title, user_id: user?.id }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-pages'] });
      toast({ title: 'Side oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved oppdatering', description: error.message, variant: 'destructive' });
    },
  });
};
