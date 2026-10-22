import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Membership {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  membership_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useMemberships() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: memberships = [], isLoading, error } = useQuery({
    queryKey: ['memberships'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<Membership[]>('admin-memberships', {
        body: { action: 'list' },
      });
      
      if (error) throw error;
      return data || [];
    },
    // Admin list: refreshed when the page is opened, not on tab focus.
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.functions.invoke('admin-memberships', {
        body: { action: 'update', id, status },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      toast({ title: 'Status oppdatert' });
    },
    onError: (error) => {
      toast({ title: 'Feil', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMembership = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('admin-memberships', {
        body: { action: 'delete', id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      toast({ title: 'Medlem slettet' });
    },
    onError: (error) => {
      toast({ title: 'Feil ved sletting', description: error.message, variant: 'destructive' });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === memberships.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(memberships.map(m => m.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  return {
    memberships,
    isLoading,
    error,
    selectedIds,
    toggleSelect,
    selectAll,
    setSelected: setSelectedIds,
    clearSelection,
    updateStatus,
    deleteMembership,
  };
}
