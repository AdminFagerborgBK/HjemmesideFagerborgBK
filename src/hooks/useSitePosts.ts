import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SitePost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useSitePosts = (includeAll = false) => {
  return useQuery({
    queryKey: ['site-posts', includeAll],
    queryFn: async () => {
      let query = supabase
        .from('site_posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!includeAll) {
        query = query.eq('status', 'published');
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as SitePost[];
    },
  });
};

export const useSitePost = (id: string) => {
  return useQuery({
    queryKey: ['site-post', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as SitePost | null;
    },
    enabled: !!id,
  });
};

export const useCreateSitePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (post: Omit<SitePost, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('site_posts')
        .insert({ ...post, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_log').insert({
        type: 'post_created',
        payload: { post_id: data.id, title: post.title, user_id: user?.id }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-posts'] });
      toast({ title: 'Innlegg opprettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved opprettelse', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateSitePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SitePost> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('site_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_log').insert({
        type: 'post_updated',
        payload: { post_id: id, changes: updates, user_id: user?.id }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-posts'] });
      toast({ title: 'Innlegg oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved oppdatering', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteSitePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get post title for logging
      const { data: post } = await supabase
        .from('site_posts')
        .select('title')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('site_posts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_log').insert({
        type: 'post_deleted',
        payload: { post_id: id, title: post?.title, user_id: user?.id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-posts'] });
      toast({ title: 'Innlegg slettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });
};
