import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { News } from '@/lib/supabase-types';

export const useAdminNews = () => {
  return useQuery({
    queryKey: ['admin-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .is('deleted_at', null)
        .order('published_at', { ascending: false });
      
      if (error) throw error;
      return data as News[];
    },
  });
};

export const useDeletedNews = () => {
  return useQuery({
    queryKey: ['admin-news-trash'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      
      if (error) throw error;
      return data as News[];
    },
  });
};

export const useAdminNewsArticle = (id: string) => {
  return useQuery({
    queryKey: ['admin-news', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as News | null;
    },
    enabled: !!id,
  });
};

export const useCreateNews = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (article: Omit<News, 'id' | 'created_at' | 'updated_at' | 'view_count'>) => {
      const { data, error } = await supabase
        .from('news')
        .insert(article)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log activity
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_log').insert({
        type: 'news_created',
        payload: { news_id: data.id, title: article.title, user_id: user?.id }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({ title: 'Nyhet opprettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved opprettelse', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateNews = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<News> & { id: string }) => {
      const { data, error } = await supabase
        .from('news')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log activity
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_log').insert({
        type: 'news_updated',
        payload: { news_id: id, changes: updates, user_id: user?.id }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({ title: 'Nyhet oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved oppdatering', description: error.message, variant: 'destructive' });
    },
  });
};

export const useToggleFeatured = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, is_featured }: { id: string; is_featured: boolean }) => {
      let nextOrder = 0;
      // If featuring, enforce max 3 by unfeaturing the oldest
      if (is_featured) {
        const { data: currentFeatured } = await supabase
          .from('news')
          .select('id, published_at, carousel_order')
          .eq('is_featured', true)
          .order('carousel_order', { ascending: true })
          .order('published_at', { ascending: false });
        
        nextOrder = Math.max(0, ...(currentFeatured || []).map(a => a.carousel_order ?? 0)) + 1;

        if (currentFeatured && currentFeatured.length >= 3) {
          // Unfeature the oldest ones beyond the limit (keep newest 2 + the new one)
          const toUnfeature = currentFeatured.slice(2);
          for (const article of toUnfeature) {
            await supabase
              .from('news')
              .update({ is_featured: false })
              .eq('id', article.id);
          }
        }
      }

      const { data, error } = await supabase
        .from('news')
        .update({ is_featured, carousel_order: is_featured ? nextOrder : 0 })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({ 
        title: variables.is_featured 
          ? 'Artikkel fremhevet (maks 3 i karusellen)' 
          : 'Fremheving fjernet' 
      });
    },
    onError: (error) => {
      toast({ title: 'Feil ved oppdatering', description: error.message, variant: 'destructive' });
    },
  });
};

export const useReorderFeatured = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from('news')
          .update({ carousel_order: i + 1 })
          .eq('id', orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({ title: 'Rekkefølge oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved endring av rekkefølge', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteNews = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('news')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_log').insert({
        type: 'news_deleted',
        payload: { news_id: id, user_id: user?.id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      queryClient.invalidateQueries({ queryKey: ['admin-news-trash'] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({ title: 'Nyhet flyttet til søppelkurven' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });
};

export const useRestoreNews = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('news')
        .update({ deleted_at: null })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      queryClient.invalidateQueries({ queryKey: ['admin-news-trash'] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({ title: 'Nyhet gjenopprettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved gjenoppretting', description: error.message, variant: 'destructive' });
    },
  });
};

export const usePermanentlyDeleteNews = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news-trash'] });
      toast({ title: 'Nyhet permanent slettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });
};
