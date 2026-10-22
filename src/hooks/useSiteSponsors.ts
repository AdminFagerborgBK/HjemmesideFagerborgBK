import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

export interface SiteSponsor {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  tier: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useSiteSponsors = (includeInactive = false) => {
  return useQuery({
    queryKey: ['site-sponsors', includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('site_sponsors')
        .select('*')
        .order('tier', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SiteSponsor[];
    },
  });
};

export const useSiteSponsor = (id: string) => {
  return useQuery({
    queryKey: ['site-sponsor', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_sponsors')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as SiteSponsor | null;
    },
    enabled: !!id,
  });
};

export const useCreateSiteSponsor = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sponsor: Omit<SiteSponsor, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('site_sponsors')
        .insert(sponsor)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_log').insert({
        type: 'sponsor_created',
        payload: { sponsor_id: data.id, name: sponsor.name, user_id: user?.id }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-sponsors'] });
      toast({ title: 'Sponsor lagt til' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved opprettelse', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateSiteSponsor = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SiteSponsor> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('site_sponsors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_log').insert({
        type: 'sponsor_updated',
        payload: { sponsor_id: id, changes: updates, user_id: user?.id }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-sponsors'] });
      toast({ title: 'Sponsor oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved oppdatering', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteSiteSponsor = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: sponsor } = await supabase
        .from('site_sponsors')
        .select('name')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('site_sponsors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await supabase.from('activity_log').insert({
        type: 'sponsor_deleted',
        payload: { sponsor_id: id, name: sponsor?.name, user_id: user?.id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-sponsors'] });
      toast({ title: 'Sponsor slettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });
};

export const useTrackSponsorClick = () => {
  return useCallback(async (sponsorId: string) => {
    // Generate a session-based visitor ID (persisted in localStorage)
    let visitorId = localStorage.getItem('fbk_visitor_id');
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem('fbk_visitor_id', visitorId);
    }

    // Only allow one click per sponsor per visitor per day
    const todayKey = `fbk_click_${sponsorId}_${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(todayKey)) return;

    const { error } = await supabase.from('sponsor_clicks').insert({ 
      sponsor_id: sponsorId, 
      visitor_id: visitorId 
    });

    if (!error) {
      sessionStorage.setItem(todayKey, '1');
    }
  }, []);
};

export interface SponsorClickStats {
  sponsor_id: string;
  sponsor_name: string;
  month: string;
  clicks: number;
}

export const useSponsorClickStats = () => {
  return useQuery({
    queryKey: ['sponsor-click-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsor_clicks')
        .select('sponsor_id, clicked_at, visitor_id');

      if (error) throw error;

      // Get sponsor names
      const { data: sponsors } = await supabase
        .from('site_sponsors')
        .select('id, name');

      const sponsorMap = new Map(sponsors?.map(s => [s.id, s.name]) || []);

      // Deduplicate: count unique visitors per sponsor per month
      const monthlyUniqueMap = new Map<string, Map<string, Set<string>>>();
      const totalUniqueMap = new Map<string, Set<string>>();

      (data || []).forEach(click => {
        const date = new Date(click.clicked_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const sid = click.sponsor_id;
        const vid = click.visitor_id || 'unknown';

        if (!monthlyUniqueMap.has(sid)) monthlyUniqueMap.set(sid, new Map());
        const sponsorMonths = monthlyUniqueMap.get(sid)!;
        if (!sponsorMonths.has(monthKey)) sponsorMonths.set(monthKey, new Set());
        sponsorMonths.get(monthKey)!.add(vid);

        if (!totalUniqueMap.has(sid)) totalUniqueMap.set(sid, new Set());
        totalUniqueMap.get(sid)!.add(vid);
      });

      // Get all months sorted
      const allMonths = new Set<string>();
      monthlyUniqueMap.forEach(months => months.forEach((_, m) => allMonths.add(m)));
      const sortedMonths = Array.from(allMonths).sort();

      // Build per-sponsor summary with unique visitor counts
      const sponsorStats = Array.from(monthlyUniqueMap.entries()).map(([sid, months]) => ({
        id: sid,
        name: sponsorMap.get(sid) || 'Ukjent',
        total: totalUniqueMap.get(sid)?.size || 0,
        monthly: Object.fromEntries(
          Array.from(months.entries()).map(([m, visitors]) => [m, visitors.size])
        ),
      })).sort((a, b) => b.total - a.total);

      return { sponsorStats, months: sortedMonths };
    },
  });
};
