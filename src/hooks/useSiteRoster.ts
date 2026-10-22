import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CareerEntry {
  club: string;
  seasons: string;
  appearances: number;
  goals: number;
  division?: string;
}

export interface SiteRosterMember {
  id: string;
  full_name: string;
  role_or_position: string | null;
  category: string;
  team: string;
  shirt_number: number | null;
  photo_url: string | null;
  status: 'active' | 'inactive';
  contact_email: string | null;
  contact_phone: string | null;
  show_email: boolean;
  show_phone: boolean;
  career_history: CareerEntry[];
  fotball_no_url: string | null;
  nifs_url: string | null;
  birth_date: string | null;
  created_at: string;
  updated_at: string;
}

export const ROSTER_CATEGORIES = [
  'Keepere',
  'Forsvar',
  'Midtbane',
  'Angrep',
  'Styret',
  'Trenere',
  'Ledere',
  'Andre'
] as const;

export const useSiteRoster = (includeAll = false) => {
  return useQuery({
    queryKey: ['site-roster', includeAll],
    queryFn: async () => {
      if (includeAll) {
        // Admin view: query base table directly (requires admin auth), exclude soft-deleted
        const { data, error } = await supabase
          .from('site_roster')
          .select('*')
          .is('deleted_at', null)
          .order('category', { ascending: true })
          .order('shirt_number', { ascending: true, nullsFirst: false })
          .order('full_name', { ascending: true });
        
        if (error) throw error;
        return (data || []).map(d => ({ ...d, career_history: (d.career_history || []) as unknown as CareerEntry[] })) as SiteRosterMember[];
      } else {
        // Public view: use the security view that respects show_email/show_phone flags
        const { data, error } = await supabase
          .from('site_roster_public' as any)
          .select('*')
          .eq('status', 'active')
          .order('category', { ascending: true })
          .order('shirt_number', { ascending: true, nullsFirst: false })
          .order('full_name', { ascending: true });
        
        if (error) throw error;
        return ((data as unknown) as any[]).map(d => ({ ...d, career_history: (d.career_history || []) as CareerEntry[] })) as SiteRosterMember[];
      }
    },
  });
};

export const useSiteRosterMember = (id: string) => {
  return useQuery({
    queryKey: ['site-roster-member', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_roster')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return { ...data, career_history: (data.career_history || []) as unknown as CareerEntry[] } as SiteRosterMember;
    },
    enabled: !!id,
  });
};

export const useCreateSiteRosterMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (member: Omit<SiteRosterMember, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('site_roster')
        .insert({ ...member, career_history: member.career_history as any } as any)
        .select()
        .single();
      
      if (error) throw error;
      
      await supabase.from('activity_log').insert({
        type: 'roster_created',
        payload: { member_id: data.id, name: member.full_name, user_id: user?.id } as any
      } as any);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-roster'] });
      toast({ title: 'Person lagt til' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved opprettelse', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateSiteRosterMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SiteRosterMember> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('site_roster')
        .update({ ...updates, career_history: updates.career_history as any } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      await supabase.from('activity_log').insert({
        type: 'roster_updated',
        payload: { member_id: id, changes: updates, user_id: user?.id } as any
      } as any);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-roster'] });
      toast({ title: 'Person oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved oppdatering', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteSiteRosterMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: member } = await supabase
        .from('site_roster')
        .select('full_name')
        .eq('id', id)
        .single();
      
      // Soft delete: set deleted_at instead of actually deleting
      const { error } = await supabase
        .from('site_roster')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', id);
      
      if (error) throw error;
      
      await supabase.from('activity_log').insert({
        type: 'roster_deleted',
        payload: { member_id: id, name: member?.full_name, user_id: user?.id } as any
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-roster'] });
      queryClient.invalidateQueries({ queryKey: ['site-roster-trash'] });
      toast({ title: 'Person flyttet til søppelpost' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });
};

export const useSiteRosterTrash = () => {
  return useQuery({
    queryKey: ['site-roster-trash'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_roster')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(d => ({ ...d, career_history: (d.career_history || []) as unknown as CareerEntry[] })) as (SiteRosterMember & { deleted_at: string })[];
    },
  });
};

export const useRestoreSiteRosterMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('site_roster')
        .update({ deleted_at: null } as any)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-roster'] });
      queryClient.invalidateQueries({ queryKey: ['site-roster-trash'] });
      toast({ title: 'Person gjenopprettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved gjenoppretting', description: error.message, variant: 'destructive' });
    },
  });
};

export const usePermanentDeleteSiteRosterMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('site_roster')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-roster-trash'] });
      toast({ title: 'Person permanent slettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });
};
