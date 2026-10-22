import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SiteVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_protected: boolean;
  protected_password: string | null;
  category: string | null;
  match_id: string | null;
}

export const useSiteVideos = (includeAll = false) => {
  return useQuery({
    queryKey: ['site-videos', includeAll],
    queryFn: async () => {
      const sortByEffectiveDate = async (videos: SiteVideo[]) => {
        const matchIds = Array.from(
          new Set(videos.map((v) => v.match_id).filter((id): id is string => !!id))
        );
        let matchDateMap = new Map<string, string>();
        if (matchIds.length > 0) {
          const { data: matches } = await supabase
            .from('matches_public')
            .select('id, match_date')
            .in('id', matchIds);
          if (matches) {
            matchDateMap = new Map(matches.map((m: any) => [m.id, m.match_date]));
          }
        }
        const effective = (v: SiteVideo) =>
          (v.match_id && matchDateMap.get(v.match_id)) || v.published_at || v.created_at;
        return [...videos].sort((a, b) => {
          const ao = (a as any).sort_order ?? 0;
          const bo = (b as any).sort_order ?? 0;
          if (ao !== bo) return bo - ao;
          return new Date(effective(b)).getTime() - new Date(effective(a)).getTime();
        });
      };

      if (includeAll) {
        // Admin: query base table directly
        const { data, error } = await supabase
          .from('site_videos')
          .select('*')
          .order('sort_order', { ascending: false })
          .order('published_at', { ascending: false, nullsFirst: false });
        if (error) throw error;
        return await sortByEffectiveDate(data as SiteVideo[]);
      } else {
        // Public: use view that excludes protected_password, only show past published_at
        const { data, error } = await supabase
          .from('site_videos_public' as any)
          .select('*')
          .lte('published_at', new Date().toISOString())
          .order('sort_order', { ascending: false })
          .order('published_at', { ascending: false, nullsFirst: false });
        if (error) throw error;
        return await sortByEffectiveDate((data as unknown) as SiteVideo[]);
      }
    },
  });
};

export const useSiteVideo = (id: string) => {
  return useQuery({
    queryKey: ['site-video', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_videos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as SiteVideo | null;
    },
    enabled: !!id,
  });
};

export const useCreateSiteVideo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (video: Omit<SiteVideo, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('site_videos')
        .insert({ ...video, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      
      await supabase.from('activity_log').insert({
        type: 'video_created',
        payload: { video_id: data.id, title: video.title, user_id: user?.id }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-videos'] });
      toast({ title: 'Video opprettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved opprettelse', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateSiteVideo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SiteVideo> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('site_videos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      await supabase.from('activity_log').insert({
        type: 'video_updated',
        payload: { video_id: id, changes: updates, user_id: user?.id }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-videos'] });
      toast({ title: 'Video oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved oppdatering', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteSiteVideo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: video } = await supabase
        .from('site_videos')
        .select('title')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('site_videos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await supabase.from('activity_log').insert({
        type: 'video_deleted',
        payload: { video_id: id, title: video?.title, user_id: user?.id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-videos'] });
      toast({ title: 'Video slettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });
};
