import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface SiteSetting {
  id: string;
  key: string;
  value: Json;
  updated_at: string;
}

export const useSiteSettings = () => {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*');
      
      if (error) throw error;
      
      // Convert to a key-value map
      const settings: Record<string, Json> = {};
      (data as SiteSetting[]).forEach(setting => {
        settings[setting.key] = setting.value;
      });
      
      return settings;
    },
  });
};

export const useSiteSetting = (key: string) => {
  const { data: settings, isLoading } = useSiteSettings();
  return {
    value: settings?.[key],
    isLoading,
  };
};

export const useUpdateSiteSetting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key, value, updated_by: user?.id }, { onConflict: 'key' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    },
  });
};
